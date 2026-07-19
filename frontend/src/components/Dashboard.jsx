import { useState } from 'react'
import DocumentUpload from './DocumentUpload'
import DocumentList from './DocumentList'
import CollectionList from './CollectionList'
import Chat from './Chat'
import '../App.css'

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('chat')
  const [refreshDocuments, setRefreshDocuments] = useState(0)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [navExpanded, setNavExpanded] = useState(false)

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

  const tabs = [
    { id: 'chat', label: 'Chat', icon: '💬', desc: 'Ask Questions' },
    { id: 'upload', label: 'Upload', icon: '📤', desc: 'Add Files' },
    { id: 'documents', label: 'Documents', icon: '📚', desc: 'My Docs' },
    { id: 'collections', label: 'Collections', icon: '📁', desc: 'Groups' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1215] via-[#141D21] to-[#0B1215] overflow-hidden relative">
      {/* Animated neon background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-pulse" style={{background: '#00E599'}}></div>
      <div className="absolute top-1/3 right-0 w-96 h-96 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-pulse" style={{animationDelay: '2s', background: '#00C2FF'}}></div>
      <div className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-pulse" style={{animationDelay: '4s', background: '#00E599'}}></div>

      {/* Header */}
      <header className="glass-effect-light border-b border-emerald-500/30 sticky top-0 z-40 animate-slide-down">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex-1">
            <h1 className="text-3xl font-bold gradient-text mb-1">⚡ RAG NEXUS</h1>
            <p className="text-emerald-100/70 text-sm flex items-center gap-3">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" style={{boxShadow: '0 0 10px #00C2FF'}}></span>
              {user} • Neural Access Active
              {selectedDocument && (
                <span className="ml-2 px-3 py-1 bg-emerald-500/10 border border-emerald-400/50 rounded-full text-emerald-100 text-xs font-bold">
                  📄 {selectedDocument.title}
                </span>
              )}
              {selectedCollection && (
                <span className="ml-2 px-3 py-1 bg-emerald-500/10 border border-emerald-400/50 rounded-full text-emerald-100 text-xs font-bold">
                  📁 {selectedCollection.title}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="px-6 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 shadow-lg border border-emerald-500"
            style={{boxShadow: '0 0 20px rgba(0, 229, 153, 0.3)'}}
          >
            EXIT SYSTEM
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Content Area */}
        <div className="glass-effect rounded-2xl overflow-hidden shadow-2xl animate-scale-in border border-emerald-500/30" style={{boxShadow: '0 0 50px rgba(0, 229, 153, 0.1)'}}>
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
      </div>

      {/* Floating Creative Navigation - Bottom Right Corner */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setNavExpanded(!navExpanded)}
          className="block"
          style={{
            animation: 'float-nav 3s ease-in-out infinite'
          }}
        >
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-2xl text-white hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-emerald-500"
            style={{boxShadow: '0 0 30px rgba(0, 229, 153, 0.6), 0 0 60px rgba(0, 229, 153, 0.3)'}}>
            {navExpanded ? '✕' : '≡'}
          </div>
        </button>

        {/* Circular Navigation Menu */}
        <div className="relative w-72 h-72 pointer-events-none" style={{marginTop: '-288px', marginLeft: '-144px'}}>
          {tabs.map((tab, idx) => {
            const angle = (idx * 360) / tabs.length - 90
            const radius = navExpanded ? 140 : 0
            const x = Math.cos((angle * Math.PI) / 180) * radius
            const y = Math.sin((angle * Math.PI) / 180) * radius

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setNavExpanded(false)
                }}
                className={`absolute w-14 h-14 rounded-full font-bold text-2xl flex items-center justify-center transition-all duration-500 border-2 border-emerald-500 left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-white scale-125'
                    : 'bg-[#0B1215] text-cyan-300 hover:bg-emerald-500/20'
                }`}
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  boxShadow: activeTab === tab.id
                    ? '0 0 40px rgba(0, 229, 153, 0.8), 0 0 80px rgba(0, 229, 153, 0.4)'
                    : '0 0 20px rgba(0, 229, 153, 0.3)'
                }}
                title={tab.label}
              >
                {tab.icon}
              </button>
            )
          })}
        </div>

        {/* Navigation Labels */}
        {navExpanded && (
          <div className="absolute w-72 h-72 pointer-events-none" style={{marginTop: '-288px', marginLeft: '-144px'}}>
            <div className="relative w-full h-full">
              {tabs.map((tab, idx) => {
                const angle = (idx * 360) / tabs.length - 90
                const radius = 170
                const x = Math.cos((angle * Math.PI) / 180) * radius
                const y = Math.sin((angle * Math.PI) / 180) * radius

                return (
                  <div
                    key={`label-${tab.id}`}
                    className="absolute text-center"
                    style={{
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                      left: '50%',
                      top: '50%'
                    }}
                  >
                    <div className="text-emerald-100 font-bold text-xs whitespace-nowrap">{tab.label}</div>
                    <div className="text-cyan-300/60 text-xs whitespace-nowrap">{tab.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes float-nav {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
      `}</style>
    </div>
  )
}
