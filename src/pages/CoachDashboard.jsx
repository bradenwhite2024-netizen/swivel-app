import { supabase } from '../supabase'

export default function CoachDashboard({ profile }) {
  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff',fontFamily:'sans-serif',padding:'2rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'2rem'}}>
        <h1 style={{fontSize:'22px',fontWeight:'700'}}>SWIVEL</h1>
        <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
          <span style={{color:'#666',fontSize:'14px'}}>{profile?.full_name || 'Coach'}</span>
          <button onClick={() => supabase.auth.signOut()} style={{padding:'6px 14px',background:'transparent',border:'1px solid #333',borderRadius:'6px',color:'#aaa',fontSize:'13px',cursor:'pointer'}}>Sign out</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'2rem'}}>
        {['Team Stats','Film Sessions','Season Trends','Scouting'].map(tab => (
          <div key={tab} style={{background:'#111',border:'1px solid #222',borderRadius:'8px',padding:'14px',textAlign:'center',fontSize:'14px',color:'#aaa',cursor:'pointer'}}>
            {tab}
          </div>
        ))}
      </div>
      <div style={{background:'#111',border:'1px solid #222',borderRadius:'12px',padding:'2rem',textAlign:'center',color:'#444'}}>
        Coach dashboard — coming soon
      </div>
    </div>
  )
}