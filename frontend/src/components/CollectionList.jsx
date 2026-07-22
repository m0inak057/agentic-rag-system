import { useState, useEffect } from 'react'
import api from '../services/api'
import Spinner from './Spinner'

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
      <div className="p-12 flex justify-center">
        <Spinner />
      </div>
    )
  }

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white text-text-primary placeholder-text-muted border border-border rounded-md outline-none transition-colors duration-150 focus:border-accent focus:ring-[3px] focus:ring-accent/10'

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-text-primary">Collections</h2>
        <button
          onClick={fetchCollections}
          className="px-4 py-2 bg-white text-text-primary font-medium text-sm rounded-md border border-border transition-colors duration-150 hover:bg-bg-secondary"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {/* Create new collection form */}
      <form onSubmit={handleCreate} className="bg-white border border-border rounded-lg p-6 mb-8 space-y-3 max-w-xl">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Create collection</h3>
        <input
          type="text"
          placeholder="Collection name"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={newCollectionDesc}
          onChange={(e) => setNewCollectionDesc(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={creating || !newCollectionName.trim()}
          className="px-5 py-2.5 bg-accent text-white font-medium text-sm rounded-md transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {/* Collections List */}
      {collections.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-primary font-medium">No collections yet</p>
          <p className="text-text-secondary text-sm mt-1">Create one above to organize your knowledge base</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((col) => (
            <div
              key={col.id}
              className="bg-white border border-border rounded-lg p-5 flex flex-col justify-between"
            >
              <div>
                <h3 className="font-semibold text-sm text-text-primary mb-1.5">{col.name}</h3>
                <p className="text-text-secondary text-sm mb-4 min-h-10 line-clamp-2">
                  {col.description || 'No description'}
                </p>
                <div className="text-xs bg-bg-tertiary text-text-secondary px-2.5 py-1 rounded-md inline-block border border-border">
                  {col.document_count} documents
                </div>
              </div>

              <div className="flex justify-between items-center gap-2 pt-4 border-t border-border mt-4">
                <button
                  onClick={() => onSelectCollection?.({ id: col.id, title: col.name })}
                  className="flex-1 px-4 py-2 bg-accent text-white font-medium text-sm rounded-md transition-colors duration-150 hover:bg-accent-hover"
                >
                  Chat
                </button>
                <button
                  onClick={() => handleDelete(col.id)}
                  className="px-3 py-2 text-error hover:bg-red-50 rounded-md border border-border text-sm transition-colors duration-150"
                  title="Delete collection"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
