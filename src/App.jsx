import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Login from './pages/Login'
import CoachDashboard from './pages/CoachDashboard'
import PlayerDashboard from './pages/PlayerDashboard'
import AdminTracker from './pages/AdminTracker'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'sans-serif',background:'#0a0a0f',color:'#F5A030'}}>Loading...</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/admin" element={
          !session ? <Navigate to="/login" /> :
          profile?.role === 'admin' ? <AdminTracker profile={profile} /> :
          <Navigate to="/dashboard" />
        } />
        <Route path="/dashboard" element={
          !session ? <Navigate to="/login" /> :
          profile?.role === 'admin' ? <Navigate to="/admin" /> :
          profile?.role === 'coach' ? <CoachDashboard profile={profile} /> :
          profile?.role === 'player' ? <PlayerDashboard profile={profile} /> :
          <div style={{padding:'2rem',fontFamily:'sans-serif'}}>No role assigned. Contact your admin.</div>
        } />
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App