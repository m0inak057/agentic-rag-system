import { useState } from 'react'
import api from '../services/api'
import Spinner from './Spinner'

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

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white text-text-primary border border-border rounded-md outline-none placeholder-text-muted transition-colors duration-150 focus:border-accent focus:ring-[3px] focus:ring-accent/10'

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-border rounded-lg p-8 shadow-subtle">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary mb-1">RAG Assistant</h1>
          <p className="text-text-secondary text-sm">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={inputClass}
              placeholder="Enter username"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
                Email <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
              className={inputClass}
              placeholder={mode === 'register' ? 'Min. 8 characters' : 'Enter password'}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="password-confirm" className="block text-sm font-medium text-text-primary mb-1.5">
                Confirm password
              </label>
              <input
                id="password-confirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                className={inputClass}
                placeholder="Re-enter password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white py-2.5 rounded-md font-medium transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50 mt-2"
          >
            {loading && <Spinner className="border-white/30 border-t-white w-4 h-4" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-text-secondary text-sm mt-6">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="text-accent font-medium hover:text-accent-hover transition-colors duration-150"
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
