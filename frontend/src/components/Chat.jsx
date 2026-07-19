import { useState, useRef, useEffect, Fragment } from 'react'
import api from '../services/api'
import '../App.css'

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
      <div className="flex flex-col h-[500px] items-center justify-center text-center p-8">
        <div className="animate-bounce mb-4 text-5xl">🎯</div>
        <p className="text-xl font-bold gradient-text mb-2">Select a Knowledge Source</p>
        <p className="text-emerald-100">Pick a Document or Collection to begin your intelligent conversation.</p>
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
              className="inline-flex items-center justify-center mx-1 px-2 py-1 bg-emerald-500 text-white hover:bg-emerald-500 text-xs font-bold rounded-lg cursor-pointer transition-all duration-300 hover:scale-110"
              style={{boxShadow: '0 0 15px rgba(0, 229, 153, 0.4)'}}
              title={`View Source ${citationNum}`}
            >
              {part}
            </button>
          )
        }
      }
      return <Fragment key={i}>{part}</Fragment>
    })
  }

  return (
    <div className={`flex h-[calc(100vh-220px)] bg-gradient-to-b from-[#141D21] to-[#0B1215] overflow-hidden transition-all duration-300 ${activeSource ? '' : ''}`}>
      <div className={`flex flex-col flex-1 transition-all duration-300 ${activeSource ? 'w-2/3' : 'w-full'}`}>
        {/* Chat Header */}
        <div className="border-b border-emerald-500/30 p-6 flex flex-col glass-effect-light">
          <h2 className="text-3xl font-bold gradient-text mb-2">💬 NEURAL DIALOGUE</h2>
          <p className="text-emerald-100/70 text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" style={{boxShadow: '0 0 10px #00C2FF'}}></span>
            Context: <span className="font-semibold text-emerald-100">
              {collectionTitle ? `Collection • ${collectionTitle}` : `Document • ${documentTitle}`}
            </span>
          </p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <div className="text-6xl mb-4 animate-bounce">⚡</div>
                <p className="text-emerald-100 text-lg font-bold">INITIALIZE CONVERSATION</p>
                <p className="text-cyan-300/60 text-sm mt-2">Neural network awaiting input...</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`} style={{animationDelay: `${idx * 50}ms`}}>
                <div className={`max-w-[80%] p-4 rounded-2xl backdrop-blur-md transition-all duration-300 ${
                  msg.type === 'user'
                    ? 'bg-emerald-500 text-white shadow-lg border border-emerald-500 font-semibold'
                    : 'glass-effect-light text-emerald-100 border border-emerald-400/30 hover:border-emerald-400/60'
                }`} style={msg.type === 'user' ? {boxShadow: '0 0 30px rgba(0, 229, 153, 0.4)'} : {}}>
                  <p className="whitespace-pre-wrap leading-relaxed font-medium">
                    {msg.type === 'assistant' ? renderMessageContent(msg.content, msg.sources) : msg.content}
                  </p>

                  {msg.sources && msg.sources.length > 0 && msg.type === 'assistant' && (
                    <div className="mt-4 pt-4 border-t border-emerald-400/20 text-xs text-cyan-300/80 flex flex-wrap gap-2">
                       <span className="font-bold text-emerald-100 block w-full">📚 SOURCES:</span>
                       {msg.sources.map((src, i) => (
                         <button
                           key={i}
                           onClick={() => setActiveSource(src)}
                           className="bg-[#141D21]/80 hover:bg-slate-700/70 px-3 py-1.5 rounded-lg border border-emerald-400/30 hover:border-emerald-400/60 transition-all duration-200 hover:shadow-lg"
                           style={{boxShadow: 'hover: 0 0 15px rgba(0, 229, 153, 0.3)'}}
                         >
                           [{src.citation_number}] {src.document_title} • Page {src.page_number ?? 'N/A'}
                         </button>
                       ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start animate-slide-up">
              <div className="glass-effect-light border border-emerald-400/30 rounded-2xl p-4" style={{boxShadow: '0 0 20px rgba(0, 229, 153, 0.2)'}}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
                  </div>
                  <span className="text-emerald-100 font-bold">PROCESSING DATA...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-emerald-100 text-center text-sm p-4 bg-purple-400/10 border border-emerald-400/30 rounded-2xl font-bold">
              ⚠️ SYSTEM ERROR: {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Reasoning Section */}
        {reasoning.length > 0 && (
          <div className="border-t border-emerald-400/30 bg-[#0B1215]/50 p-4">
             <button
               onClick={() => setShowReasoning(!showReasoning)}
               className="text-sm font-bold text-emerald-100 hover:text-purple-200 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-emerald-400/10 transition-all"
             >
               <span className={`transform transition-transform ${showReasoning ? 'rotate-90' : ''}`}>▶</span>
               PROCESS LOG ({reasoning.length})
             </button>
             {showReasoning && (
               <div className="text-xs font-mono mt-3 p-3 mx-2 bg-black/50 rounded-xl max-h-40 overflow-y-auto space-y-1 border border-emerald-400/20 text-cyan-300/80">
                 {reasoning.map((r, i) => (
                   <div key={i} className="hover:text-emerald-100 transition-colors">
                     <span className="text-emerald-100">→</span> {r}
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t border-emerald-400/30 p-6 bg-[#0B1215]/50 flex gap-3 backdrop-blur">
           <input
             type="text"
             value={input}
             onChange={e => setInput(e.target.value)}
             disabled={loading}
             placeholder="SEND MESSAGE..."
             className="flex-1 px-4 py-3 bg-[#141D21]/80 text-emerald-100 placeholder-cyan-300/50 border border-emerald-400/30 rounded-xl outline-none focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20 transition-all duration-300 font-bold"
           />
           <button
             type="submit"
             disabled={loading || !input.trim()}
             className="px-8 py-3 bg-emerald-500 text-white font-bold rounded-xl disabled:opacity-40 hover:shadow-lg transition-all duration-300 border border-emerald-500"
             style={{boxShadow: '0 0 20px rgba(0, 229, 153, 0.3)'}}
           >
             SEND
           </button>
        </form>
      </div>

      {/* Source Viewer Panel */}
      {activeSource && (
        <div className="w-1/3 glass-effect-light flex flex-col border-l border-emerald-400/30 shadow-2xl overflow-hidden animate-slide-in-right">
           <div className="p-5 border-b border-emerald-400/30 bg-gradient-to-r from-purple-600/20 to-purple-500/20 flex justify-between items-center">
             <h3 className="font-bold gradient-text text-lg">📖 SOURCE DETAILS</h3>
             <button
               onClick={() => setActiveSource(null)}
               className="text-emerald-100 hover:text-purple-200 hover:bg-red-500/20 rounded-lg w-8 h-8 flex items-center justify-center transition-all duration-200 font-bold"
               title="Close Panel"
             >
               ✕
             </button>
           </div>
           <div className="p-6 overflow-y-auto flex-1 space-y-6">
             <div className="pb-4 border-b border-emerald-400/20">
               <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-widest mb-2">Document</h4>
               <p className="text-lg text-emerald-100 font-semibold">{activeSource.document_title || `Document #${activeSource.document_id}`}</p>
             </div>

             <div className="flex justify-between gap-4">
               <div>
                 <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-widest mb-2">Page</h4>
                 <p className="text-2xl text-emerald-100 font-bold">{activeSource.page_number || 'N/A'}</p>
               </div>
               {activeSource.score !== undefined && (
                 <div>
                   <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-widest mb-2">Relevance</h4>
                   <div className="flex items-center gap-2">
                     <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm" style={{boxShadow: '0 0 20px rgba(0, 229, 153, 0.4)'}}>
                       {Math.round(activeSource.score * 100)}%
                     </div>
                   </div>
                 </div>
               )}
             </div>

             <div>
               <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-widest mb-3">Extracted Content</h4>
               <div className="bg-[#0B1215]/50 border border-emerald-400/20 rounded-xl p-4 font-serif text-sm leading-relaxed text-emerald-100 relative overflow-hidden">
                 <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 to-purple-600"></div>
                 <div className="pl-3">{activeSource.text_preview || activeSource.text}</div>
               </div>
             </div>
           </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        div.animate-slide-in-right {
          animation: slideInRight 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}