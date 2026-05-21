import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const STAT_MAP = {
  '2PT Made':'twopm','2PT Att':'twopa','3PT Made':'tpm','3PT Att':'tpa',
  'FT Made':'ftm','FT Att':'fta','AST':'ast','TO':'to',
  'OREB':'oreb','DREB':'dreb','STL':'stl','BLK':'blk',
  'DEFL':'def','CHG':'chg','FOUL':'foul'
}
const STAT_LABELS = {
  twopm:'2PT Made',twopa:'2PT Att',tpm:'3PT Made',tpa:'3PT Att',
  ftm:'FT Made',fta:'FT Att',ast:'AST',to:'TO',
  oreb:'OREB',dreb:'DREB',stl:'STL',blk:'BLK',
  def:'DEFL',chg:'CHG',foul:'FOUL'
}

const C = {
  bg:'#0a0a0f',panel:'#16161f',border:'rgba(255,255,255,0.07)',
  border2:'rgba(255,255,255,0.12)',maroon:'#7B1020',orange:'#E8820A',
  orange2:'#F5A030',cream:'#EDE0C4',text:'#D4C8A8',
  muted:'rgba(212,200,168,0.45)',green:'#16A34A',red:'#DC2626',blue:'#2563EB',
}

function fmt(s) {
  if (s===null||s===undefined||isNaN(s)) return '--:--'
  const m=Math.floor(s/60), sec=Math.floor(s%60)
  return m+':'+String(sec).padStart(2,'0')
}

export default function PlayerDashboard({ profile }) {
  const [activeTab, setActiveTab]   = useState('mystats')
  const [player, setPlayer]         = useState(null)
  const [team, setTeam]             = useState(null)
  const [events, setEvents]         = useState([])
  const [games, setGames]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [statFilter, setStatFilter] = useState('')
  const [gameFilter, setGameFilter] = useState('all')
  const [reelClips, setReelClips]   = useState([])
  const [videoURL, setVideoURL]     = useState(null)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => { if (profile?.id) fetchPlayerData() }, [profile])

  async function fetchPlayerData() {
    // Get profile with player_id
    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', profile.id).single()

    if (!profileData?.player_id) { setLoading(false); return }

    // Get player directly using player_id from profile
    const { data: foundPlayer } = await supabase
      .from('players').select('*').eq('id', profileData.player_id).single()

    if (!foundPlayer) { setLoading(false); return }
    setPlayer(foundPlayer)

    // Get team
    const { data: foundTeam } = await supabase
      .from('teams').select('*').eq('id', foundPlayer.team_id).single()
    setTeam(foundTeam)

    // Get games for this team
    const { data: gamesData } = await supabase.from('games').select('*')
      .eq('team_id', foundPlayer.team_id).order('game_date', { ascending: false })
    setGames(gamesData || [])

    // Get events for this player only
    const { data: eventsData } = await supabase.from('events')
      .select('*').eq('player_id', foundPlayer.id)
    const evts = (eventsData||[]).map(e => ({
      ...e,
      stat: STAT_MAP[e.event_type] || null,
      videoTime: e.timestamp_sec ?? null,
    }))
    setEvents(evts)
    setLoading(false)
  }

  // ── Compute stats ──
  const statEvents = events.filter(e => e.stat)
  const filteredEvents = gameFilter === 'all' ? statEvents : statEvents.filter(e => e.game_id === gameFilter)

  function cnt(k) { return filteredEvents.filter(e=>e.stat===k).length }
  const twopm=cnt('twopm'), twopa=cnt('twopa'), tpm=cnt('tpm'), tpa=cnt('tpa')
  const ftm=cnt('ftm'), fta=cnt('fta')
  const fgm=twopm+tpm, fga=twopm+twopa+tpm+tpa
  const pts=twopm*2+tpm*3+ftm
  const reb=cnt('oreb')+cnt('dreb')
  const ast=cnt('ast'), to=cnt('to'), stl=cnt('stl'), blk=cnt('blk')
  const fgPct = fga>0?(fgm/fga*100).toFixed(1)+'%':'—'
  const tpPct = (tpm+tpa)>0?(tpm/(tpm+tpa)*100).toFixed(1)+'%':'—'
  const ftPct = (ftm+fta)>0?(ftm/(ftm+fta)*100).toFixed(1)+'%':'—'
  const ts = (2*(fga+0.44*fta))>0 ? (pts/(2*(fga+0.44*fta))*100).toFixed(1)+'%' : '—'
  const gp = gameFilter==='all' ? new Set(statEvents.map(e=>e.game_id)).size || 1 : 1
  const ppg=(pts/gp).toFixed(1), rpg=(reb/gp).toFixed(1), apg=(ast/gp).toFixed(1)
  const spg=(stl/gp).toFixed(1), bpg=(blk/gp).toFixed(1)

  // ── Season game-by-game ──
  const seasonRows = games.map(g => {
    const gEvts = statEvents.filter(e=>e.game_id===g.id)
    const gc = k => gEvts.filter(e=>e.stat===k).length
    const gPts = gc('twopm')*2+gc('tpm')*3+gc('ftm')
    const gReb = gc('oreb')+gc('dreb')
    const gFgm = gc('twopm')+gc('tpm')
    const gFga = gFgm+gc('twopa')+gc('tpa')
    return { ...g, pts:gPts, reb:gReb, ast:gc('ast'), stl:gc('stl'), blk:gc('blk'), to:gc('to'), fgm:gFgm, fga:gFga }
  }).filter(g=>g.pts>0||g.reb>0||g.ast>0)

  // ── Film clips ──
  const filmEvents = events
    .filter(e=>e.videoTime!==null&&!isNaN(e.videoTime)&&e.stat)
    .filter(e=>!statFilter||e.stat===statFilter)
    .filter(e=>gameFilter==='all'||e.game_id===gameFilter)
    .sort((a,b)=>a.videoTime-b.videoTime)

  function jumpTo(ts) {
    if (videoRef.current && videoURL) {
      videoRef.current.currentTime = Math.max(0, ts-5)
      videoRef.current.play()
    }
  }

  function handleVideoFile(e) {
    const f = e.target.files[0]
    if (!f) return
    if (videoURL) URL.revokeObjectURL(videoURL)
    setVideoURL(URL.createObjectURL(f))
    setVideoLoaded(true)
  }

  function addToReel(clip) {
    if (!reelClips.find(c=>c.id===clip.id)) setReelClips(prev=>[...prev,clip])
  }
  function removeFromReel(clipId) { setReelClips(prev=>prev.filter(c=>c.id!==clipId)) }

  if (loading) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'14px',letterSpacing:'4px'}}>LOADING...</div>
  )

  if (!player) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'16px',fontFamily:'Georgia,serif'}}>
      <div style={{fontSize:'14px',color:C.orange2,letterSpacing:'4px'}}>NO PLAYER PROFILE FOUND</div>
      <div style={{fontSize:'11px',color:C.muted,letterSpacing:'2px'}}>Contact your admin to link your account</div>
      <button onClick={()=>supabase.auth.signOut()} style={{marginTop:'12px',padding:'8px 20px',background:'transparent',border:`1px solid ${C.border2}`,borderRadius:'6px',color:C.muted,fontSize:'11px',cursor:'pointer',fontFamily:'Georgia,serif'}}>Sign out</button>
    </div>
  )

  const tabs = [
    {id:'mystats',lbl:'My Stats'},
    {id:'film',lbl:'My Film'},
    {id:'season',lbl:'Season Log'},
    {id:'highlights',lbl:'Highlight Builder'},
  ]

  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:'Georgia,serif',color:C.text}}>

      {/* NAV */}
      <div style={{height:'56px',display:'flex',alignItems:'center',gap:'12px',padding:'0 20px',background:'rgba(10,10,15,0.97)',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,zIndex:200}}>
        <span style={{fontSize:'18px',fontWeight:'900',letterSpacing:'6px',color:C.orange2}}>SWIVEL</span>
        <div style={{width:'1px',height:'24px',background:C.border2}}/>
        <span style={{fontSize:'13px',fontWeight:'700',color:C.orange2}}>
          {player ? `#${player.jersey_number}` : ''} {profile?.full_name||'Player'}
        </span>
        <span style={{fontSize:'11px',color:C.muted,flex:1}}>{team?.name||''}</span>
        <button onClick={()=>supabase.auth.signOut()} style={{padding:'5px 12px',background:'transparent',border:`1px solid ${C.border2}`,borderRadius:'6px',color:C.muted,fontSize:'11px',cursor:'pointer',fontFamily:'Georgia,serif'}}>Sign out</button>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:'2px',padding:'0 20px',borderBottom:`1px solid ${C.border}`,background:'rgba(10,10,15,0.6)'}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{background:activeTab===t.id?C.maroon:'none',border:'none',borderBottom:activeTab===t.id?`2px solid ${C.orange}`:'2px solid transparent',color:activeTab===t.id?C.orange2:C.muted,fontFamily:'Georgia,serif',fontSize:'10px',fontWeight:'700',letterSpacing:'2px',padding:'12px 16px',cursor:'pointer',textTransform:'uppercase',transition:'all 0.15s'}}>{t.lbl}</button>
        ))}
      </div>

      {/* GAME FILTER */}
      <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 20px',borderBottom:`1px solid ${C.border}`,background:'rgba(10,10,15,0.4)',flexWrap:'wrap'}}>
        <div style={{fontSize:'9px',letterSpacing:'3px',color:C.muted,textTransform:'uppercase'}}>Game</div>
        <select value={gameFilter} onChange={e=>setGameFilter(e.target.value)} style={{background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'6px',color:C.cream,fontFamily:'Georgia,serif',fontSize:'12px',padding:'6px 10px',outline:'none'}}>
          <option value='all'>All Games</option>
          {games.map(g=><option key={g.id} value={g.id}>{g.opponent} · {g.game_date}</option>)}
        </select>
      </div>

      <div style={{padding:'20px'}}>

        {/* ══════════ MY STATS ══════════ */}
        {activeTab==='mystats' && (
          <div>
            <div style={{background:'linear-gradient(135deg,rgba(123,16,32,0.4) 0%,rgba(16,16,24,0.95) 60%)',border:`1px solid rgba(232,130,10,0.22)`,borderLeft:`4px solid ${C.orange}`,borderRadius:'10px',padding:'24px 28px',marginBottom:'20px',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 50% 120% at 0% 50%,rgba(123,16,32,0.15) 0%,transparent 60%)',pointerEvents:'none'}}/>
              <div style={{display:'flex',alignItems:'center',gap:'24px',flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:'9px',letterSpacing:'5px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'6px'}}>Player</div>
                  <div style={{fontSize:'52px',fontWeight:'900',color:C.cream,lineHeight:'1'}}>#{player?.jersey_number||'—'}</div>
                  <div style={{fontSize:'13px',color:C.muted,letterSpacing:'2px',marginTop:'4px'}}>{profile?.full_name||'Player'} · {player?.position||''} · {team?.name||''}</div>
                  <div style={{fontSize:'11px',color:C.muted,marginTop:'4px'}}>{gp} GP · {statEvents.length} tagged events</div>
                </div>
                <div style={{width:'1px',height:'60px',background:'rgba(255,255,255,0.08)'}}/>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px'}}>
                  {[['PPG',ppg],['RPG',rpg],['APG',apg],['SPG',spg],['BPG',bpg],['TS%',ts]].map(([l,v])=>(
                    <div key={l} style={{textAlign:'center'}}>
                      <div style={{fontSize:'8px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'4px'}}>{l}</div>
                      <div style={{fontSize:'24px',fontWeight:'900',color:C.cream}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {statEvents.length===0
              ? <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'40px',textAlign:'center',color:C.muted,fontSize:'13px',letterSpacing:'2px'}}>📊 Stats will appear here as games are tagged<br/><span style={{fontSize:'10px',opacity:0.6,marginTop:'8px',display:'block'}}>Your season stats, shooting splits, and advanced metrics will all live here</span></div>
              : <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px',marginBottom:'20px'}}>
                    {[
                      {lbl:'Points',val:pts,sub:'total'},
                      {lbl:'FG',val:`${fgm}/${fga}`,sub:fgPct},
                      {lbl:'3PT',val:`${tpm}/${tpm+tpa}`,sub:tpPct},
                      {lbl:'FT',val:`${ftm}/${ftm+fta}`,sub:ftPct},
                      {lbl:'Rebounds',val:reb,sub:`${cnt('oreb')} off · ${cnt('dreb')} def`},
                      {lbl:'Assists',val:ast,sub:`${to} TO`},
                      {lbl:'Steals',val:stl,sub:''},
                      {lbl:'Blocks',val:blk,sub:''},
                    ].map(({lbl,val,sub})=>(
                      <div key={lbl} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'16px',textAlign:'center'}}>
                        <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'8px'}}>{lbl}</div>
                        <div style={{fontSize:'28px',fontWeight:'900',color:C.cream}}>{val}</div>
                        {sub && <div style={{fontSize:'11px',color:C.muted,marginTop:'4px'}}>{sub}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'20px'}}>
                    <div style={{fontSize:'9px',letterSpacing:'4px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'16px',paddingBottom:'12px',borderBottom:`1px solid ${C.border}`}}>All Events</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                      {Object.entries(STAT_LABELS).map(([k,lbl])=>{
                        const c=cnt(k)
                        if(!c) return null
                        return (
                          <div key={k} style={{background:'rgba(232,130,10,0.08)',border:`1px solid rgba(232,130,10,0.2)`,borderRadius:'8px',padding:'10px 16px',textAlign:'center',minWidth:'80px'}}>
                            <div style={{fontSize:'8px',letterSpacing:'2px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'4px'}}>{lbl}</div>
                            <div style={{fontSize:'22px',fontWeight:'900',color:C.cream}}>{c}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
            }
          </div>
        )}

        {/* ══════════ MY FILM ══════════ */}
        {activeTab==='film' && (
          <div style={{display:'flex',gap:'14px',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0,maxWidth:'calc(100% - 330px)'}}>
              {!videoURL
                ? <div style={{background:C.panel,border:`2px dashed rgba(123,16,32,0.5)`,borderRadius:'10px',padding:'48px',textAlign:'center',cursor:'pointer'}} onClick={()=>document.getElementById('player-film-input').click()}>
                    <div style={{fontSize:'36px',marginBottom:'12px'}}>🎬</div>
                    <div style={{fontSize:'12px',color:C.muted,letterSpacing:'2px'}}>Load game film to see your clips</div>
                    <div style={{fontSize:'10px',color:C.muted,marginTop:'8px',opacity:'0.6'}}>MP4 · any resolution</div>
                  </div>
                : <video ref={videoRef} src={videoURL} style={{width:'100%',maxHeight:'480px',borderRadius:'10px',background:'#000',objectFit:'contain'}} controls/>
              }
              <input id="player-film-input" type="file" accept="video/*" style={{display:'none'}} onChange={handleVideoFile}/>
              <div style={{marginTop:'10px'}}>
                <button onClick={()=>document.getElementById('player-film-input').click()} style={{background:'rgba(232,130,10,0.12)',border:`1px solid rgba(232,130,10,0.35)`,borderRadius:'7px',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'10px',padding:'8px 14px',cursor:'pointer',letterSpacing:'1px'}}>📂 Load Film</button>
              </div>
            </div>
            <div style={{width:'300px',flexShrink:0,display:'flex',flexDirection:'column',gap:'10px'}}>
              <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'14px',display:'flex',flexDirection:'column',gap:'8px'}}>
                <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700'}}>Filter My Clips</div>
                <select value={statFilter} onChange={e=>setStatFilter(e.target.value)} style={{background:'#0a0a0f',border:`1px solid ${C.border2}`,borderRadius:'6px',color:C.cream,fontFamily:'Georgia,serif',fontSize:'11px',padding:'6px 8px',outline:'none'}}>
                  <option value=''>All Stats</option>
                  {[...new Set(statEvents.map(e=>e.stat))].filter(Boolean).map(s=><option key={s} value={s}>{STAT_LABELS[s]||s}</option>)}
                </select>
              </div>
              <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',maxHeight:'500px',overflowY:'auto'}}>
                <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.border}`,fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700'}}>My Events ({filmEvents.length})</div>
                {filmEvents.length===0
                  ? <div style={{padding:'20px',textAlign:'center',color:C.muted,fontSize:'11px',letterSpacing:'1px'}}>NO CLIPS YET</div>
                  : filmEvents.map((e,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 14px',borderBottom:`1px solid rgba(255,255,255,0.04)`,cursor:'pointer'}}
                        onClick={()=>jumpTo(e.videoTime)}>
                        <span style={{fontSize:'11px',color:C.muted,fontFamily:'Courier New',minWidth:'40px'}}>{fmt(e.videoTime)}</span>
                        <span style={{fontSize:'11px',color:C.text,flex:1}}>{STAT_LABELS[e.stat]||e.event_type}</span>
                        <button onClick={ev=>{ev.stopPropagation();addToReel(e)}} style={{background:'rgba(232,130,10,0.12)',border:`1px solid rgba(232,130,10,0.3)`,borderRadius:'4px',color:C.orange2,fontSize:'9px',padding:'3px 7px',cursor:'pointer',fontFamily:'Georgia,serif'}}>+ Reel</button>
                      </div>
                    ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ══════════ SEASON LOG ══════════ */}
        {activeTab==='season' && (
          <div>
            {seasonRows.length===0
              ? <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'40px',textAlign:'center',color:C.muted,fontSize:'13px',letterSpacing:'2px'}}>No game data yet</div>
              : <>
                  <div style={{background:'linear-gradient(135deg,rgba(123,16,32,0.3) 0%,rgba(16,16,24,0.95) 60%)',border:`1px solid rgba(232,130,10,0.2)`,borderLeft:`4px solid ${C.orange}`,borderRadius:'10px',padding:'20px 24px',marginBottom:'20px',display:'flex',gap:'24px',flexWrap:'wrap',alignItems:'center'}}>
                    <div><div style={{fontSize:'9px',letterSpacing:'4px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'4px'}}>Season Averages</div><div style={{fontSize:'11px',color:C.muted}}>{seasonRows.length} games played</div></div>
                    {[['PPG',ppg],['RPG',rpg],['APG',apg],['SPG',spg],['TS%',ts]].map(([l,v])=>(
                      <div key={l} style={{textAlign:'center'}}>
                        <div style={{fontSize:'8px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'2px'}}>{l}</div>
                        <div style={{fontSize:'24px',fontWeight:'900',color:C.cream}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'20px',overflowX:'auto'}}>
                    <div style={{fontSize:'9px',letterSpacing:'4px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'16px',paddingBottom:'12px',borderBottom:`1px solid ${C.border}`}}>Game Log</div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                      <thead>
                        <tr style={{background:'rgba(123,16,32,0.15)'}}>
                          {['Opponent','Date','PTS','REB','AST','STL','BLK','TO','FGM','FGA','FG%'].map(h=>(
                            <th key={h} style={{color:C.orange,fontSize:'8px',letterSpacing:'2px',textAlign:h==='Opponent'||h==='Date'?'left':'center',padding:'9px 6px',borderBottom:`1px solid rgba(232,130,10,0.2)`,fontWeight:'700',whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {seasonRows.map(g=>{
                          const fgpct = g.fga>0?(g.fgm/g.fga*100).toFixed(1)+'%':'—'
                          return (
                            <tr key={g.id} style={{borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                              <td style={{padding:'9px 6px',color:C.cream,fontWeight:'700'}}>{g.opponent}</td>
                              <td style={{padding:'9px 6px',color:C.muted,fontSize:'11px'}}>{g.game_date}</td>
                              {[g.pts,g.reb,g.ast,g.stl,g.blk,g.to,g.fgm,g.fga,fgpct].map((v,i)=>(
                                <td key={i} style={{padding:'9px 6px',textAlign:'center',color:C.text}}>{v}</td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
            }
          </div>
        )}

        {/* ══════════ HIGHLIGHT BUILDER ══════════ */}
        {activeTab==='highlights' && (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'12px'}}>
              <div>
                <div style={{fontSize:'9px',letterSpacing:'4px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'4px'}}>Highlight Reel Builder</div>
                <div style={{fontSize:'12px',color:C.muted,letterSpacing:'1px'}}>Add clips from your film tab to build your recruiting reel</div>
              </div>
              {reelClips.length>0 && (
                <button style={{background:C.maroon,border:`1px solid ${C.orange}`,borderRadius:'8px',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'11px',fontWeight:'900',padding:'10px 20px',letterSpacing:'3px',cursor:'pointer',textTransform:'uppercase'}}>
                  Export Reel ({reelClips.length} clips) →
                </button>
              )}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
              <div>
                <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'12px'}}>Your Clips ({filmEvents.length})</div>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'12px'}}>
                  <button onClick={()=>setStatFilter('')} style={{background:!statFilter?C.maroon:'rgba(255,255,255,0.04)',border:`1px solid ${!statFilter?C.orange:C.border}`,borderRadius:'6px',color:!statFilter?C.orange2:C.muted,fontFamily:'Georgia,serif',fontSize:'10px',padding:'5px 12px',cursor:'pointer',letterSpacing:'1px'}}>All</button>
                  {[...new Set(statEvents.map(e=>e.stat))].filter(Boolean).map(s=>(
                    <button key={s} onClick={()=>setStatFilter(s)} style={{background:statFilter===s?C.maroon:'rgba(255,255,255,0.04)',border:`1px solid ${statFilter===s?C.orange:C.border}`,borderRadius:'6px',color:statFilter===s?C.orange2:C.muted,fontFamily:'Georgia,serif',fontSize:'10px',padding:'5px 12px',cursor:'pointer',letterSpacing:'1px'}}>{STAT_LABELS[s]||s}</button>
                  ))}
                </div>
                {filmEvents.length===0
                  ? <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'32px',textAlign:'center',color:C.muted,fontSize:'12px',letterSpacing:'1px'}}>Clips appear here once games are tagged with film</div>
                  : <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',maxHeight:'400px',overflowY:'auto'}}>
                      {filmEvents.map((e,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 14px',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                          <span style={{fontSize:'11px',color:C.muted,fontFamily:'Courier New',minWidth:'40px'}}>{fmt(e.videoTime)}</span>
                          <span style={{fontSize:'11px',color:C.text,flex:1}}>{STAT_LABELS[e.stat]||e.event_type}</span>
                          <button onClick={()=>addToReel(e)} style={{background:reelClips.find(c=>c.id===e.id)?'rgba(22,163,74,0.2)':'rgba(232,130,10,0.12)',border:`1px solid ${reelClips.find(c=>c.id===e.id)?C.green:'rgba(232,130,10,0.3)'}`,borderRadius:'4px',color:reelClips.find(c=>c.id===e.id)?C.green:C.orange2,fontSize:'9px',padding:'4px 8px',cursor:'pointer',fontFamily:'Georgia,serif',fontWeight:'700'}}>{reelClips.find(c=>c.id===e.id)?'✓ Added':'+ Add'}</button>
                        </div>
                      ))}
                    </div>
                }
              </div>
              <div>
                <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'12px'}}>Your Reel ({reelClips.length} clips)</div>
                {reelClips.length===0
                  ? <div style={{background:C.panel,border:`1.5px dashed rgba(232,130,10,0.3)`,borderRadius:'10px',padding:'32px',textAlign:'center',color:C.muted,fontSize:'12px',letterSpacing:'1px'}}>Add clips from the left to build your reel</div>
                  : <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',overflow:'hidden'}}>
                      {reelClips.map((e,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 14px',borderBottom:`1px solid rgba(255,255,255,0.04)`,background:i%2===0?'rgba(255,255,255,0.01)':'transparent'}}>
                          <span style={{fontSize:'11px',color:C.orange2,fontFamily:'Courier New',minWidth:'20px',fontWeight:'700'}}>{i+1}.</span>
                          <span style={{fontSize:'11px',color:C.muted,fontFamily:'Courier New',minWidth:'40px'}}>{fmt(e.videoTime)}</span>
                          <span style={{fontSize:'11px',color:C.text,flex:1}}>{STAT_LABELS[e.stat]||e.event_type}</span>
                          <button onClick={()=>removeFromReel(e.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'14px',padding:'0 4px'}}>✕</button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}