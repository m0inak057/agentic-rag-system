"""
LangGraph state machine for the Agentic RAG system.
This defines the agent's reasoning loop and decision-making process.
"""

from typing import List, Dict, Any, Optional, TypedDict
from datetime import datetime
import json
from langgraph.graph import StateGraph, START, END
import os

from .tools import (
    vector_search_tool,
    hybrid_search_tool,
    web_search_tool,
    grade_documents_tool,
)


# Define the Agent State as a TypedDict for LangGraph
class AgentState(TypedDict, total=False):
    """State object for the RAG agent."""
    question: str
    conversation_history: List[Dict[str, str]]
    retrieved_documents: List[Dict[str, Any]]
    graded_documents: List[Dict[str, Any]]
    generation: str
    reasoning_trace: List[str]
    current_step: str
    loop_count: int
    document_id: int
    collection_id: int
    use_web_search: bool
    rewrite_count: int
    cited_sources: List[Dict[str, Any]]
    web_documents: List[Dict[str, Any]]


def route_query(state: AgentState) -> dict:
    """
    Route the user's query to the appropriate tool or directly to generation.
    Decides: "Do I need vector search, web search, or can I answer directly?"
    If a document or collection has been provided, ALWAYS try document search first.
    """
    state["current_step"] = "routing_query"
    state["reasoning_trace"].append(f"[ROUTE] Analyzing query: '{state['question']}'")
    
    # If the user has provided a document/collection, always use document search first
    has_document = state.get("document_id") or state.get("collection_id")
    
    if has_document:
        # User uploaded a PDF — always search the document first, never go to web directly
        state["use_web_search"] = False
        state["reasoning_trace"].append("[ROUTE] → Document provided, will use document search")
    else:
        # No document provided: use web search heuristics
        web_keywords = ["latest", "recent", "news", "today", "current", "web"]
        if any(keyword in state["question"].lower() for keyword in web_keywords):
            state["use_web_search"] = True
            state["reasoning_trace"].append("[ROUTE] → Web search needed for current information")
        else:
            state["reasoning_trace"].append("[ROUTE] → Document search will be used")
        
    return {"use_web_search": state.get("use_web_search", False), "current_step": state["current_step"], "reasoning_trace": state["reasoning_trace"]}


def rewrite_query(state: AgentState) -> dict:
    """
    Refine the user's query to be more effective for searching.
    Uses Gemini to rephrase vague questions.
    """
    from .unified_llm import get_unified_llm
    
    state["current_step"] = "rewriting_query"
    state.setdefault("rewrite_count", 0)
    state["rewrite_count"] += 1
    
    if state["rewrite_count"] > 2:
        state["reasoning_trace"].append("[REWRITE] Max rewrite attempts reached")
        return {"current_step": state["current_step"], "rewrite_count": state["rewrite_count"], "reasoning_trace": state["reasoning_trace"]}
    
    try:
        llm = get_unified_llm()
        
        prompt = f"""You are a query optimization expert. 
The user's original question is: "{state['question']}"

Rewrite this question to be more specific and clear for document search. 
Return ONLY the rewritten question, nothing else."""
        
        response = llm.generate(prompt)
        original = state["question"]
        state["question"] = response['text'].strip()
        provider = response['provider'].value
        state["reasoning_trace"].append(f"[REWRITE] '{original}' → '{state['question']}' (via {provider})")
        
    except Exception as e:
        state["reasoning_trace"].append(f"[REWRITE] Failed: {str(e)}")
        
    return {"question": state["question"], "current_step": state["current_step"], "rewrite_count": state["rewrite_count"], "reasoning_trace": state["reasoning_trace"]}


def retrieve_documents(state: AgentState) -> dict:
    """
    Retrieve relevant document chunks using configured search strategy.
    Supports hybrid search (semantic+keyword) or vector-only based on config.
    """
    state["current_step"] = "retrieving_documents"
    config = state.get('config', {'use_hybrid_search': True})
    use_hybrid = config.get('use_hybrid_search', True)

    if use_hybrid:
        state["reasoning_trace"].append("[RETRIEVE] Starting hybrid search with query expansion...")
    else:
        state["reasoning_trace"].append("[RETRIEVE] Starting vector-only search...")

    try:
        from .unified_llm import get_unified_llm

        # Generate expanded queries only for hybrid search (better ROI)
        all_queries = [state["question"]]
        if use_hybrid:
            llm = get_unified_llm()
            expansion_prompt = f"""Generate 2 alternative phrasings of this question that might retrieve different but relevant documents.
Original: {state['question']}

Return ONLY the 2 alternatives, one per line, no numbering or extra text."""

            try:
                expansion_response = llm.generate(expansion_prompt)
                expanded_queries = expansion_response['text'].strip().split('\n')[:2]
                all_queries.extend(expanded_queries)
            except:
                pass

        # Search with configured strategy
        all_results = {}

        for query_variant in all_queries:
            try:
                if use_hybrid:
                    results = hybrid_search_tool.invoke({
                        "query": query_variant,
                        "document_id": state.get("document_id"),
                        "collection_id": state.get("collection_id"),
                        "top_k": 10
                    })
                else:
                    results = vector_search_tool.invoke({
                        "query": query_variant,
                        "document_id": state.get("document_id"),
                        "collection_id": state.get("collection_id"),
                        "top_k": 10
                    })

                # Track results by ID with score averaging
                for result in results:
                    chunk_id = result['id']
                    if chunk_id not in all_results:
                        all_results[chunk_id] = result
                    else:
                        # Average scores from multiple queries
                        score_key = 'combined_score' if use_hybrid else 'relevance_score'
                        all_results[chunk_id][score_key] = (
                            all_results[chunk_id].get(score_key, 0) + result.get(score_key, 0)
                        ) / 2
            except Exception as e:
                state["reasoning_trace"].append(f"[RETRIEVE] Search error for query '{query_variant}': {str(e)}")

        # Re-rank combined results
        score_key = 'combined_score' if use_hybrid else 'relevance_score'
        ranked_results = sorted(
            all_results.values(),
            key=lambda x: x.get(score_key, 0),
            reverse=True
        )[:20]

        # Apply cross-encoder re-ranking for hybrid search only
        if use_hybrid:
            from .tools import rerank_with_cross_encoder
            state["retrieved_documents"] = rerank_with_cross_encoder(
                state["question"],
                ranked_results,
                top_k=5
            )
        else:
            state["retrieved_documents"] = ranked_results[:5]

        state["reasoning_trace"].append(
            f"[RETRIEVE] Found {len(state['retrieved_documents'])} chunks "
            f"({'hybrid' if use_hybrid else 'vector-only'})"
        )

        if len(state["retrieved_documents"]) == 0:
            state["reasoning_trace"].append("[RETRIEVE] No documents found, will try web search")
            state["use_web_search"] = True

    except Exception as e:
        state["reasoning_trace"].append(f"[RETRIEVE] Error: {str(e)}")
        state["use_web_search"] = True

    return {"retrieved_documents": state.get("retrieved_documents", []), "use_web_search": state.get("use_web_search", False), "current_step": state["current_step"], "reasoning_trace": state["reasoning_trace"]}


def grade_documents(state: AgentState) -> dict:
    """
    Evaluate if the retrieved documents are relevant to the question.
    If not relevant, trigger a new search or rewrite the query.
    """
    state["current_step"] = "grading_documents"
    state["reasoning_trace"].append("[GRADE] Evaluating document relevance...")
    
    try:
        grade_result = grade_documents_tool.invoke({
            "documents": state["retrieved_documents"],
            "query": state["question"]
        })
        
        state["graded_documents"] = grade_result['relevant_documents']
        relevance = grade_result['relevance_score']
        
        state["reasoning_trace"].append(
            f"[GRADE] Relevance score: {relevance:.2f} "
            f"({len(state['graded_documents'])}/{len(state['retrieved_documents'])} relevant)"
        )
    except Exception as e:
        state["reasoning_trace"].append(f"[GRADE] Error: {str(e)}, proceeding with available docs")
        state["graded_documents"] = state["retrieved_documents"]
        
    return {"graded_documents": state.get("graded_documents", []), "current_step": state["current_step"], "reasoning_trace": state["reasoning_trace"]}


def web_search(state: AgentState) -> dict:
    """
    Perform web search for supplementary information.
    Gracefully handles missing API keys, timeouts, and network errors.
    """
    state["current_step"] = "web_search"
    state["reasoning_trace"].append("[WEB] Performing web search...")

    try:
        web_results = web_search_tool.invoke({"query": state["question"]})

        # Convert web results to document-like format and store in web_documents
        state["web_documents"] = [
            {
                'id': idx + 1000,  # Offset to avoid overlaps with document chunk IDs
                'text': f"{result['title']}\n{result['snippet']}",
                'url': result.get('url'),
                'title': result.get('title'),
                'combined_score': 1.0,
                'source': 'web',
            }
            for idx, result in enumerate(web_results)
        ]

        if len(web_results) > 0:
            state["reasoning_trace"].append(
                f"[WEB] Found {len(web_results)} web results"
            )
        else:
            state["reasoning_trace"].append(
                "[WEB] No web results found or web search unavailable. Proceeding with document context."
            )

    except Exception as e:
        # This should rarely happen now due to web_search_tool's defensive error handling
        state["reasoning_trace"].append(f"[WEB] Unexpected error: {str(e)}. Proceeding without web context.")
        state["web_documents"] = []

    return {"web_documents": state.get("web_documents", []), "current_step": state["current_step"], "reasoning_trace": state["reasoning_trace"]}


def generate_answer(state: AgentState) -> dict:
    """
    Generate the final answer based on retrieved documents, web search results, and conversation history.
    Uses Gemini API for generation with strict grounding and low temperature for deterministic output.
    """
    from .unified_llm import get_unified_llm

    state["current_step"] = "generating_answer"
    state["reasoning_trace"].append("[GENERATE] Compiling context and generating answer...")

    try:
        llm = get_unified_llm()

        # Compile context from retrieved documents
        docs_to_use = state.get("graded_documents") if state.get("graded_documents") else state.get("retrieved_documents", [])
        docs_to_use = docs_to_use[:5]
        num_docs = len(docs_to_use)

        context_text = ""
        if num_docs > 0:
            context_text = "\n\n".join([
                f"[Source {idx+1}] [{doc.get('document_title', 'Unknown')} (Page {doc.get('page_number', '?')})]\n{doc['text'][:500]}"
                for idx, doc in enumerate(docs_to_use)
            ])
        else:
            context_text = "No relevant document chunks found."

        # Compile context from web results
        web_docs = state.get("web_documents", [])
        web_docs = web_docs[:5]
        num_web = len(web_docs)

        web_context_text = ""
        if num_web > 0:
            web_context_text = "\n\n".join([
                f"[Source {num_docs + idx + 1}] [Web Result: {doc.get('title', 'Unknown')}]\n{doc['text'][:500]}"
                for idx, doc in enumerate(web_docs)
            ])
        else:
            web_context_text = "No web search results available."

        # Build conversation history string
        history_text = ""
        if state.get("conversation_history"):
            history_text = "\nRecent Conversation History:\n"
            for msg in state["conversation_history"][-3:]:  # Last 3 messages for context
                history_text += f"- {msg['role']}: {msg['content'][:200]}\n"

        # STRICT GROUNDING SYSTEM PROMPT
        system_prompt = """You are a document-grounded AI assistant. Your responses MUST be strictly derived from the provided context sources.

MANDATORY GROUNDING RULES:
1. **Answer ONLY from Provided Context**: Every fact, claim, or statement in your answer must be directly traceable to the document or web sources provided. DO NOT use parametric memory or external knowledge.
2. **If No Answer Exists**: If the question cannot be answered from the provided documents AND web results, you MUST explicitly state: "I cannot answer this based on the provided documents and sources."
3. **NO Hallucinations**: Never invent, assume, or speculate about information not explicitly contained in the sources. If uncertain, say so.

CONTEXT STRUCTURE AND PRIORITY:
- **NATIVE DOCUMENTS (Sources 1 to N)**: These are your primary sources. Answer using documents first.
- **WEB RESULTS (Sources N+1 to M)**: Supplementary sources only. Use web results only after exhausting document context, and explicitly flag when using them with "According to web search results:" or similar.

CITATION REQUIREMENTS:
- Cite using [N] format (e.g., [1], [2]) immediately after any fact or claim.
- Citations MUST match actual source numbers in the context.
- Multiple citations for one claim: [1][2] or [1], [3], [5].
- Invalid citations (e.g., [99]) will cause response degradation.

RESPONSE STRUCTURE:
1. **Primary Answer**: Derived exclusively from document sources (Sources 1 to N). If no document answers the query, state this explicitly.
2. **Web Supplement** (if applicable): If web results provide additional useful information, create a subsection titled "### Additional Web Information" citing [N+1], [N+2], etc.
3. **Transparency**: Always be explicit about what is unknown or missing from the sources."""

        # Construct the prompt with strict grounding constraints
        user_prompt = f"""{system_prompt}

===== PROVIDED CONTEXT =====

NATIVE DOCUMENT SOURCES (Priority 1 - Answer from these first):
Sources 1 to {num_docs}:
{context_text}

WEB SEARCH SOURCES (Priority 2 - Use only to supplement documents):
Sources {num_docs + 1} to {num_docs + num_web}:
{web_context_text}

{history_text}

===== USER QUESTION =====
{state['question']}

===== ANSWER INSTRUCTIONS =====
- Derive your answer strictly from the provided sources above.
- Every statement must be traceable to a source via [N] citation.
- If you cannot answer from the provided context, explicitly state: "I cannot answer this based on the provided documents and sources."
- Do NOT use general knowledge or assumptions.
- Prioritize native document sources; use web results only as supplementary information.
- Ensure all citations are valid (exist in the source list above)."""

        # Pass temperature=0.1 to enforce deterministic, grounded behavior (no hallucination)
        response = llm.generate(user_prompt, temperature=0.1)
        state["generation"] = response['text']
        provider = response['provider'].value

        state["reasoning_trace"].append(f"[GENERATE] Answer generated via {provider} (strict grounding, temp=0.1)")

    except Exception as e:
        state["generation"] = f"Error generating answer: {str(e)}"
        state["reasoning_trace"].append(f"[GENERATE] Error: {str(e)}")

    return {"generation": state.get("generation", ""), "current_step": state["current_step"], "reasoning_trace": state["reasoning_trace"]}


import re

def extract_and_validate_citations(state: AgentState) -> dict:
    """
    Post-processor to validate and structure citations in the generated answer.

    Actions:
    1. Extract all [N] citations from the answer
    2. Validate they match the source documents or web search results provided
    3. Remove invalid citations
    4. Build structured sources array with metadata
    5. Store only sources that are actually cited
    """
    state["current_step"] = "validating_citations"
    answer = state.get("generation", "")

    # Handle AIMessage objects (from LangChain) - extract plain text
    if hasattr(answer, 'content'):
        answer = answer.content
    answer = str(answer) if answer is not None else ""

    docs_to_use = state.get("graded_documents", []) or state.get("retrieved_documents", [])
    docs_to_use = docs_to_use[:5]  # Only support up to 5 sources
    num_docs = len(docs_to_use)

    web_docs = state.get("web_documents", [])
    web_docs = web_docs[:5]

    # Build a map of citation_number -> document or web metadata
    citation_map = {}
    
    # 1. Map document chunks
    for idx, doc in enumerate(docs_to_use):
        citation_num = idx + 1
        citation_map[str(citation_num)] = {
            'citation_number': citation_num,
            'chunk_id': doc.get('id'),
            'document_id': doc.get('document_id'),
            'document_title': doc.get('document_title', 'Unknown'),
            'page_number': doc.get('page_number'),
            'text_preview': doc.get('text', '')[:200],  # First 200 chars as preview
            'url': None,
        }
        
    # 2. Map web results
    for idx, doc in enumerate(web_docs):
        citation_num = num_docs + idx + 1
        citation_map[str(citation_num)] = {
            'citation_number': citation_num,
            'chunk_id': doc.get('id'),
            'document_id': None,
            'document_title': f"Web: {doc.get('title', 'Search Result')}" if doc.get('title') else "Web Search Source",
            'page_number': None,
            'text_preview': doc.get('text', '')[:200],  # First 200 chars as preview
            'url': doc.get('url'),
        }

    # Find all citations in the answer (patterns like [1], [2], [1][3], etc.)
    all_citations = re.findall(r'\[(\d+)\]', answer)

    # Track invalid and valid citations
    invalid_citations = []
    used_citation_numbers = set()

    for citation_num in all_citations:
        if citation_num not in citation_map:
            invalid_citations.append(f"[{citation_num}]")
            answer = answer.replace(f"[{citation_num}]", "")
        else:
            used_citation_numbers.add(int(citation_num))

    # Build structured sources array with only cited sources
    cited_sources = []
    for citation_num in sorted(used_citation_numbers):
        cited_sources.append(citation_map[str(citation_num)])

    # Log validation results
    if invalid_citations:
        state["reasoning_trace"].append(f"[VALIDATE] Removed invalid citations: {', '.join(invalid_citations)}")

    state["reasoning_trace"].append(f"[VALIDATE] Found {len(cited_sources)} valid citations: {list(used_citation_numbers)}")

    # Store structured sources in state
    state["generation"] = answer
    state["cited_sources"] = cited_sources

    return {
        "generation": state["generation"],
        "cited_sources": cited_sources,
        "current_step": state["current_step"],
        "reasoning_trace": state["reasoning_trace"]
    }


# Build the StateGraph
def create_rag_graph(config: Optional[Dict[str, bool]] = None):
    """
    Create and compile the RAG agent graph with configurable components.

    Args:
        config: Configuration dict controlling which components are active:
            - use_hybrid_search: Use hybrid (semantic+keyword) vs vector-only (default: True)
            - use_grading: Grade documents for relevance (default: True)
            - use_rewriting: Rewrite vague queries (default: True)

    Graph flow:
    1. route_query: Decides between document search, web search, or direct generation
    2. retrieve_documents: Performs search (hybrid or vector-only based on config)
    3. grade_documents: Evaluates relevance of retrieved docs (if enabled)
    4. rewrite_query: Refines the query if needed (if enabled)
    5. web_search: Fallback to web search if local docs aren't good
    6. generate_answer: Creates the final response using retrieved context
    """

    # Default config: all features enabled
    if config is None:
        config = {
            'use_hybrid_search': True,
            'use_grading': True,
            'use_rewriting': True,
        }

    workflow = StateGraph(AgentState)

    # Store config in state for nodes to access
    def add_config(state):
        state['config'] = config
        return state

    # Add nodes
    workflow.add_node("config", add_config)
    workflow.add_node("route_query", route_query)
    workflow.add_node("rewrite_query", rewrite_query)
    workflow.add_node("retrieve_documents", retrieve_documents)
    workflow.add_node("grade_documents", grade_documents)
    workflow.add_node("web_search", web_search)
    workflow.add_node("generate_answer", generate_answer)
    workflow.add_node("validate_citations", extract_and_validate_citations)

    # Add edges
    workflow.add_edge(START, "config")
    workflow.add_edge("config", "route_query")

    # From route_query
    workflow.add_conditional_edges(
        "route_query",
        lambda state: "web_search" if state.get("use_web_search", False) else "retrieve_documents"
    )

    # From retrieve_documents
    def route_retrieve(state):
        if state.get("use_web_search", False):
            return "web_search"
        if config['use_grading']:
            return "grade_documents"
        if state.get("document_id") or state.get("collection_id"):
            return "web_search"
        return "generate_answer"

    workflow.add_conditional_edges("retrieve_documents", route_retrieve)

    # From grade_documents: if we have relevant docs, generate/web_search; 
    # if no relevant docs but retrieval returned something, still proceed with what we have
    # (avoids getting stuck in rewrite loops that end up at web search)
    def route_grade(state):
        has_relevant = len(state.get("graded_documents", [])) > 0
        has_retrieved = len(state.get("retrieved_documents", [])) > 0
        if has_relevant or has_retrieved or not config['use_rewriting']:
            if state.get("document_id") or state.get("collection_id"):
                return "web_search"
            return "generate_answer"
        return "rewrite_query"

    workflow.add_conditional_edges("grade_documents", route_grade)

    # From rewrite_query
    def route_rewrite(state):
        if state.get("rewrite_count", 0) > 2:
            if state.get("document_id") or state.get("collection_id"):
                return "web_search"
            return "generate_answer"
        return "retrieve_documents"

    workflow.add_conditional_edges("rewrite_query", route_rewrite)

    # From web_search
    workflow.add_edge("web_search", "generate_answer")

    # From generate_answer to validate_citations
    workflow.add_edge("generate_answer", "validate_citations")

    # From validate_citations
    workflow.add_edge("validate_citations", END)

    # Compile the graph
    return workflow.compile()


# Create the compiled graph instance (lazy-loaded in views.py)
# rag_graph = create_rag_graph()
