import { supabase } from '../supabase'

export default function CoachDashboard({ profile }) {
  return (
    <div style={{minHeight:'100vh',background:'#0a0a0f',display:'flex',flexDirection:'column'}}>
      <div style={{height:'48px',display:'flex',alignItems:'center',gap:'12px',padding:'0 20px',background:'rgba(10,10,15,0.95)',borderBottom:'1px solid rgba(255,255,255,0.07)',position:'sticky',top:0,zIndex:200,flexShrink:0}}>
        <span style={{fontSize:'18px',fontWeight:'900',letterSpacing:'6px',color:'#F5A030'}}>SWIVEL</span>
        <div style={{width:'1px',height:'24px',background:'rgba(255,255,255,0.12)'}}/>
        <span style={{fontSize:'11px',color:'rgba(212,200,168,0.45)',flex:1}}>{profile?.full_name || 'Coach'}</span>
        <button onClick={() => supabase.auth.signOut()} style={{padding:'5px 12px',background:'transparent',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'6px',color:'rgba(212,200,168,0.45)',fontSize:'11px',cursor:'pointer',fontFamily:'Georgia,serif'}}>Sign out</button>
      </div>
      <iframe
        src="/swivel.html"
        style={{flex:1,border:'none',width:'100%',height:'calc(100vh - 48px)'}}
        title="Swivel Analytics"
      />
    </div>
  )
}