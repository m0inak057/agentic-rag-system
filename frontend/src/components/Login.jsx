import { useState } from 'react'
import api from '../services/api'
import '../App.css'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const resetForm = () => {
    setUsername('')
    setEmail('')
    setPassword('')
    setPasswordConfirm('')
    setError('')
  }

  const toggleMode = () => {
    resetForm()
    setMode(mode === 'login' ? 'register' : 'login')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const response = await api.post('/auth/token/', {
          username,
          password,
        })
        onLogin(response.data.access, username)
      } else {
        const response = await api.post('/auth/register/', {
          username,
          email,
          password,
          password_confirm: passwordConfirm,
        })
        onLogin(response.data.access, response.data.username)
      }
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const messages = Object.entries(data)
          .map(([field, msgs]) =>
            Array.isArray(msgs) ? `${field}: ${msgs.join(', ')}` : `${field}: ${msgs}`
          )
          .join(' | ')
        setError(messages || 'Something went wrong.')
      } else {
        setError('Network error. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1215] via-[#141D21] to-[#0B1215] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 left-10 w-72 h-72 rounded-full mix-blend-screen filter blur-3xl opacity-15 animate-pulse" style={{background: '#7C3AED'}}></div>
      <div className="absolute -bottom-8 right-10 w-72 h-72 rounded-full mix-blend-screen filter blur-3xl opacity-15 animate-pulse" style={{animationDelay: '2s', background: '#A855F7'}}></div>
      <div className="absolute top-1/2 left-1/2 w-72 h-72 rounded-full mix-blend-screen filter blur-3xl opacity-15 animate-pulse" style={{animationDelay: '4s', background: '#7C3AED'}}></div>

      {/* Login Card */}
      <div className="glass-effect rounded-3xl w-full max-w-md p-8 border border-emerald-500/30 shadow-2xl animate-scale-in relative z-10" style={{boxShadow: '0 0 40px rgba(0, 229, 153, 0.15)'}}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 animate-bounce">⚡</div>
          <h1 className="text-4xl font-bold gradient-text mb-2">RAG NEXUS</h1>
          <p className="text-emerald-100/70 text-sm font-bold">
            {mode === 'login' ? 'NEURAL ACCESS' : 'INITIALIZE ACCOUNT'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-2xl animate-shake">
              <p className="text-emerald-100 text-sm font-bold flex items-center gap-2">
                <span>⚠️</span> {error}
              </p>
            </div>
          )}

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-bold text-emerald-100 mb-2 uppercase tracking-wide">
              👤 USERNAME
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#141D21]/80 text-emerald-100 placeholder-cyan-300/50 border border-emerald-400/30 rounded-xl focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all duration-300 font-bold"
              placeholder="Enter username"
            />
          </div>

          {/* Email (register only) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-emerald-100 mb-2 uppercase tracking-wide">
                📧 EMAIL <span className="text-emerald-100/60 font-normal text-xs">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#141D21]/80 text-emerald-100 placeholder-cyan-300/50 border border-emerald-400/30 rounded-xl focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all duration-300 font-bold"
                placeholder="you@example.com"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-bold text-emerald-100 mb-2 uppercase tracking-wide">
              🔐 PASSWORD
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
              className="w-full px-4 py-3 bg-[#141D21]/80 text-emerald-100 placeholder-cyan-300/50 border border-emerald-400/30 rounded-xl focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all duration-300 font-bold"
              placeholder={mode === 'register' ? 'Min. 8 chars' : 'Enter password'}
            />
          </div>

          {/* Confirm Password (register only) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="password-confirm" className="block text-sm font-bold text-emerald-100 mb-2 uppercase tracking-wide">
                ✓ CONFIRM
              </label>
              <input
                id="password-confirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#141D21]/80 text-emerald-100 placeholder-cyan-300/50 border border-emerald-400/30 rounded-xl focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all duration-300 font-bold"
                placeholder="Re-enter password"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold hover:shadow-2xl disabled:opacity-50 transition-all duration-300 border border-emerald-500 text-lg mt-6"
            style={{boxShadow: '0 0 30px rgba(0, 229, 153, 0.3)'}}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⚡</span>
                {mode === 'login' ? 'ACCESS GRANTED...' : 'CREATING...'}
              </span>
            ) : (
              <span>{mode === 'login' ? '⚡ ENTER SYSTEM' : '✨ CREATE ACCOUNT'}</span>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <p className="text-center text-emerald-100/60 text-sm mt-8 flex items-center justify-center gap-2">
          {mode === 'login' ? 'NEW USER?' : 'EXISTING USER?'}
          <button
            type="button"
            onClick={toggleMode}
            className="text-emerald-100 hover:text-purple-200 font-bold transition-colors"
          >
            {mode === 'login' ? 'REGISTER' : 'LOGIN'}
          </button>
        </p>
      </div>

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
