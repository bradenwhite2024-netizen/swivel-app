import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0a0a0a',fontFamily:'sans-serif'}}>
      <div style={{background:'#111',padding:'2.5rem',borderRadius:'12px',width:'360px',border:'1px solid #222'}}>
        <h1 style={{color:'#fff',fontSize:'24px',fontWeight:'700',marginBottom:'8px',textAlign:'center'}}>SWIVEL</h1>
        <p style={{color:'#666',fontSize:'14px',textAlign:'center',marginBottom:'2rem'}}>Game Film Analytics</p>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:'1rem'}}>
            <label style={{color:'#aaa',fontSize:'13px',display:'block',marginBottom:'6px'}}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{width:'100%',padding:'10px 12px',background:'#1a1a1a',border:'1px solid #333',borderRadius:'8px',color:'#fff',fontSize:'14px',boxSizing:'border-box'}}
            />
          </div>
          <div style={{marginBottom:'1.5rem'}}>
            <label style={{color:'#aaa',fontSize:'13px',display:'block',marginBottom:'6px'}}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{width:'100%',padding:'10px 12px',background:'#1a1a1a',border:'1px solid #333',borderRadius:'8px',color:'#fff',fontSize:'14px',boxSizing:'border-box'}}
            />
          </div>
          {error && <p style={{color:'#f87171',fontSize:'13px',marginBottom:'1rem'}}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{width:'100%',padding:'11px',background:'#fff',color:'#000',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}