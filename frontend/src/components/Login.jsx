import React, { useState } from 'react'
import { Lock, Mail, User, ShieldCheck } from 'lucide-react'

export default function Login({ onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (isRegister) {
      if (!username || !email || !password) {
        setError('Please fill in all fields')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
    } else {
      if (!email || !password) {
        setError('Please fill in all fields')
        return
      }
    }

    setLoading(true)
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
    const body = isRegister ? { username, email, password } : { email, password }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      // Store in localStorage
      localStorage.setItem('notes_token', data.token)
      localStorage.setItem('notes_user', JSON.stringify(data.user))
      
      onAuthSuccess(data.user, data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="logo" style={{ justifyContent: 'center', marginBottom: '24px' }}>
          📝 <span>RetroNotes</span>
        </div>
        
        <h2 className="login-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
        <p className="login-subtitle">
          {isRegister ? 'Sign up to start drafting and visualizing notes with AI' : 'Sign in to access your digital workspace'}
        </p>

        {error && (
          <div 
            style={{ 
              backgroundColor: '#ffebee', 
              color: '#d32f2f', 
              padding: '12px', 
              borderRadius: '6px', 
              border: '2px solid #d32f2f', 
              marginBottom: '20px', 
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#888' }} />
                <input
                  id="username"
                  type="text"
                  className="input-field"
                  placeholder="e.g. John Doe"
                  style={{ paddingLeft: '48px' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#888' }} />
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="you@example.com"
                style={{ paddingLeft: '48px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#888' }} />
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                style={{ paddingLeft: '48px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#888' }} />
                <input
                  id="confirmPassword"
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  style={{ paddingLeft: '48px' }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isRegister ? 'Register & Open Folder' : 'Unlock Notebook'}
          </button>
        </form>

        <div className="login-toggle">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <span onClick={() => { setIsRegister(false); setError(''); }}>Sign In</span>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <span onClick={() => { setIsRegister(true); setError(''); }}>Create One</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
