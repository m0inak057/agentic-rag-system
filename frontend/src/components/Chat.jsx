import { useState, useRef, useEffect, Fragment } from 'react'
import Spinner from './Spinner'

export default function Chat({ documentId, documentTitle, collectionId, collectionTitle }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reasoning, setReasoning] = useState([])
  const [showReasoning, setShowReasoning] = useState(false)
  const [activeSource, setActiveSource] = useState(null)
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    setMessages([])
    setReasoning([])
    setError('')
    setActiveSource(null)
  }, [documentId, collectionId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    if (!documentId && !collectionId) return

    const userMessage = input.trim()
    setInput('')
    setError('')
    setReasoning([])
    setShowReasoning(false)
    setActiveSource(null)

    setMessages((prev) => [...prev, { type: 'user', content: userMessage }])
    setLoading(true)

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const token = localStorage.getItem('token')
      const requestBody = { question: userMessage }
      if (documentId) requestBody.document_id = documentId
      if (collectionId) requestBody.collection_id = collectionId

      const response = await fetch('/api/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Server error ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantContent = ''
      let currentReasoning = []
      let sourcesFromServer = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          const dataLine = part.split('\n').find((l) => l.startsWith('data: '))
          if (!dataLine) continue

          try {
            const payload = JSON.parse(dataLine.slice(6))
            if (payload.type === 'reasoning') {
              currentReasoning = [...currentReasoning, payload.content]
              setReasoning(currentReasoning)
            } else if (payload.type === 'answer') {
              assistantContent = payload.content
              sourcesFromServer = payload.sources || sourcesFromServer
            } else if (payload.type === 'complete') {
              sourcesFromServer = payload.sources || sourcesFromServer
            } else if (payload.type === 'error') {
              throw new Error(payload.content)
            }
          } catch (parseErr) {
            console.warn('SSE parse error:', parseErr)
          }
        }
      }

      if (assistantContent) {
        setMessages((prev) => [
          ...prev,
          {
            type: 'assistant',
            content: assistantContent,
            sources: sourcesFromServer,
          },
        ])
      } else {
        setError('No answer received from the agent.')
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  if (!documentId && !collectionId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8">
        <p className="text-lg font-semibold text-text-primary mb-2">Select a knowledge source</p>
        <p className="text-text-secondary">Pick a document or collection to start a conversation.</p>
      </div>
    )
  }

  const renderMessageContent = (text, sources) => {
    const parts = text.split(/(\[\d+\])/g)
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/)
      if (match) {
        const citationNum = parseInt(match[1], 10)
        const sourceObj = sources?.find(s => s.citation_number === citationNum)
        if (sourceObj) {
          return (
            <button
              key={i}
              onClick={() => setActiveSource(sourceObj)}
              className="inline-flex items-center mx-0.5 px-1.5 py-0.5 bg-accent-light text-accent border border-accent-border rounded text-xs font-medium cursor-pointer transition-colors duration-150 hover:bg-accent-border"
              title={`View source ${citationNum}`}
            >
              {part}
            </button>
          )
        }
      }
      return <Fragment key={i}>{part}</Fragment>
    })
  }

  const renderReasoningLine = (line) => {
    const match = line.match(/^(\[[A-Z]+\])(.*)$/)
    if (match) {
      return (
        <>
          <span className="text-accent font-semibold">{match[1]}</span>
          {match[2]}
        </>
      )
    }
    return line
  }

  return (
    <div className="flex h-full">
      <div className={`flex flex-col min-h-0 ${activeSource ? 'flex-1' : 'w-full'}`}>
        {/* Chat Header */}
        <div className="border-b border-border px-8 py-5">
          <h2 className="text-lg font-semibold text-text-primary">Chat</h2>
          <p className="text-text-secondary text-sm mt-0.5">
            {collectionTitle ? `Collection · ${collectionTitle}` : `Document · ${documentTitle}`}
          </p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <p className="text-text-muted text-sm">No messages yet. Ask a question to begin.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-4 py-3 ${
                    msg.type === 'user'
                      ? 'bg-accent text-white rounded-[12px_12px_2px_12px]'
                      : 'bg-bg-secondary text-text-primary border border-border rounded-[12px_12px_12px_2px]'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">
                    {msg.type === 'assistant' ? renderMessageContent(msg.content, msg.sources) : msg.content}
                  </p>

                  {msg.sources && msg.sources.length > 0 && msg.type === 'assistant' && (
                    <div className="mt-3 pt-3 border-t border-border text-xs flex flex-wrap gap-2">
                      <span className="font-medium text-text-primary block w-full">Sources</span>
                      {msg.sources.map((src, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveSource(src)}
                          className="bg-white hover:bg-bg-tertiary px-2.5 py-1 rounded border border-border transition-colors duration-150 text-text-secondary"
                        >
                          [{src.citation_number}] {src.document_title} · Page {src.page_number ?? 'N/A'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-bg-secondary border border-border rounded-[12px_12px_12px_2px] px-4 py-3 flex items-center gap-2.5">
                <Spinner />
                <span className="text-text-secondary text-sm">Thinking…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-error text-sm px-4 py-3 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Reasoning Section */}
        {reasoning.length > 0 && (
          <div className="border-t border-border bg-bg-tertiary px-6 py-3">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="text-sm font-medium text-text-primary flex items-center gap-2 transition-colors duration-150 hover:text-accent"
            >
              <span className={`transition-transform duration-150 inline-block ${showReasoning ? 'rotate-90' : ''}`}>›</span>
              Agent trace ({reasoning.length})
            </button>
            {showReasoning && (
              <div className="text-xs font-mono mt-3 p-3 bg-white rounded-md max-h-40 overflow-y-auto space-y-1 border border-border text-text-secondary">
                {reasoning.map((r, i) => (
                  <div key={i}>{renderReasoningLine(r)}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t border-border px-8 py-5 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            placeholder="Send a message…"
            className="flex-1 px-3.5 py-2.5 bg-white text-text-primary placeholder-text-muted border border-border rounded-md outline-none transition-colors duration-150 focus:border-accent focus:ring-[3px] focus:ring-accent/10"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-accent text-white font-medium rounded-md transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      {/* Source Viewer Panel */}
      {activeSource && (
        <div className="w-96 border-l border-border flex flex-col overflow-hidden shrink-0">
          <div className="px-5 py-4 border-b border-border flex justify-between items-center">
            <h3 className="font-semibold text-text-primary text-sm">Source details</h3>
            <button
              onClick={() => setActiveSource(null)}
              className="text-text-secondary hover:text-text-primary w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-150"
              title="Close panel"
            >
              ✕
            </button>
          </div>
          <div className="p-5 overflow-y-auto flex-1 space-y-5">
            <div className="pb-4 border-b border-border">
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Document</h4>
              <p className="text-sm text-text-primary font-medium">{activeSource.document_title || `Document #${activeSource.document_id}`}</p>
            </div>

            <div className="flex justify-between gap-4">
              <div>
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Page</h4>
                <p className="text-lg text-text-primary font-semibold">{activeSource.page_number || 'N/A'}</p>
              </div>
              {activeSource.score !== undefined && (
                <div>
                  <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Relevance</h4>
                  <p className="text-lg text-text-primary font-semibold">{Math.round(activeSource.score * 100)}%</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Extracted content</h4>
              <div className="bg-bg-secondary border border-border rounded-md p-4 text-sm leading-relaxed text-text-secondary">
                {activeSource.text_preview || activeSource.text}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
