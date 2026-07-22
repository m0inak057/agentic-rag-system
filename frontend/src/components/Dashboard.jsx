import { useState } from 'react'
import DocumentUpload from './DocumentUpload'
import DocumentList from './DocumentList'
import CollectionList from './CollectionList'
import Chat from './Chat'

const tabs = [
  { id: 'chat', label: 'Chat' },
  { id: 'upload', label: 'Upload' },
  { id: 'documents', label: 'Documents' },
  { id: 'collections', label: 'Collections' },
]

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('chat')
  const [refreshDocuments, setRefreshDocuments] = useState(0)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [selectedCollection, setSelectedCollection] = useState(null)

  const handleDocumentUploaded = () => {
    setRefreshDocuments((prev) => prev + 1)
    setActiveTab('documents')
  }

  const handleDocumentSelect = (doc) => {
    setSelectedDocument(doc)
    setSelectedCollection(null)
    setActiveTab('chat')
  }

  const handleCollectionSelect = (col) => {
    setSelectedCollection(col)
    setSelectedDocument(null)
    setActiveTab('chat')
  }

  const initials = (user || '?').slice(0, 2).toUpperCase()
  const activeContext = selectedCollection
    ? `Collection · ${selectedCollection.title}`
    : selectedDocument
    ? `Document · ${selectedDocument.title}`
    : null

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Sidebar */}
      <aside className="w-64 bg-bg-secondary border-r border-border flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-border">
          <h1 className="text-lg font-semibold text-text-primary">RAG Assistant</h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 border-l-2 ${
                  isActive
                    ? 'text-accent bg-accent-light border-accent'
                    : 'text-text-secondary border-transparent hover:bg-bg-tertiary'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-accent-light border border-accent-border text-accent text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </span>
            <span className="text-sm text-text-primary font-medium truncate">{user}</span>
          </div>
          <button
            onClick={onLogout}
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-150 shrink-0"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {activeContext && (
          <div className="px-8 py-3 border-b border-border bg-bg-secondary">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-accent-light border border-accent-border text-accent text-xs font-medium">
              {activeContext}
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {activeTab === 'chat' && (
            <Chat
              documentId={selectedDocument?.id ?? null}
              documentTitle={selectedDocument?.title ?? null}
              collectionId={selectedCollection?.id ?? null}
              collectionTitle={selectedCollection?.title ?? null}
            />
          )}
          {activeTab === 'upload' && (
            <DocumentUpload onSuccess={handleDocumentUploaded} />
          )}
          {activeTab === 'documents' && (
            <DocumentList
              key={refreshDocuments}
              onSelectDocument={handleDocumentSelect}
            />
          )}
          {activeTab === 'collections' && (
            <CollectionList
              onSelectCollection={handleCollectionSelect}
            />
          )}
        </div>
      </main>
    </div>
  )
}
