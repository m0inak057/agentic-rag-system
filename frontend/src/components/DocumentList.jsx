import { useState, useEffect } from 'react'
import api from '../services/api'
import Spinner from './Spinner'

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
      ready:      { label: 'Ready',      classes: 'bg-green-50 border-green-200 text-success' },
      processing: { label: 'Processing', classes: 'bg-accent-light border-accent-border text-accent' },
      pending:    { label: 'Pending',    classes: 'bg-bg-tertiary border-border text-text-secondary' },
      failed:     { label: 'Failed',     classes: 'bg-red-50 border-red-200 text-error' },
    }
    const s = statusMap[doc.status] || { label: doc.status, classes: 'bg-bg-tertiary border-border text-text-secondary' }
    return (
      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${s.classes}`}>
        {s.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-error mb-4 text-sm">{error}</p>
          <button
            onClick={fetchDocuments}
            className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium transition-colors duration-150 hover:bg-accent-hover"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-text-primary">Documents</h2>
        <button
          onClick={fetchDocuments}
          className="px-4 py-2 bg-white text-text-primary font-medium text-sm rounded-md border border-border transition-colors duration-150 hover:bg-bg-secondary"
        >
          Refresh
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-primary font-medium">No documents yet</p>
          <p className="text-text-secondary text-sm mt-1">Upload a PDF to start building your knowledge base</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-border rounded-lg p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary mb-1.5 truncate">{doc.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span>{doc.chunks_count ?? 0} chunks</span>
                    <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(doc)}
                  {doc.status === 'ready' ? (
                    <button
                      onClick={() => onSelectDocument?.({ id: doc.id, title: doc.title })}
                      className="px-4 py-2 bg-accent text-white font-medium text-sm rounded-md transition-colors duration-150 hover:bg-accent-hover"
                    >
                      Chat
                    </button>
                  ) : (
                    <span className="text-text-muted text-sm">Unavailable</span>
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
