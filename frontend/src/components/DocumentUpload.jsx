import { useState, useEffect } from 'react'
import api from '../services/api'
import '../App.css'

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
    <div className="p-8">
      <h2 className="text-3xl font-bold gradient-text mb-2">📤 UPLOAD DOCUMENT</h2>
      <p className="text-emerald-100/70 mb-8 font-semibold">Add PDF files to initialize knowledge matrix</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Collection Selector */}
        <div>
          <label className="block text-sm font-bold text-emerald-100 mb-2 uppercase tracking-wide">🗂️ TARGET COLLECTION</label>
          <select
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
            className="w-full bg-[#141D21]/80 text-emerald-100 border border-emerald-400/30 rounded-xl p-3 focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all font-bold"
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
          className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 ${
            dragActive
              ? 'border-emerald-400 bg-emerald-500/10 scale-105'
              : 'border-emerald-400/30 hover:border-emerald-400/60 hover:bg-zinc-800/20'
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
            className="cursor-pointer flex flex-col items-center gap-4"
          >
            <div className="text-5xl animate-bounce">📄</div>
            <div>
              <p className="text-emerald-100 font-bold text-lg">
                DROP FILE HERE
              </p>
              <p className="text-emerald-100/70 text-sm mt-1">
                or <span className="text-emerald-100 font-bold hover:underline">CLICK TO SELECT</span>
              </p>
              <p className="text-emerald-100/60 text-xs mt-2">PDF FORMAT ONLY</p>
            </div>
          </label>
        </div>

        {/* Selected File Display */}
        {file && (
          <div className="glass-effect-light border border-emerald-400/50 rounded-2xl p-5 animate-scale-in">
            <p className="text-emerald-100 font-bold flex items-center gap-2">
              <span>✅</span> {file.name}
            </p>
            <p className="text-emerald-100/70 text-sm mt-1">📊 {(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}

        {/* Error Message */}
        {error && !success && (
          <div className="glass-effect-light border border-red-500/50 rounded-2xl p-5 animate-shake">
            <p className="text-red-400 font-bold flex items-center gap-2">
              <span>⚠️</span> {error}
            </p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="glass-effect-light border border-emerald-400/50 rounded-2xl p-5 animate-scale-in">
            <p className="text-emerald-100 font-bold mb-2">🎉 UPLOAD SUCCESSFUL!</p>
            <p className="text-emerald-100/80 text-sm mb-1">
              <strong>{file?.name || 'Document'}</strong> processing initiated.
            </p>
            <p className="text-emerald-100/80 text-sm">
              Check "My Documents" for status. Status: <strong>Ready</strong> when processing complete.
            </p>
          </div>
        )}

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-2">
              <p className="text-sm font-bold text-emerald-100">
                {uploading ? `UPLOADING... ${progress}%` : '✨ COMPLETE!'}
              </p>
              <p className="text-sm text-emerald-100 font-bold">{progress}%</p>
            </div>
            <div className="w-full h-3 bg-zinc-700/50 rounded-full overflow-hidden border border-emerald-400/30">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress === 100
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-yellow-400 to-yellow-300'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full bg-emerald-500 text-black py-4 rounded-xl font-bold hover:shadow-2xl disabled:opacity-40 transition-all duration-300 border border-yellow-300 text-lg"
          style={{boxShadow: '0 0 30px rgba(0, 229, 153, 0.2)'}}
        >
          {uploading ? `⚡ UPLOADING... ${progress}%` : '🚀 UPLOAD PDF'}
        </button>
      </form>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  )
}
