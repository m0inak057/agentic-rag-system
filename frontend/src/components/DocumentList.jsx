import { useState, useEffect } from 'react'
import api from '../services/api'
import '../App.css'

export default function DocumentList({ onSelectDocument }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDocuments()

    const pollInterval = setInterval(() => {
      setDocuments(prev => {
        const hasProcessing = prev.some(d => d.status === 'processing' || d.status === 'pending')
        if (hasProcessing) {
          fetchDocuments()
        }
        return prev
      })
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await api.get('/documents/')
      setDocuments(response.data.results || response.data)
      setError('')
    } catch (err) {
      setError('Failed to load documents')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (doc) => {
    const statusMap = {
      ready:      { emoji: '✨', label: 'Ready',      classes: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100 font-bold' },
      processing: { emoji: '⚡', label: 'Processing', classes: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100 font-bold animate-pulse' },
      pending:    { emoji: '⏳', label: 'Pending',    classes: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100 font-bold animate-pulse' },
      failed:     { emoji: '✗', label: 'Failed',      classes: 'bg-red-500/20 border-red-400/50 text-red-300 font-bold' },
    }
    const s = statusMap[doc.status] || { emoji: '?', label: doc.status, classes: 'bg-zinc-700/50 border-emerald-400/30 text-emerald-100' }
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-sm border ${s.classes}`}>
        {s.emoji} {s.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block">
          <div className="text-4xl mb-4 animate-spin">📚</div>
          <p className="text-emerald-100 font-bold">RETRIEVING DOCUMENTS...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="glass-effect-light border border-red-500/50 rounded-2xl p-6">
          <p className="text-red-400 font-bold mb-4 flex items-center gap-2">
            <span>⚠️</span> {error}
          </p>
          <button
            onClick={fetchDocuments}
            className="px-6 py-2 bg-emerald-500 text-black rounded-xl hover-glow transition-all font-bold"
          >
            🔄 RETRY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold gradient-text">📚 MY DOCUMENTS</h2>
        <button
          onClick={fetchDocuments}
          className="px-6 py-2.5 bg-emerald-500/20 text-emerald-100 font-bold rounded-xl hover:bg-emerald-500/30 border border-emerald-400/30 transition-all duration-300"
          style={{boxShadow: '0 0 15px rgba(0, 229, 153, 0.2)'}}
        >
          🔄 REFRESH
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4 animate-bounce">📄</div>
          <p className="text-emerald-100 text-xl font-bold">NO DOCUMENTS</p>
          <p className="text-emerald-100/60">Upload PDFs to initialize knowledge base</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc, idx) => (
            <div
              key={doc.id}
              className="glass-effect-light border border-emerald-400/30 rounded-2xl p-5 hover:border-emerald-400/60 transition-all duration-300 animate-slide-up"
              style={{animationDelay: `${idx * 50}ms`, boxShadow: '0 0 20px rgba(0, 229, 153, 0.1)'}}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-emerald-100 mb-2 truncate">📖 {doc.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-emerald-100/70">
                    <span className="flex items-center gap-1">
                      <span>📊</span> {doc.chunks_count ?? 0} chunks
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📅</span> {new Date(doc.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>{getStatusBadge(doc)}</div>
                  {doc.status === 'ready' ? (
                    <button
                      onClick={() => onSelectDocument?.({ id: doc.id, title: doc.title })}
                      className="px-5 py-2.5 bg-emerald-500 text-black font-bold text-sm rounded-xl shadow-lg transition-all duration-300 border border-yellow-300"
                      style={{boxShadow: '0 0 20px rgba(0, 229, 153, 0.3)'}}
                    >
                      💬 CHAT
                    </button>
                  ) : (
                    <span className="text-emerald-100/50 text-sm font-bold">LOCKED</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block">
          <div className="text-4xl mb-4 animate-spin">📚</div>
          <p className="text-emerald-100 font-semibold">Loading your documents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="glass-effect-light border border-red-500/50 rounded-2xl p-6">
          <p className="text-red-400 font-bold mb-4 flex items-center gap-2">
            <span>⚠️</span> {error}
          </p>
          <button
            onClick={fetchDocuments}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover-glow transition-all font-semibold"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold gradient-text">📚 My Documents</h2>
        <button
          onClick={fetchDocuments}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-cyan-300 font-bold rounded-xl hover:from-blue-600/40 hover:to-cyan-600/40 border border-cyan-400/30 transition-all duration-300 hover-glow"
        >
          🔄 Refresh
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4 animate-bounce">📄</div>
          <p className="text-emerald-100 text-xl font-semibold mb-2">No documents yet</p>
          <p className="text-slate-400">Upload a PDF to start building your knowledge base</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc, idx) => (
            <div
              key={doc.id}
              className="glass-effect-light border border-cyan-400/30 rounded-2xl p-5 hover:border-cyan-400/60 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 animate-slide-up"
              style={{animationDelay: `${idx * 50}ms`}}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-100 mb-2 truncate">📖 {doc.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <span>📊</span> {doc.chunks_count ?? 0} chunks
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📅</span> {new Date(doc.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>{getStatusBadge(doc)}</div>
                  {doc.status === 'ready' ? (
                    <button
                      onClick={() => onSelectDocument?.({ id: doc.id, title: doc.title })}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-sm rounded-xl hover-glow shadow-lg transition-all duration-300 border border-blue-400/30"
                    >
                      💬 Chat
                    </button>
                  ) : (
                    <span className="text-slate-500 text-sm font-medium">Unavailable</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
