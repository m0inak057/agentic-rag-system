import { useState, useEffect } from 'react'
import api from '../services/api'
import '../App.css'

export default function CollectionList({ onSelectCollection }) {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDesc, setNewCollectionDesc] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      setLoading(true)
      const response = await api.get('/collections/')
      setCollections(response.data.results || response.data)
      setError('')
    } catch (err) {
      setError('Failed to load collections')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newCollectionName.trim()) return

    setCreating(true)
    try {
      await api.post('/collections/', {
        name: newCollectionName,
        description: newCollectionDesc
      })
      setNewCollectionName('')
      setNewCollectionDesc('')
      fetchCollections()
    } catch (err) {
      setError('Failed to create collection')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this collection?')) return
    try {
      await api.delete(`/collections/${id}/`)
      fetchCollections()
    } catch (err) {
      setError('Failed to delete collection')
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="text-4xl mb-4 animate-spin">📁</div>
        <p className="text-emerald-100 font-bold">LOADING COLLECTIONS...</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold gradient-text">📁 MY COLLECTIONS</h2>
        <button
          onClick={fetchCollections}
          className="px-6 py-2.5 bg-emerald-500/20 text-emerald-100 font-bold rounded-xl hover:bg-emerald-500/30 border border-emerald-400/30 transition-all duration-300"
          style={{boxShadow: '0 0 15px rgba(0, 229, 153, 0.2)'}}
        >
          🔄 REFRESH
        </button>
      </div>

      {error && (
        <div className="glass-effect-light border border-red-500/50 rounded-2xl p-5 mb-8">
          <p className="text-red-400 font-bold flex items-center gap-2">
            <span>⚠️</span> {error}
          </p>
        </div>
      )}

      {/* Create new collection form */}
      <form onSubmit={handleCreate} className="glass-effect-light border border-emerald-400/30 rounded-2xl p-6 mb-8 space-y-3">
        <h3 className="text-lg font-bold gradient-text mb-4">✨ CREATE COLLECTION</h3>
        <input
          type="text"
          placeholder="Collection Name"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          className="w-full px-4 py-3 bg-[#141D21]/80 text-emerald-100 placeholder-cyan-300/50 border border-emerald-400/30 rounded-xl focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all font-bold"
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={newCollectionDesc}
          onChange={(e) => setNewCollectionDesc(e.target.value)}
          className="w-full px-4 py-3 bg-[#141D21]/80 text-emerald-100 placeholder-cyan-300/50 border border-emerald-400/30 rounded-xl focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all font-bold"
        />
        <button
          type="submit"
          disabled={creating || !newCollectionName.trim()}
          className="w-full px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:shadow-2xl disabled:opacity-50 transition-all duration-300 border border-yellow-300"
          style={{boxShadow: '0 0 20px rgba(0, 229, 153, 0.2)'}}
        >
          {creating ? '⚡ CREATING...' : '✨ CREATE'}
        </button>
      </form>

      {/* Collections List */}
      {collections.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4 animate-bounce">📁</div>
          <p className="text-emerald-100 text-xl font-bold">NO COLLECTIONS</p>
          <p className="text-emerald-100/60 mt-2">Create one above to organize your knowledge base</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((col, idx) => (
            <div
              key={col.id}
              className="glass-effect-light border border-emerald-400/30 rounded-2xl p-6 hover:border-emerald-400/60 transition-all duration-300 flex flex-col justify-between animate-slide-up"
              style={{animationDelay: `${idx * 50}ms`, boxShadow: '0 0 20px rgba(0, 229, 153, 0.1)'}}
            >
              <div>
                <h3 className="font-bold text-lg text-emerald-100 mb-2 flex items-center gap-2">
                  <span>🗂️</span> {col.name}
                </h3>
                <p className="text-emerald-100/70 text-sm mb-4 min-h-10 line-clamp-2">
                  {col.description || 'No description'}
                </p>
                <div className="text-sm bg-emerald-500/20 text-emerald-100 px-3 py-1.5 rounded-lg inline-block font-bold border border-emerald-400/30">
                  📊 {col.document_count} Documents
                </div>
              </div>

              <div className="flex justify-between items-center gap-2 pt-5 border-t border-emerald-400/20 mt-5">
                <button
                  onClick={() => onSelectCollection?.({ id: col.id, title: col.name })}
                  className="flex-1 px-4 py-2.5 bg-emerald-500 text-black font-bold text-sm rounded-lg shadow-lg transition-all duration-300 border border-yellow-300"
                  style={{boxShadow: '0 0 15px rgba(0, 229, 153, 0.3)'}}
                >
                  💬 CHAT
                </button>
                <button
                  onClick={() => handleDelete(col.id)}
                  className="px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-red-500/30 font-bold text-sm transition-all duration-300"
                  title="Delete collection"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
