import { useState, useEffect } from 'react'
import api from '../services/api'

export default function DocumentUpload({ onSuccess }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const [collections, setCollections] = useState([])
  const [selectedCollectionId, setSelectedCollectionId] = useState('')

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      const response = await api.get('/collections/')
      const cols = response.data.results || response.data
      setCollections(cols)
      if (cols.length > 0) {
        setSelectedCollectionId(cols[0].id.toString())
      }
    } catch (err) {
      console.error('Failed to load collections', err)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      if (files[0].type === 'application/pdf') {
        setFile(files[0])
        setError('')
      } else {
        setError('Please upload a PDF file')
      }
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile)
        setError('')
        setSuccess(false)
      } else {
        setError('Please upload a PDF file')
        setFile(null)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }

    setUploading(true)
    setProgress(0)
    setError('')
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const titleFromFile = file.name.replace(/\.pdf$/i, '')
      formData.append('title', titleFromFile)

      if (selectedCollectionId) {
        formData.append('collection', selectedCollectionId)
      }

      await api.post('/documents/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          setProgress(percentCompleted)
        },
      })

      setSuccess(true)
      setFile(null)
      setProgress(100)

      setTimeout(() => {
        setSuccess(false)
        setProgress(0)
      }, 5000)

      onSuccess()
    } catch (err) {
      if (err.response?.status && err.response.status >= 400) {
        const errorMessage =
          err.response?.data?.detail ||
          err.response?.data?.error ||
          err.response?.data?.collection?.[0] ||
          'Upload failed. Please try again.'
        setError(errorMessage)
      } else if (err.message && err.message !== 'Network Error') {
        setError('Upload failed. Please try again.')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-semibold text-text-primary mb-1">Upload document</h2>
      <p className="text-text-secondary mb-8 text-sm">Add a PDF to build your knowledge base.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Collection Selector */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Target collection</label>
          <select
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
            className="w-full bg-white text-text-primary border border-border rounded-md px-3.5 py-2.5 outline-none transition-colors duration-150 focus:border-accent focus:ring-[3px] focus:ring-accent/10"
            disabled={collections.length === 0}
          >
            {collections.length === 0 ? (
              <option value="">No collections available (will use Default)</option>
            ) : (
              collections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            )}
          </select>
        </div>

        {/* Drag and Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors duration-150 ${
            dragActive ? 'border-accent bg-accent-light' : 'border-border hover:border-accent hover:bg-accent-light'
          }`}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <label
            htmlFor="file-input"
            className="cursor-pointer flex flex-col items-center gap-3"
          >
            <div>
              <p className="text-text-primary font-medium text-sm">
                Drop a file here
              </p>
              <p className="text-text-secondary text-sm mt-1">
                or <span className="text-accent font-medium">click to select</span>
              </p>
              <p className="text-text-muted text-xs mt-2">PDF format only</p>
            </div>
          </label>
        </div>

        {/* Selected File Display */}
        {file && (
          <div className="bg-white border border-border rounded-lg p-4">
            <p className="text-text-primary font-medium text-sm">{file.name}</p>
            <p className="text-text-secondary text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}

        {/* Error Message */}
        {error && !success && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-success font-medium text-sm mb-1">Upload successful</p>
            <p className="text-text-secondary text-sm">
              Processing started. Check "Documents" for status — it becomes available once marked <strong>Ready</strong>.
            </p>
          </div>
        )}

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-text-secondary">
                {uploading ? 'Uploading…' : 'Complete'}
              </p>
              <p className="text-sm text-text-secondary">{progress}%</p>
            </div>
            <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full bg-accent text-white py-2.5 rounded-md font-medium transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
        >
          {uploading ? `Uploading… ${progress}%` : 'Upload PDF'}
        </button>
      </form>
    </div>
  )
}
