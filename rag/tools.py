"""
Tool functions for the RAG agent.
These tools are the "skills" the agent can use to answer questions.
"""

from typing import Optional, List
from django.contrib.auth.models import User
from pgvector.django import CosineDistance
import json
import logging
from .models import DocumentChunk, Document
from langchain.tools import tool
import os

logger = logging.getLogger(__name__)

# Embedding model (we'll initialize this in services.py)
embedding_model = None

def set_embedding_model(model):
    """Set the embedding model to use for vector search."""
    global embedding_model
    embedding_model = model


def _vector_search_impl(query: str, document_id: int = None, collection_id: int = None, top_k: int = 5) -> List[dict]:
    """
    Plain (non-@tool) implementation of vector search.
    Called internally by both vector_search_tool and hybrid_search_tool
    to avoid @tool-on-@tool invocation issues.
    """
    if embedding_model is None:
        raise ValueError("Embedding model not initialized. Call set_embedding_model() first.")
        
    if not document_id and not collection_id:
        raise ValueError("Must provide either document_id or collection_id")

    # Embed the query
    query_embedding = embedding_model.encode(query, convert_to_tensor=False).tolist()

    # Query the database for similar chunks
    queryset = DocumentChunk.objects.all()
    if document_id:
        queryset = queryset.filter(document_id=document_id)
    if collection_id:
        queryset = queryset.filter(document__collection_id=collection_id)

    chunks = queryset.annotate(
        distance=CosineDistance('embedding', query_embedding)
    ).order_by('distance')[:top_k]

    results = []
    for chunk in chunks:
        # Pre-fetch related document for title and ID
        doc = chunk.document
        results.append({
            'id': chunk.id,
            'document_id': doc.id,
            'document_title': doc.title,
            'page_number': chunk.page_number,
            'text': chunk.text,
            'relevance_score': 1 - float(chunk.distance),  # Convert distance to similarity
        })

    return results


@tool
def vector_search_tool(query: str, document_id: Optional[int] = None, collection_id: Optional[int] = None, top_k: int = 5) -> List[dict]:
    """
    Search for relevant document chunks using semantic similarity (vector embeddings).

    Args:
        query: The user's question or search query
        document_id: The ID of the document to search within
        collection_id: The ID of the collection to search within
        top_k: Number of top results to return (default: 5)

    Returns:
        List of relevant chunks with their metadata
    """
    try:
        return _vector_search_impl(query, document_id=document_id, collection_id=collection_id, top_k=top_k)
    except Exception as e:
        raise ValueError(f"Vector search failed: {str(e)}")


@tool
def web_search_tool(query: str) -> List[dict]:
    """
    Search the web for information when the answer is not in local documents.
    Uses Tavily API for real-time information retrieval.
    Gracefully degrades on API unavailability, network errors, or timeout.

    Args:
        query: The search query

    Returns:
        List of search results with title, snippet, and URL. Empty list if web search unavailable.
    """
    from tavily import TavilyClient

    api_key = os.getenv('TAVILY_API_KEY')
    if not api_key:
        logger.warning("⚠️ TAVILY_API_KEY not configured. Web search unavailable. Proceeding with document context only.")
        return []

    try:
        client = TavilyClient(api_key=api_key)
        response = client.search(query, max_results=5)

        results = []
        for result in response.get('results', []):
            results.append({
                'title': result.get('title', ''),
                'snippet': result.get('snippet', ''),
                'url': result.get('url', ''),
                'relevance_score': result.get('score', 0),
            })

        logger.info(f"✅ Web search succeeded: {len(results)} results for query '{query[:50]}'")
        return results

    except TimeoutError as e:
        logger.warning(f"⚠️ Web search timeout (network error). Proceeding without web context. Details: {str(e)}")
        return []
    except ConnectionError as e:
        logger.warning(f"⚠️ Web search connection error. Proceeding without web context. Details: {str(e)}")
        return []
    except Exception as e:
        logger.warning(f"⚠️ Web search failed (Tavily API error). Proceeding without web context. Details: {str(e)}")
        return []


@tool
def document_analyzer_tool(text: str, task: str = "summarize") -> str:
    """
    Analyze or summarize a document chunk using Gemini LLM.

    Args:
        text: The text to analyze
        task: The task to perform (e.g., "summarize", "extract_key_points")

    Returns:
        The result of the analysis
    """
    from .unified_llm import get_unified_llm
    
    try:
        llm = get_unified_llm()
        
        if task == "summarize":
            prompt = f"Summarize the following text in 2-3 sentences:\n\n{text}"
        elif task == "extract_key_points":
            prompt = f"Extract the key points from the following text:\n\n{text}"
        else:
            prompt = f"Analyze the following text:\n\n{text}"
        
        response = llm.generate(prompt)
        return response['text']
    
    except Exception as e:
        raise ValueError(f"Document analysis failed: {str(e)}")


@tool
def grade_documents_tool(documents: List[dict], query: str) -> dict:
    """
    Grade the relevance of retrieved documents to the user's query.
    Uses Gemini LLM to determine if documents are relevant.

    Args:
        documents: List of document chunks with their text
        query: The user's query

    Returns:
        A dict with 'relevant_documents', 'irrelevant_documents', and 'relevance_score'
    """
    from .unified_llm import get_unified_llm
    
    try:
        llm = get_unified_llm()
        
        relevant_docs = []
        irrelevant_docs = []
        
        for doc in documents:
            # Create a balanced grading prompt that understands PDF context
            prompt = f"""You are grading whether a PDF document chunk is relevant to a user's query.

IMPORTANT CONTEXT:
- These are chunks extracted from a user-uploaded PDF document
- The user is asking about content they expect to find IN this document
- Grade YES if the chunk contains information related to the general topic of the query
- Grade YES if the chunk discusses concepts, terms, or techniques mentioned in the query
- Grade NO only if the chunk is completely off-topic and cannot possibly help answer the query

User Query: {query}

Document Chunk:
{doc['text'][:500]}

Is this chunk relevant to the user's query? Answer with ONLY "YES" or "NO", nothing else."""

            response = llm.generate(prompt)
            answer = response['text'].strip().upper()

            if answer.startswith("YES"):
                relevant_docs.append(doc)
            else:
                irrelevant_docs.append(doc)
        
        return {
            'relevant_documents': relevant_docs,
            'irrelevant_documents': irrelevant_docs,
            'relevance_score': len(relevant_docs) / len(documents) if documents else 0,
        }
    
    except Exception as e:
        raise ValueError(f"Document grading failed: {str(e)}")


def rerank_with_cross_encoder(query: str, documents: List[dict], top_k: int = 5) -> List[dict]:
    """
    Re-rank documents using a cross-encoder for better relevance matching.

    Args:
        query: The user's question
        documents: List of document chunks to re-rank
        top_k: Number of top results to return

    Returns:
        Re-ranked list of documents
    """
    if not documents:
        return []

    try:
        from sentence_transformers import CrossEncoder

        # Use a lightweight cross-encoder model for ranking
        cross_encoder = CrossEncoder('cross-encoder/mmarco-MiniLMv2-L12-H384')

        # Prepare pairs: (query, chunk_text)
        pairs = [[query, doc['text'][:500]] for doc in documents]

        # Get cross-encoder scores
        scores = cross_encoder.predict(pairs)

        # Attach scores to documents
        for i, doc in enumerate(documents):
            doc['cross_encoder_score'] = float(scores[i])

        # Re-sort by cross-encoder score
        reranked = sorted(documents, key=lambda x: x['cross_encoder_score'], reverse=True)
        return reranked[:top_k]

    except ImportError:
        # If CrossEncoder not available, return original ranking
        return documents[:top_k]
    except Exception as e:
        # Fall back to original ordering on error
        return documents[:top_k]
