import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function PlayerDashboard({ profile }) {
  const [activeTab, setActiveTab] = useState('mystats')
  const [reelClips, setReelClips] = useState([])

  const tabs = [
    { id: 'mystats', label: 'My Stats' },
    { id: 'teamview', label: 'Team View' },
    { id: 'highlights', label: 'Highlight Builder' },
  ]

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0f',display:'flex',flexDirection:'column',fontFamily:'Georgia,serif'}}>
      
      {/* Top nav */}
      <div style={{height:'48px',display:'flex',alignItems:'center',gap:'12px',padding:'0 20px',background:'rgba(10,10,15,0.95)',borderBottom:'1px solid rgba(255,255,255,0.07)',position:'sticky',top:0,zIndex:200,flexShrink:0}}>
        <span style={{fontSize:'18px',fontWeight:'900',letterSpacing:'6px',color:'#F5A030'}}>SWIVEL</span>
        <div style={{width:'1px',height:'24px',background:'rgba(255,255,255,0.12)'}}/>
        <span style={{fontSize:'11px',color:'rgba(212,200,168,0.45)',flex:1}}>{profile?.full_name || 'Player'} · #23</span>
        <button onClick={() => supabase.auth.signOut()} style={{padding:'5px 12px',background:'transparent',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'6px',color:'rgba(212,200,168,0.45)',fontSize:'11px',cursor:'pointer',fontFamily:'Georgia,serif'}}>Sign out</button>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:'2px',padding:'12px 20px 0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: activeTab===t.id ? '#7B1020' : 'none',
            border: 'none',
            borderBottom: activeTab===t.id ? '2px solid #E8820A' : '2px solid transparent',
            color: activeTab===t.id ? '#F5A030' : 'rgba(212,200,168,0.45)',
            fontFamily:'Georgia,serif',fontSize:'11px',fontWeight:'700',
            letterSpacing:'2px',padding:'8px 16px',cursor:'pointer',
            textTransform:'uppercase',transition:'all 0.15s',borderRadius:'6px 6px 0 0'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,padding:'20px'}}>
        
        {activeTab === 'mystats' && (
          <div>
            {/* Player hero card */}
            <div style={{background:'linear-gradient(135deg,rgba(123,16,32,0.4) 0%,rgba(16,16,24,0.95) 60%)',border:'1px solid rgba(232,130,10,0.22)',borderLeft:'4px solid #E8820A',borderRadius:'10px',padding:'24px 28px',marginBottom:'20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'24px',flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:'9px',letterSpacing:'5px',color:'#E8820A',textTransform:'uppercase',fontWeight:'700',marginBottom:'6px'}}>Player</div>
                  <div style={{fontSize:'42px',fontWeight:'900',color:'#EDE0C4',lineHeight:'1'}}>#23</div>
                  <div style={{fontSize:'14px',color:'rgba(212,200,168,0.6)',letterSpacing:'2px',marginTop:'4px'}}>{profile?.full_name || 'Test Player'} · Guard</div>
                </div>
                <div style={{width:'1px',height:'60px',background:'rgba(255,255,255,0.08)'}}/>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
                  {[['PPG','—'],['RPG','—'],['APG','—'],['SPG','—'],['BPG','—'],['TS%','—']].map(([l,v]) => (
                    <div key={l} style={{textAlign:'center'}}>
                      <div style={{fontSize:'8px',letterSpacing:'3px',color:'#E8820A',textTransform:'uppercase',fontWeight:'700',marginBottom:'4px'}}>{l}</div>
                      <div style={{fontSize:'22px',fontWeight:'900',color:'#EDE0C4'}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats will populate from database as games are tagged */}
            <div style={{background:'rgba(22,22,31,0.98)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'32px',textAlign:'center',color:'rgba(212,200,168,0.4)',fontSize:'13px',letterSpacing:'2px'}}>
              📊 Stats will appear here as games are tagged by the Swivel team<br/>
              <span style={{fontSize:'10px',opacity:0.6,letterSpacing:'1px',marginTop:'8px',display:'block'}}>Your season stats, shooting splits, and advanced metrics will all live here</span>
            </div>
          </div>
        )}

        {activeTab === 'teamview' && (
          <div style={{background:'rgba(22,22,31,0.98)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',overflow:'hidden'}}>
            <iframe
              src="/swivel.html"
              style={{width:'100%',height:'calc(100vh - 140px)',border:'none'}}
              title="Team Analytics"
            />
          </div>
        )}

        {activeTab === 'highlights' && (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'12px'}}>
              <div>
                <div style={{fontSize:'9px',letterSpacing:'4px',color:'#E8820A',textTransform:'uppercase',fontWeight:'700',marginBottom:'4px'}}>Highlight Reel Builder</div>
                <div style={{fontSize:'12px',color:'rgba(212,200,168,0.45)',letterSpacing:'1px'}}>Filter your tagged moments and build your recruiting reel</div>
              </div>
              <button style={{background:'#7B1020',border:'1px solid #E8820A',borderRadius:'8px',color:'#F5A030',fontFamily:'Georgia,serif',fontSize:'11px',fontWeight:'900',padding:'10px 20px',letterSpacing:'3px',cursor:'pointer',textTransform:'uppercase'}}>
                Generate Reel →
              </button>
            </div>

            {/* Filters */}
            <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
              {['All Games','Made Shots','Assists','Rebounds','Steals','Blocks'].map(f => (
                <button key={f} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',color:'rgba(212,200,168,0.6)',fontFamily:'Georgia,serif',fontSize:'10px',padding:'6px 14px',cursor:'pointer',letterSpacing:'1px'}}>
                  {f}
                </button>
              ))}
            </div>

            {/* Clips queue */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
              <div>
                <div style={{fontSize:'9px',letterSpacing:'3px',color:'#E8820A',textTransform:'uppercase',fontWeight:'700',marginBottom:'12px'}}>Your Clips</div>
                <div style={{background:'rgba(22,22,31,0.98)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'32px',textAlign:'center',color:'rgba(212,200,168,0.4)',fontSize:'12px',letterSpacing:'1px'}}>
                  Clips will appear here as games are tagged
                </div>
              </div>
              <div>
                <div style={{fontSize:'9px',letterSpacing:'3px',color:'#E8820A',textTransform:'uppercase',fontWeight:'700',marginBottom:'12px'}}>Your Reel ({reelClips.length} clips)</div>
                <div style={{background:'rgba(22,22,31,0.98)',border:'1.5px dashed rgba(232,130,10,0.3)',borderRadius:'10px',padding:'32px',textAlign:'center',color:'rgba(212,200,168,0.4)',fontSize:'12px',letterSpacing:'1px'}}>
                  Add clips from the left to build your reel
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}