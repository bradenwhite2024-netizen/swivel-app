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
  bg:'#0a0a0f',surface:'#111118',panel:'#16161f',
  border:'rgba(255,255,255,0.07)',border2:'rgba(255,255,255,0.12)',
  maroon:'#7B1020',maroon2:'#9B1828',orange:'#E8820A',orange2:'#F5A030',
  gold:'#C8A400',cream:'#EDE0C4',text:'#D4C8A8',
  muted:'rgba(212,200,168,0.45)',blue:'#2563EB',green:'#16A34A',red:'#DC2626',
}

function buildStatsMap(events, statEvents) {
  const map = {}
  const allPlayers = [...new Set(statEvents.map(e=>e.player_id))].filter(Boolean)
  allPlayers.forEach(p => { map[p] = {} })
  const lineupEvents = events.filter(e=>e.type==='lineup').sort((a,b)=>a.videoTime-b.videoTime)
  if (lineupEvents.length > 0) {
    const scoringEvts = statEvents.filter(e=>['twopm','tpm','ftm'].includes(e.stat)).sort((a,b)=>a.videoTime-b.videoTime)
    const oppEvts = events.filter(e=>e.type==='opp').sort((a,b)=>a.videoTime-b.videoTime)
    lineupEvents.forEach((lineupEvt, idx) => {
      const startTime = lineupEvt.videoTime
      const endTime = lineupEvents[idx+1] ? lineupEvents[idx+1].videoTime : Infinity
      const lineup = (lineupEvt.player_id||'').split('|').map(s=>s.trim()).filter(Boolean)
      if (!lineup.length) return
      const teamPts = scoringEvts.filter(e=>e.videoTime>=startTime&&e.videoTime<endTime)
        .reduce((s,e)=>s+(e.stat==='twopm'?2:e.stat==='tpm'?3:1),0)
      const oppPts = oppEvts.filter(e=>e.videoTime>=startTime&&e.videoTime<endTime)
        .reduce((s,e)=>{ const m=(e.event_type||'').match(/\+(\d+)/); return s+(m?parseInt(m[1]):0) },0)
      lineup.forEach(p => {
        if (!map[p]) map[p] = {}
        map[p]['Team PTS On'] = (map[p]['Team PTS On']||0) + teamPts
        map[p]['Opp PTS On']  = (map[p]['Opp PTS On']||0)  + oppPts
      })
    })
  }
  return map
}

function getStat(statsMap, statEvents, playerId, col) {
  const row = statsMap[playerId]
  if (col==='GP') return row?.GP || 1
  if (row && row[col]!=null) return row[col]
  const evts = statEvents.filter(e=>e.player_id===playerId)
  const cnt = k => evts.filter(e=>e.stat===k).length
  const MAP = {
    'PTS':cnt('twopm')*2+cnt('tpm')*3+cnt('ftm'),
    '2PT Made':cnt('twopm'),'2PT Att':cnt('twopa'),
    '3PT Made':cnt('tpm'),'3PT Att':cnt('tpa'),
    'FT Made':cnt('ftm'),'FT Att':cnt('fta'),
    'FG Made':cnt('twopm')+cnt('tpm'),
    'FG Att':(cnt('twopm')+cnt('twopa'))+(cnt('tpm')+cnt('tpa')),
    'AST':cnt('ast'),'TO':cnt('to'),
    'OREB':cnt('oreb'),'DREB':cnt('dreb'),
    'STL':cnt('stl'),'BLK':cnt('blk'),'DEFL':cnt('def'),'CHG':cnt('chg'),'FOUL':cnt('foul'),
  }
  return MAP[col] ?? 0
}

function getPts(statsMap, statEvents, pid) { return getStat(statsMap, statEvents, pid,'PTS')||0 }
function getPM(statsMap, pid) {
  const on=(statsMap[pid]?.['Team PTS On'])||0
  const ag=(statsMap[pid]?.['Opp PTS On'])||0
  return on-ag
}
function getTSpct(statsMap, statEvents, pid) {
  const fga=getStat(statsMap,statEvents,pid,'FG Att')||0
  const fta=getStat(statsMap,statEvents,pid,'FT Att')||0
  const pv=getPts(statsMap,statEvents,pid)
  const d=2*(fga+0.44*fta)
  return d===0?null:pv/d
}
function getAstTo(statsMap, statEvents, pid) {
  const a=getStat(statsMap,statEvents,pid,'AST')||0
  const t=getStat(statsMap,statEvents,pid,'TO')||0
  if(t===0) return a>0?99:null
  return a/t
}
function getHustle(statsMap, statEvents, pid) {
  return (getStat(statsMap,statEvents,pid,'STL')||0)+(getStat(statsMap,statEvents,pid,'BLK')||0)
        +(getStat(statsMap,statEvents,pid,'OREB')||0)+(getStat(statsMap,statEvents,pid,'DREB')||0)
        +(getStat(statsMap,statEvents,pid,'CHG')||0)
}
function getStocks(statsMap, statEvents, pid) {
  return (getStat(statsMap,statEvents,pid,'STL')||0)+(getStat(statsMap,statEvents,pid,'BLK')||0)
        +(getStat(statsMap,statEvents,pid,'DEFL')||0)
}

function fmt(s) {
  if (s===null||s===undefined||isNaN(s)) return '--:--'
  const m=Math.floor(s/60), sec=Math.floor(s%60)
  return m+':'+String(sec).padStart(2,'0')
}

function gradePlayer(pStats) {
  const s = pStats
  if (!s) return 'C'
  let score = 0
  score += (s.pts||0)*1.0 + (s.ast||0)*1.5 + (s.reb||0)*1.2
  score += (s.stl||0)*2.0 + (s.blk||0)*2.0 + (s.pm||0)*1.5
  if (s.ts!=null) score += (s.ts-0.5)*20
  if (score>=30) return 'A+'
  if (score>=24) return 'A'
  if (score>=18) return 'B+'
  if (score>=13) return 'B'
  if (score>=8)  return 'C+'
  if (score>=4)  return 'C'
  return 'D'
}
function gradeColor(gr) {
  if (gr.startsWith('A')) return C.green
  if (gr.startsWith('B')) return C.blue
  if (gr.startsWith('C')) return C.orange
  return C.red
}

function BarChart({ data, color, valFn }) {
  const [widths, setWidths] = useState({})
  const mx = Math.max(...data.map(d=>Math.abs(d.val||0)), 0.001)

  useEffect(() => {
    const t = setTimeout(() => {
      const w = {}
      data.forEach(d => { w[d.lbl] = Math.max(0,Math.min(100,(Math.abs(d.val||0)/mx)*100)) })
      setWidths(w)
    }, 50)
    return () => clearTimeout(t)
  }, [data])

  if (!data.length) return <div style={{color:C.muted,fontSize:'11px',letterSpacing:'1px'}}>No data</div>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
      {data.map(d => {
        const pct = widths[d.lbl]||0
        const showIn = pct > 18
        const col = typeof color === 'function' ? color(d.val) : color
        return (
          <div key={d.lbl} style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <span style={{fontSize:'11px',color:C.orange2,fontFamily:'Courier New',minWidth:'32px',textAlign:'right'}}>{d.lbl}</span>
            <div style={{flex:1,height:'22px',background:'rgba(255,255,255,0.04)',borderRadius:'4px',overflow:'hidden',position:'relative'}}>
              <div style={{height:'100%',width:pct+'%',background:col,borderRadius:'4px',transition:'width 0.5s ease',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:'6px'}}>
                {showIn && <span style={{fontSize:'10px',color:'#fff',fontFamily:'Courier New',fontWeight:'700'}}>{valFn(d.val)}</span>}
              </div>
            </div>
            {!showIn && <span style={{fontSize:'10px',color:C.muted,fontFamily:'Courier New',minWidth:'40px'}}>{valFn(d.val)}</span>}
          </div>
        )
      })}
    </div>
  )
}

function SparkLine({ vals, labels, color, label, fmtFn }) {
  if (!vals || vals.length < 1) return null
  const W=280, H=90, PAD=12
  const mn=Math.min(...vals), mx=Math.max(...vals)
  const range=mx-mn||1
  const n=vals.length
  const px=i=>PAD+(i/Math.max(n-1,1))*(W-PAD*2)
  const py=v=>PAD+(1-(v-mn)/range)*(H-PAD*2)
  const pathD=vals.map((v,i)=>(i===0?'M':'L')+px(i).toFixed(1)+' '+py(v).toFixed(1)).join(' ')
  const areaD='M'+px(0).toFixed(1)+' '+H+' '+pathD+' L'+px(n-1).toFixed(1)+' '+H+' Z'
  const latest=vals[n-1], prev=n>1?vals[n-2]:null
  const trend=prev!==null?(latest>prev?'▲':latest<prev?'▼':'→'):''
  const trendCol=prev!==null?(latest>prev?C.green:latest<prev?C.red:'#888'):'#888'
  const gradId='ag'+label.replace(/[^a-z]/gi,'')
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
        <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700'}}>{label}</div>
        <div style={{fontSize:'13px',fontWeight:'900',color}}>{fmtFn(latest)} <span style={{fontSize:'10px',color:trendCol}}>{trend}</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H+14}`} width="100%" style={{overflow:'visible',display:'block'}}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`}/>
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {vals.map((v,i)=>(
          <g key={i}>
            <circle cx={px(i).toFixed(1)} cy={py(v).toFixed(1)} r="3" fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth="1"/>
            <text x={px(i).toFixed(1)} y={(py(v)-7).toFixed(1)} textAnchor="middle" fontSize="8" fill="rgba(212,200,168,0.7)" fontFamily="Courier New">{fmtFn(v)}</text>
            {labels && <text x={px(i).toFixed(1)} y={H+10} textAnchor="middle" fontSize="7" fill="rgba(212,200,168,0.35)" fontFamily="Georgia">{(labels[i]||'').length>8?(labels[i]||'').slice(0,8)+'…':labels[i]}</text>}
          </g>
        ))}
      </svg>
    </div>
  )
}

function PostGameReport({ game, onClose }) {
  const pStats = game.playerStats || {}
  const pList = Object.keys(pStats).sort((a,b)=>(pStats[b].pts||0)-(pStats[a].pts||0))
  const win = game.teamPts > (game.oppPts||0)
  const diff = game.teamPts - (game.oppPts||0)
  const topScorer = pList[0]
  const topPM = [...pList].sort((a,b)=>(pStats[b].pm||0)-(pStats[a].pm||0))[0]
  const topRebounder = [...pList].sort((a,b)=>(pStats[b].reb||0)-(pStats[a].reb||0))[0]
  const topAssister = [...pList].sort((a,b)=>(pStats[b].ast||0)-(pStats[a].ast||0))[0]
  const rights=[], wrongs=[]
  pList.forEach(p=>{
    const s=pStats[p]
    if((s.pm||0)<-4) wrongs.push(`#${p} was a ${s.pm} on the floor`)
    if((s.to||0)>=4) wrongs.push(`#${p} had ${s.to} turnovers`)
    if((s.pm||0)>4) rights.push(`#${p} was a +${s.pm} on the floor`)
    if((s.ast||0)>=4) rights.push(`#${p} dished ${s.ast} assists`)
    if((s.stl||0)>=2) rights.push(`#${p} had ${s.stl} steals`)
  })
  if(win) rights.unshift(`Won by ${diff} points`)
  else wrongs.unshift(`Lost by ${Math.abs(diff)} points`)
  if(game.teamPts>(game.oppPts||0)*1.15) rights.push('Dominant offensive performance')
  if((game.oppPts||0)>game.teamPts*1.15) wrongs.push('Defensive breakdown — allowed 15%+ more than scored')
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:1000,overflowY:'auto',padding:'24px'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{maxWidth:'700px',margin:'0 auto',background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'14px',padding:'28px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
          <div>
            <div style={{fontSize:'11px',letterSpacing:'4px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'4px'}}>Post-Game Report</div>
            <div style={{fontSize:'22px',fontWeight:'900',color:C.cream}}>{game.opponent}</div>
            <div style={{fontSize:'11px',color:C.muted,letterSpacing:'1px'}}>{game.game_date||''}</div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>window.print()} style={{background:'rgba(232,130,10,0.12)',border:`1px solid rgba(232,130,10,0.35)`,borderRadius:'7px',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'10px',fontWeight:'700',padding:'8px 14px',cursor:'pointer',letterSpacing:'1px'}}>🖨 Print</button>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,borderRadius:'7px',color:C.muted,fontFamily:'Georgia,serif',fontSize:'10px',padding:'8px 14px',cursor:'pointer'}}>✕ Close</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'24px'}}>
          {[
            {lbl:'Result',val:win?'WIN':'LOSS',col:win?C.green:C.red},
            {lbl:'Score',val:`${game.teamPts}–${game.oppPts||'?'}`,col:C.cream},
            {lbl:'Top Scorer',val:`#${topScorer||'—'}`,sub:topScorer?pStats[topScorer].pts+' pts':'',col:C.cream},
            {lbl:'Best +/−',val:`#${topPM||'—'}`,sub:topPM?(pStats[topPM].pm>0?'+':'')+pStats[topPM].pm:'',col:C.green},
          ].map(({lbl,val,sub,col})=>(
            <div key={lbl} style={{background:'rgba(255,255,255,0.04)',border:`1px solid rgba(232,130,10,0.18)`,borderRadius:'10px',padding:'14px',textAlign:'center'}}>
              <div style={{fontSize:'8px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',marginBottom:'4px'}}>{lbl}</div>
              <div style={{fontSize:'22px',fontWeight:'900',color:col}}>{val}</div>
              {sub && <div style={{fontSize:'10px',color:C.muted}}>{sub}</div>}
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'24px'}}>
          <div style={{background:'rgba(22,163,74,0.06)',border:'1px solid rgba(22,163,74,0.2)',borderRadius:'10px',padding:'16px'}}>
            <div style={{fontSize:'9px',letterSpacing:'3px',color:C.green,textTransform:'uppercase',fontWeight:'700',marginBottom:'12px'}}>✓ What Went Right</div>
            {rights.length ? rights.map((r,i)=><div key={i} style={{fontSize:'12px',color:C.text,marginBottom:'7px',paddingLeft:'10px',borderLeft:`2px solid ${C.green}`}}>• {r}</div>) : <div style={{fontSize:'11px',color:C.muted}}>No standout positives.</div>}
          </div>
          <div style={{background:'rgba(220,38,38,0.06)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:'10px',padding:'16px'}}>
            <div style={{fontSize:'9px',letterSpacing:'3px',color:C.red,textTransform:'uppercase',fontWeight:'700',marginBottom:'12px'}}>✗ What Went Wrong</div>
            {wrongs.length ? wrongs.map((r,i)=><div key={i} style={{fontSize:'12px',color:C.text,marginBottom:'7px',paddingLeft:'10px',borderLeft:`2px solid ${C.red}`}}>• {r}</div>) : <div style={{fontSize:'11px',color:C.muted}}>No major issues.</div>}
          </div>
        </div>
        <div style={{marginBottom:'24px'}}>
          <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'14px'}}>⭐ Key Moments</div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {topScorer && <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'12px',color:C.text}}>🏀 <strong>#{topScorer}</strong> led the team with <strong>{pStats[topScorer].pts} points</strong></div>}
            {topRebounder && (pStats[topRebounder]?.reb||0)>=5 && <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'12px',color:C.text}}>🏀 <strong>#{topRebounder}</strong> dominated the glass with <strong>{pStats[topRebounder].reb} rebounds</strong></div>}
            {topAssister && (pStats[topAssister]?.ast||0)>=4 && <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'12px',color:C.text}}>🏀 <strong>#{topAssister}</strong> ran the offense with <strong>{pStats[topAssister].ast} assists</strong></div>}
            {diff>10 && <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'12px',color:C.text}}>🏀 <strong>Dominant performance</strong> — won by double digits ({diff} point margin)</div>}
            {Math.abs(diff)<=3 && <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'12px',color:C.text}}>🏀 <strong>Close game</strong> — decided by {Math.abs(diff)} point{Math.abs(diff)===1?'':'s'}</div>}
          </div>
        </div>
        <div>
          <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'14px'}}>📊 Full Analytics Breakdown</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
              <thead>
                <tr style={{background:'rgba(123,16,32,0.25)'}}>
                  {['#','GRADE','PTS','AST','REB','STL','BLK','TS%','+/−'].map(h=>(
                    <th key={h} style={{padding:'9px 6px',color:C.orange,fontSize:'8px',letterSpacing:'2px',borderBottom:`1px solid rgba(232,130,10,0.2)`,textAlign:h==='#'?'left':'center'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pList.map(p=>{
                  const s=pStats[p], gr=gradePlayer(s), pm_v=s.pm||0
                  const ts_v=s.ts!=null?(s.ts*100).toFixed(1)+'%':'—'
                  return (
                    <tr key={p} style={{borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                      <td style={{padding:'9px 8px',fontWeight:'900',color:C.orange2,fontSize:'13px'}}>#{p}</td>
                      <td style={{padding:'9px 6px',textAlign:'center',fontWeight:'900',fontSize:'15px',color:gradeColor(gr)}}>{gr}</td>
                      <td style={{padding:'9px 6px',textAlign:'center',fontWeight:'700',color:C.cream}}>{s.pts||0}</td>
                      <td style={{padding:'9px 6px',textAlign:'center'}}>{s.ast||0}</td>
                      <td style={{padding:'9px 6px',textAlign:'center'}}>{s.reb||0}</td>
                      <td style={{padding:'9px 6px',textAlign:'center'}}>{s.stl||0}</td>
                      <td style={{padding:'9px 6px',textAlign:'center'}}>{s.blk||0}</td>
                      <td style={{padding:'9px 6px',textAlign:'center'}}>{ts_v}</td>
                      <td style={{padding:'9px 6px',textAlign:'center',fontWeight:'700',color:pm_v>0?C.green:pm_v<0?C.red:C.muted}}>{pm_v>0?'+':''}{pm_v}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{marginTop:'16px',fontSize:'9px',color:C.muted,letterSpacing:'2px',textAlign:'center'}}>GENERATED BY SWIVEL · GAME FILM ANALYTICS</div>
      </div>
    </div>
  )
}

export default function CoachDashboard({ profile }) {
  const [activeTab, setActiveTab]     = useState('dashboard')
  const [activeBstTab, setActiveBstTab] = useState('gamestats')
  const [teams, setTeams]             = useState([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [games, setGames]             = useState([])
  const [selectedGame, setSelectedGame] = useState('all')
  const [players, setPlayers]         = useState([])
  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [statsMap, setStatsMap]       = useState({})
  const [statEvents, setStatEvents]   = useState([])
  const [playerFilter, setPlayerFilter] = useState('')
  const [statFilter, setStatFilter]   = useState('')
  const [reportGame, setReportGame]   = useState(null)
  const [activeTrend, setActiveTrend] = useState('team')
  const [trendPlayer, setTrendPlayer] = useState('')
  const [toast, setToast]             = useState('')
  const videoRef = useRef(null)
  const [videoURL, setVideoURL]       = useState(null)
  const [videoLoaded, setVideoLoaded] = useState(false)

  useEffect(() => { fetchTeams() }, [])
  useEffect(() => { if (selectedTeam) { fetchGames(); fetchPlayers() } }, [selectedTeam])
  useEffect(() => { if (selectedTeam) fetchEvents() }, [selectedTeam, selectedGame])

  async function fetchTeams() {
    // Use team_id from profile to only show the coach's assigned team
    if (profile?.team_id) {
      const { data } = await supabase.from('teams').select('*').eq('id', profile.team_id)
      setTeams(data||[])
      if (data?.length) setSelectedTeam(data[0].id)
    } else {
      // fallback: show all teams
      const { data } = await supabase.from('teams').select('*')
      setTeams(data||[])
      if (data?.length) setSelectedTeam(data[0].id)
    }
    setLoading(false)
  }

  async function fetchGames() {
    const { data } = await supabase.from('games').select('*').eq('team_id', selectedTeam).order('game_date',{ascending:false})
    setGames(data||[])
  }
  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('*').eq('team_id',selectedTeam).eq('active',true).order('jersey_number')
    setPlayers(data||[])
  }
  async function fetchEvents() {
    let q = supabase.from('events').select('*, games!inner(team_id)').eq('games.team_id', selectedTeam)
    if (selectedGame !== 'all') q = q.eq('game_id', selectedGame)
    const { data } = await q
    const evts = (data||[]).map(e => ({
      ...e,
      stat: STAT_MAP[e.event_type] || null,
      videoTime: e.timestamp_sec ?? null,
    }))
    setEvents(evts)
    const sEvts = evts.filter(e=>e.stat && e.player_id)
    setStatEvents(sEvts)
    const sm = buildStatsMap(evts, sEvts)
    const gpMap = {}
    const gameIds = [...new Set(evts.map(e=>e.game_id))]
    gameIds.forEach(gid => {
      const gPlayers = [...new Set(evts.filter(e=>e.game_id===gid && e.player_id).map(e=>e.player_id))]
      gPlayers.forEach(p => { gpMap[p]=(gpMap[p]||0)+1 })
    })
    Object.keys(gpMap).forEach(p => { if(!sm[p]) sm[p]={}; sm[p]['GP']=gpMap[p] })
    setStatsMap(sm)
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''), 2600) }

  const sortedPlayers = [...players].sort((a,b)=>
    getPts(statsMap,statEvents,b.id) - getPts(statsMap,statEvents,a.id)
  )

  const seasonGames = games.map(g => {
    const gEvts = events.filter(e=>e.game_id===g.id)
    const gStatEvts = gEvts.filter(e=>e.stat&&e.player_id)
    const gPlayers = [...new Set(gStatEvts.map(e=>e.player_id))]
    const sm = buildStatsMap(gEvts, gStatEvts)
    const teamPts = gStatEvts.filter(e=>e.stat==='twopm').length*2 + gStatEvts.filter(e=>e.stat==='tpm').length*3 + gStatEvts.filter(e=>e.stat==='ftm').length
    const playerStats = Object.fromEntries(gPlayers.map(pid => {
      const evts2 = gStatEvts.filter(e=>e.player_id===pid)
      const cnt = k=>evts2.filter(e=>e.stat===k).length
      const pv=cnt('twopm')*2+cnt('tpm')*3+cnt('ftm')
      const fgm=cnt('twopm')+cnt('tpm')
      const fga=fgm+cnt('twopa')+cnt('tpa')
      const ftm=cnt('ftm'), fta=cnt('fta')
      const ts=(2*(fga+0.44*fta))>0?pv/(2*(fga+0.44*fta)):null
      const pmData=sm[pid]
      const player = players.find(p=>p.id===pid)
      const label = player ? '#'+player.jersey_number : pid
      return [label, {pts:pv,ast:cnt('ast'),to:cnt('to'),stl:cnt('stl'),blk:cnt('blk'),reb:cnt('oreb')+cnt('dreb'),ts,pm:pmData?((pmData['Team PTS On']||0)-(pmData['Opp PTS On']||0)):0,fgm,fga,tpm:cnt('tpm'),tpa:cnt('tpa'),ftm,fta}]
    }))
    const oppPts = g.opp_score || gEvts.filter(e=>e.type==='opp').reduce((s,e)=>{const m=(e.event_type||'').match(/\+(\d+)/);return s+(m?parseInt(m[1]):0)},0)
    return { ...g, teamPts, oppPts, playerStats }
  })

  const wins = seasonGames.filter(g=>g.teamPts>(g.oppPts||0)).length
  const losses = seasonGames.length - wins

  function getDisplayStat(pid, col) {
    const gp = Math.max(getStat(statsMap,statEvents,pid,'GP')||1,1)
    const player = players.find(p=>p.id===pid)
    if (col==='#') return player ? player.jersey_number : '?'
    if (col==='name') return player?.name || ''
    if (col==='GP') return getStat(statsMap,statEvents,pid,'GP')||1
    if (col==='PPG') return (getPts(statsMap,statEvents,pid)/gp).toFixed(1)
    if (col==='DEFR') return ((getStat(statsMap,statEvents,pid,'DREB')||0)/gp).toFixed(1)
    if (col==='OFFR') return ((getStat(statsMap,statEvents,pid,'OREB')||0)/gp).toFixed(1)
    if (col==='RPG') return (((getStat(statsMap,statEvents,pid,'OREB')||0)+(getStat(statsMap,statEvents,pid,'DREB')||0))/gp).toFixed(1)
    if (col==='APG') return ((getStat(statsMap,statEvents,pid,'AST')||0)/gp).toFixed(1)
    if (col==='SPG') return ((getStat(statsMap,statEvents,pid,'STL')||0)/gp).toFixed(1)
    if (col==='BPG') return ((getStat(statsMap,statEvents,pid,'BLK')||0)/gp).toFixed(1)
    if (col==='TPG') return ((getStat(statsMap,statEvents,pid,'TO')||0)/gp).toFixed(1)
    if (col==='REB') return (getStat(statsMap,statEvents,pid,'OREB')||0)+(getStat(statsMap,statEvents,pid,'DREB')||0)
    if (col==='PTS') return getPts(statsMap,statEvents,pid)
    if (col==='FG Made') return getStat(statsMap,statEvents,pid,'FG Made')||0
    if (col==='FG Att')  return getStat(statsMap,statEvents,pid,'FG Att')||0
    if (col==='FG%') { const m=getStat(statsMap,statEvents,pid,'FG Made')||0, a=getStat(statsMap,statEvents,pid,'FG Att')||0; return a>0?(m/a*100).toFixed(1)+'%':'—' }
    if (col==='eFG%') { const m=getStat(statsMap,statEvents,pid,'FG Made')||0,a=getStat(statsMap,statEvents,pid,'FG Att')||0,t=getStat(statsMap,statEvents,pid,'3PT Made')||0; return a>0?((m+0.5*t)/a*100).toFixed(1)+'%':'—' }
    if (col==='3PM') return getStat(statsMap,statEvents,pid,'3PT Made')||0
    if (col==='3PA') { const m=getStat(statsMap,statEvents,pid,'3PT Made')||0,a=getStat(statsMap,statEvents,pid,'3PT Att')||0; return m+a }
    if (col==='3P%') { const m=getStat(statsMap,statEvents,pid,'3PT Made')||0,a=getStat(statsMap,statEvents,pid,'3PT Att')||0; const tot=m+a; return tot>0?(m/tot*100).toFixed(1)+'%':'—' }
    if (col==='2PM') return (getStat(statsMap,statEvents,pid,'FG Made')||0)-(getStat(statsMap,statEvents,pid,'3PT Made')||0)
    if (col==='2PA') { const twopm=(getStat(statsMap,statEvents,pid,'FG Made')||0)-(getStat(statsMap,statEvents,pid,'3PT Made')||0); const twopa=(getStat(statsMap,statEvents,pid,'FG Att')||0)-(getStat(statsMap,statEvents,pid,'3PT Made')||0)-(getStat(statsMap,statEvents,pid,'3PT Att')||0); return twopm+twopa }
    if (col==='FT Made') return getStat(statsMap,statEvents,pid,'FT Made')||0
    if (col==='FT Att')  return getStat(statsMap,statEvents,pid,'FT Att')||0
    if (col==='FT%') { const m=getStat(statsMap,statEvents,pid,'FT Made')||0,a=(getStat(statsMap,statEvents,pid,'FT Made')||0)+(getStat(statsMap,statEvents,pid,'FT Att')||0); return a>0?(m/a*100).toFixed(1)+'%':'—' }
    if (col==='2FG%') { const twopm=(getStat(statsMap,statEvents,pid,'FG Made')||0)-(getStat(statsMap,statEvents,pid,'3PT Made')||0); const twopa=(getStat(statsMap,statEvents,pid,'FG Att')||0)-(getStat(statsMap,statEvents,pid,'3PT Made')||0)-(getStat(statsMap,statEvents,pid,'3PT Att')||0); const tot=twopm+twopa; return tot>0?(twopm/tot*100).toFixed(1)+'%':'—' }
    if (col==='AST')  return getStat(statsMap,statEvents,pid,'AST')||0
    if (col==='STL')  return getStat(statsMap,statEvents,pid,'STL')||0
    if (col==='BLK')  return getStat(statsMap,statEvents,pid,'BLK')||0
    if (col==='TO')   return getStat(statsMap,statEvents,pid,'TO')||0
    if (col==='FOUL') return getStat(statsMap,statEvents,pid,'FOUL')||0
    if (col==='OREB') return getStat(statsMap,statEvents,pid,'OREB')||0
    if (col==='DREB') return getStat(statsMap,statEvents,pid,'DREB')||0
    if (col==='CHG')  return getStat(statsMap,statEvents,pid,'CHG')||0
    if (col==='DEFL') return getStat(statsMap,statEvents,pid,'DEFL')||0
    if (col==='AST/TO') { const a=getStat(statsMap,statEvents,pid,'AST')||0,t=getStat(statsMap,statEvents,pid,'TO')||0; return t>0?(a/t).toFixed(2):a>0?'∞':0 }
    if (col==='STL/TO') { const s=getStat(statsMap,statEvents,pid,'STL')||0,t=getStat(statsMap,statEvents,pid,'TO')||0; return t>0?(s/t).toFixed(2):s>0?'∞':0 }
    if (col==='STL/PF') { const s=getStat(statsMap,statEvents,pid,'STL')||0,f=getStat(statsMap,statEvents,pid,'FOUL')||0; return f>0?(s/f).toFixed(2):0 }
    return getStat(statsMap,statEvents,pid,col)??'—'
  }

  const BST_COLS = {
    gamestats: [{k:'#',lbl:'#'},{k:'name',lbl:'Name'},{k:'GP',lbl:'GP'},{k:'PPG',lbl:'PPG'},{k:'DEFR',lbl:'DREB/G'},{k:'OFFR',lbl:'OREB/G'},{k:'RPG',lbl:'RPG'},{k:'APG',lbl:'APG'},{k:'SPG',lbl:'SPG'},{k:'BPG',lbl:'BPG'},{k:'TPG',lbl:'TPG'}],
    shooting:  [{k:'#',lbl:'#'},{k:'name',lbl:'Name'},{k:'GP',lbl:'GP'},{k:'PTS',lbl:'Pts'},{k:'FG Made',lbl:'FGM'},{k:'FG Att',lbl:'FGA'},{k:'FG%',lbl:'FG%'},{k:'eFG%',lbl:'eFG%'}],
    shooting2: [{k:'#',lbl:'#'},{k:'name',lbl:'Name'},{k:'GP',lbl:'GP'},{k:'3PM',lbl:'3PM'},{k:'3PA',lbl:'3PA'},{k:'3P%',lbl:'3P%'},{k:'FT Made',lbl:'FTM'},{k:'FT Att',lbl:'FTA'},{k:'FT%',lbl:'FT%'},{k:'2PM',lbl:'2FGM'},{k:'2PA',lbl:'2FGA'},{k:'2FG%',lbl:'2FG%'}],
    totals:    [{k:'#',lbl:'#'},{k:'name',lbl:'Name'},{k:'GP',lbl:'GP'},{k:'PTS',lbl:'Pts'},{k:'OREB',lbl:'OReb'},{k:'DREB',lbl:'DReb'},{k:'REB',lbl:'Reb'},{k:'AST',lbl:'Ast'},{k:'STL',lbl:'Stl'},{k:'BLK',lbl:'Blk'},{k:'TO',lbl:'TO'},{k:'FOUL',lbl:'PF'}],
  }
  const SKIP_HI = new Set(['#','name','GP','TPG','TO','FOUL','AST/TO','STL/TO','STL/PF'])

  function renderBstTable(cols) {
    const maxByCol = {}
    cols.forEach(c=>{
      if(SKIP_HI.has(c.k)) return
      const vals=sortedPlayers.map(p=>parseFloat(getDisplayStat(p.id,c.k))||0)
      maxByCol[c.k]=Math.max(...vals)
    })
    return (
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
        <thead>
          <tr style={{background:'rgba(123,16,32,0.15)'}}>
            {cols.map(c=>(
              <th key={c.k} style={{color:C.orange,fontSize:'8px',letterSpacing:'2px',textAlign:c.k==='#'||c.k==='name'?'left':'center',padding:'9px 6px',borderBottom:`1px solid rgba(232,130,10,0.2)`,fontWeight:'700',whiteSpace:'nowrap'}}>{c.lbl}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map(p=>(
            <tr key={p.id} style={{borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
              {cols.map(c=>{
                const v = getDisplayStat(p.id, c.k)
                const isHi = !SKIP_HI.has(c.k) && parseFloat(v)===maxByCol[c.k] && parseFloat(v)>0
                if (c.k==='#') return <td key={c.k} style={{padding:'9px 6px',fontWeight:'900',color:C.orange2,fontSize:'13px'}}>#{v}</td>
                if (c.k==='name') return <td key={c.k} style={{padding:'9px 6px',textAlign:'left',color:C.cream,minWidth:'100px'}}>{v||''}</td>
                return <td key={c.k} style={{padding:'9px 6px',textAlign:'center',color:isHi?C.orange2:C.text,fontWeight:isHi?'700':'400'}}>{v===null||v===undefined||v===''?'—':v}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const teamPoss = Math.max(events.filter(e=>(e.type||'').toLowerCase()==='poss').length, 1)
  const impactCharts = [
    { title:'USAGE RATE', id:'ur', data: sortedPlayers.map(p=>({ lbl:'#'+getDisplayStat(p.id,'#'), val: parseFloat(((getStat(statsMap,statEvents,p.id,'FG Att')||0)+0.44*(getStat(statsMap,statEvents,p.id,'FT Att')||0)+(getStat(statsMap,statEvents,p.id,'TO')||0))/teamPoss*100) })), color: '#E8820A', valFn: v=>v.toFixed(1)+'%' },
    { title:'+/− ON', id:'pm', data: sortedPlayers.map(p=>({ lbl:'#'+getDisplayStat(p.id,'#'), val: getPM(statsMap,p.id) })), color: v=>v>=0?C.green:C.red, valFn: v=>(v>0?'+':'')+v },
    { title:'TRUE SHOOTING %', id:'ts', data: sortedPlayers.map(p=>({ lbl:'#'+getDisplayStat(p.id,'#'), val: getTSpct(statsMap,statEvents,p.id)||0 })), color: C.blue, valFn: v=>(v*100).toFixed(1)+'%' },
    { title:'AST/TO RATIO', id:'astto', data: sortedPlayers.map(p=>{ const v=getAstTo(statsMap,statEvents,p.id); return { lbl:'#'+getDisplayStat(p.id,'#'), val:v===null?0:v===99?3:v } }), color: C.blue, valFn: v=>v>=3?'∞':v.toFixed(1) },
    { title:'HUSTLE (Total)', id:'hustle', data: sortedPlayers.map(p=>({ lbl:'#'+getDisplayStat(p.id,'#'), val: getHustle(statsMap,statEvents,p.id)||0 })), color: '#7C3AED', valFn: v=>v+'/G' },
    { title:'STOCKS (STL+BLK+DEFL)', id:'stocks', data: sortedPlayers.map(p=>({ lbl:'#'+getDisplayStat(p.id,'#'), val: getStocks(statsMap,statEvents,p.id)||0 })), color: C.red, valFn: v=>v+'/G' },
  ]

  const filmEvents = statEvents
    .filter(e=>e.videoTime!==null && !isNaN(e.videoTime))
    .filter(e=>!playerFilter || e.player_id===playerFilter)
    .filter(e=>!statFilter || e.stat===statFilter)
    .sort((a,b)=>a.videoTime-b.videoTime)

  function handleVideoFile(e) {
    const f = e.target.files[0]
    if (!f) return
    if (videoURL) URL.revokeObjectURL(videoURL)
    setVideoURL(URL.createObjectURL(f))
    setVideoLoaded(true)
    showToast('FILM LOADED')
  }

  function jumpTo(ts) {
    if (videoRef.current && videoURL) {
      videoRef.current.currentTime = Math.max(0, ts-5)
      videoRef.current.play()
      setActiveTab('film')
    } else {
      setActiveTab('film')
      showToast('LOAD A FILM TO PLAY CLIPS')
    }
  }

  const allTrendPlayers = [...new Set(seasonGames.flatMap(g=>Object.keys(g.playerStats||{})))]
  const sortedSeasonGames = [...seasonGames].sort((a,b)=>new Date(a.game_date)-new Date(b.game_date))
  const trendLabels = sortedSeasonGames.map((g,i)=>g.opponent||(i+1+''))

  const teamTrends = [
    {label:'Points Scored',  vals:sortedSeasonGames.map(g=>g.teamPts), fmt:v=>v, color:C.orange},
    {label:'Points Allowed', vals:sortedSeasonGames.map(g=>g.oppPts||0), fmt:v=>v, color:C.red},
    {label:'Point Diff',     vals:sortedSeasonGames.map(g=>g.teamPts-(g.oppPts||0)), fmt:v=>(v>0?'+':'')+v, color:C.green},
    {label:'FG%',            vals:sortedSeasonGames.map(g=>{ const ps=Object.values(g.playerStats||{}); const m=ps.reduce((s,p)=>s+(p.fgm||0),0),a=ps.reduce((s,p)=>s+(p.fga||0),0); return a>0?parseFloat((m/a*100).toFixed(1)):0 }), fmt:v=>v+'%', color:C.blue},
    {label:'Turnovers',      vals:sortedSeasonGames.map(g=>{ const ps=Object.values(g.playerStats||{}); return ps.reduce((s,p)=>s+(p.to||0),0) }), fmt:v=>v, color:'#D97706'},
  ]

  function getPlayerTrends(playerLabel) {
    const pg = sortedSeasonGames.filter(g=>g.playerStats?.[playerLabel]?.pts!==undefined)
    return {
      labels: pg.map((g,i)=>g.opponent||(i+1+'')),
      metrics: [
        {label:'Points',   vals:pg.map(g=>g.playerStats[playerLabel].pts||0), fmt:v=>v, color:C.orange},
        {label:'Assists',  vals:pg.map(g=>g.playerStats[playerLabel].ast||0), fmt:v=>v, color:C.blue},
        {label:'Rebounds', vals:pg.map(g=>g.playerStats[playerLabel].reb||0), fmt:v=>v, color:C.green},
        {label:'+/−',      vals:pg.map(g=>g.playerStats[playerLabel].pm||0),  fmt:v=>(v>0?'+':'')+v, color:C.gold},
        {label:'TS%',      vals:pg.map(g=>{ const v=g.playerStats[playerLabel].ts; return v!=null?parseFloat((v*100).toFixed(1)):0 }), fmt:v=>v+'%', color:C.maroon2},
      ]
    }
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'14px',letterSpacing:'4px'}}>LOADING...</div>
  )

  const teamName = teams.find(t=>t.id===selectedTeam)?.name?.toUpperCase() || 'MY TEAM'
  const tabs = [{id:'dashboard',lbl:'Dashboard'},{id:'film',lbl:'Film'},{id:'reports',lbl:'Player Cards'},{id:'season',lbl:'Season'}]

  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:'Georgia,serif',color:C.text}}>

      {/* NAV */}
      <div style={{height:'56px',display:'flex',alignItems:'center',gap:'12px',padding:'0 20px',background:'rgba(10,10,15,0.97)',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,zIndex:200}}>
        <span style={{fontSize:'18px',fontWeight:'900',letterSpacing:'6px',color:C.orange2}}>SWIVEL</span>
        <div style={{width:'1px',height:'24px',background:C.border2}}/>
        <select value={selectedTeam} onChange={e=>setSelectedTeam(e.target.value)} style={{background:'transparent',border:'none',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'13px',fontWeight:'700',cursor:'pointer',outline:'none'}}>
          {teams.map(t=><option key={t.id} value={t.id} style={{background:C.bg}}>{t.name}</option>)}
        </select>
        <span style={{fontSize:'11px',color:C.muted,flex:1}}>{profile?.full_name||'Coach'}</span>
        <span style={{fontSize:'10px',color:C.muted,letterSpacing:'2px'}}>{games.length} GAMES · {statEvents.length} EVENTS</span>
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
        <select value={selectedGame} onChange={e=>setSelectedGame(e.target.value)} style={{background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'6px',color:C.cream,fontFamily:'Georgia,serif',fontSize:'12px',padding:'6px 10px',outline:'none'}}>
          <option value='all'>All Games</option>
          {games.map(g=><option key={g.id} value={g.id}>{g.opponent} · {g.game_date}</option>)}
        </select>
      </div>

      <div style={{padding:'20px'}}>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{background:'linear-gradient(135deg,rgba(123,16,32,0.4) 0%,rgba(16,16,24,0.95) 60%)',border:`1px solid rgba(232,130,10,0.22)`,borderLeft:`4px solid ${C.orange}`,borderRadius:'10px',padding:'22px 28px',marginBottom:'20px',display:'flex',gap:'32px',flexWrap:'wrap',alignItems:'center',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 50% 120% at 0% 50%,rgba(123,16,32,0.15) 0%,transparent 60%)',pointerEvents:'none'}}/>
              <div><div style={{fontSize:'9px',letterSpacing:'5px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'6px'}}>Team</div><div style={{fontSize:'28px',fontWeight:'900',color:C.cream,letterSpacing:'3px'}}>{teamName}</div></div>
              <div style={{width:'1px',height:'48px',background:'rgba(255,255,255,0.08)'}}/>
              <div><div style={{fontSize:'9px',letterSpacing:'5px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'6px'}}>Record</div><div style={{fontSize:'36px',fontWeight:'900',lineHeight:'1'}}><span style={{color:C.green}}>{wins}</span><span style={{color:'rgba(255,255,255,0.2)',fontSize:'24px',margin:'0 4px'}}>–</span><span style={{color:C.red}}>{losses}</span></div></div>
              <div style={{width:'1px',height:'48px',background:'rgba(255,255,255,0.08)'}}/>
              <div><div style={{fontSize:'9px',letterSpacing:'5px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'6px'}}>Games</div><div style={{fontSize:'36px',fontWeight:'900',color:C.cream}}>{games.length}</div></div>
              <div style={{width:'1px',height:'48px',background:'rgba(255,255,255,0.08)'}}/>
              <div><div style={{fontSize:'9px',letterSpacing:'5px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'6px'}}>Players</div><div style={{fontSize:'36px',fontWeight:'900',color:C.cream}}>{players.length}</div></div>
            </div>
            <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'20px',marginBottom:'20px',overflowX:'auto'}}>
              <div style={{display:'flex',gap:'0',borderBottom:`1px solid ${C.border}`,marginBottom:'14px',flexWrap:'wrap'}}>
                {['gamestats','shooting','totals'].map(t=>(
                  <button key={t} onClick={()=>setActiveBstTab(t)} style={{background:'none',border:'none',borderBottom:activeBstTab===t?`2px solid ${C.orange}`:'2px solid transparent',color:activeBstTab===t?C.orange2:C.muted,fontFamily:'Georgia,serif',fontSize:'10px',fontWeight:'700',letterSpacing:'2px',padding:'10px 16px',cursor:'pointer',textTransform:'uppercase',marginBottom:'-1px',transition:'all 0.15s'}}>
                    {t==='gamestats'?'Game Stats':t==='shooting'?'Shooting':'Totals'}
                  </button>
                ))}
              </div>
              {sortedPlayers.length === 0
                ? <div style={{textAlign:'center',color:C.muted,padding:'40px',fontSize:'13px',letterSpacing:'2px'}}>No players on roster yet</div>
                : <>
                    {renderBstTable(BST_COLS[activeBstTab==='shooting'?'shooting':activeBstTab]||BST_COLS.gamestats)}
                    {activeBstTab==='shooting' && <div style={{marginTop:'16px'}}>{renderBstTable(BST_COLS.shooting2)}</div>}
                  </>
              }
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:'14px'}}>
              {impactCharts.map(chart=>(
                <div key={chart.id} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'18px'}}>
                  <div style={{fontSize:'9px',letterSpacing:'4px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'14px',paddingBottom:'10px',borderBottom:`1px solid ${C.border}`}}>{chart.title}</div>
                  <BarChart data={chart.data} color={chart.color} valFn={chart.valFn}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FILM */}
        {activeTab === 'film' && (
          <div style={{display:'flex',gap:'14px',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0,maxWidth:'calc(100% - 330px)'}}>
              {!videoLoaded && (
                <div style={{background:C.panel,border:`2px dashed rgba(123,16,32,0.5)`,borderRadius:'10px',padding:'48px',textAlign:'center',cursor:'pointer'}} onClick={()=>document.getElementById('film-input').click()}>
                  <div style={{fontSize:'36px',marginBottom:'12px'}}>🎬</div>
                  <div style={{fontSize:'12px',color:C.muted,letterSpacing:'2px'}}>Load a game film to enable video playback</div>
                </div>
              )}
              <input id="film-input" type="file" accept="video/*" style={{display:'none'}} onChange={handleVideoFile}/>
              {videoURL && (
                <div>
                  <video ref={videoRef} src={videoURL} style={{width:'100%',maxHeight:'480px',borderRadius:'10px',background:'#000',objectFit:'contain'}} controls/>
                  <div style={{display:'flex',gap:'8px',marginTop:'10px',flexWrap:'wrap'}}>
                    <button onClick={()=>document.getElementById('film-input').click()} style={{background:'rgba(232,130,10,0.12)',border:`1px solid rgba(232,130,10,0.35)`,borderRadius:'7px',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'10px',padding:'8px 14px',cursor:'pointer',letterSpacing:'1px'}}>📂 Load Film</button>
                    <select onChange={e=>{ if(videoRef.current) videoRef.current.playbackRate=parseFloat(e.target.value) }} style={{background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'7px',color:C.cream,fontFamily:'Georgia,serif',fontSize:'10px',padding:'8px 10px',outline:'none'}}>
                      {[0.25,0.5,0.75,1,1.25,1.5,2].map(r=><option key={r} value={r}>{r}x</option>)}
                    </select>
                  </div>
                </div>
              )}
              {!videoURL && <div style={{marginTop:'12px'}}><button onClick={()=>document.getElementById('film-input').click()} style={{background:'rgba(232,130,10,0.12)',border:`1px solid rgba(232,130,10,0.35)`,borderRadius:'7px',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'10px',padding:'8px 14px',cursor:'pointer',letterSpacing:'1px'}}>📂 Load Film</button></div>}
            </div>
            <div style={{width:'300px',flexShrink:0,display:'flex',flexDirection:'column',gap:'10px'}}>
              <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'14px',display:'flex',flexDirection:'column',gap:'8px'}}>
                <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700'}}>Filters</div>
                <select value={playerFilter} onChange={e=>setPlayerFilter(e.target.value)} style={{background:C.bg,border:`1px solid ${C.border2}`,borderRadius:'6px',color:C.cream,fontFamily:'Georgia,serif',fontSize:'11px',padding:'6px 8px',outline:'none'}}>
                  <option value=''>All Players</option>
                  {players.map(p=><option key={p.id} value={p.id}>#{p.jersey_number} {p.name}</option>)}
                </select>
                <select value={statFilter} onChange={e=>setStatFilter(e.target.value)} style={{background:C.bg,border:`1px solid ${C.border2}`,borderRadius:'6px',color:C.cream,fontFamily:'Georgia,serif',fontSize:'11px',padding:'6px 8px',outline:'none'}}>
                  <option value=''>All Stats</option>
                  {[...new Set(statEvents.map(e=>e.stat))].filter(Boolean).map(s=><option key={s} value={s}>{STAT_LABELS[s]||s}</option>)}
                </select>
              </div>
              <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',maxHeight:'500px',overflowY:'auto'}}>
                <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.border}`,fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',fontWeight:'700'}}>Events ({filmEvents.length})</div>
                {filmEvents.length===0
                  ? <div style={{padding:'20px',textAlign:'center',color:C.muted,fontSize:'11px',letterSpacing:'1px'}}>NO EVENTS MATCH</div>
                  : filmEvents.map((e,i)=>{
                      const player = players.find(p=>p.id===e.player_id)
                      return (
                        <div key={i} onClick={()=>jumpTo(e.videoTime)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 14px',borderBottom:`1px solid rgba(255,255,255,0.04)`,cursor:'pointer'}}
                          onMouseEnter={el=>el.currentTarget.style.background='rgba(255,255,255,0.04)'}
                          onMouseLeave={el=>el.currentTarget.style.background='transparent'}>
                          <span style={{fontSize:'11px',color:C.muted,fontFamily:'Courier New',minWidth:'40px'}}>{fmt(e.videoTime)}</span>
                          <span style={{fontSize:'12px',fontWeight:'700',color:C.orange2,minWidth:'28px'}}>#{player?.jersey_number||'?'}</span>
                          <span style={{fontSize:'11px',color:C.text,flex:1}}>{STAT_LABELS[e.stat]||e.event_type}</span>
                        </div>
                      )
                    })
                }
              </div>
            </div>
          </div>
        )}

        {/* PLAYER CARDS */}
        {activeTab === 'reports' && (
          <div>
            {sortedPlayers.length===0
              ? <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'40px',textAlign:'center',color:C.muted,fontSize:'13px',letterSpacing:'2px'}}>LOAD A GAME TO SEE PLAYER CARDS</div>
              : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'14px'}}>
                  {sortedPlayers.map(p=>{
                    const gp = Math.max(getStat(statsMap,statEvents,p.id,'GP')||1,1)
                    const pm_v = getPM(statsMap,p.id)
                    const ts_v = getTSpct(statsMap,statEvents,p.id)
                    const ppg = (getPts(statsMap,statEvents,p.id)/gp).toFixed(1)
                    const apg = ((getStat(statsMap,statEvents,p.id,'AST')||0)/gp).toFixed(1)
                    const rpg = (((getStat(statsMap,statEvents,p.id,'OREB')||0)+(getStat(statsMap,statEvents,p.id,'DREB')||0))/gp).toFixed(1)
                    const spg = ((getStat(statsMap,statEvents,p.id,'STL')||0)/gp).toFixed(1)
                    const bpg = ((getStat(statsMap,statEvents,p.id,'BLK')||0)/gp).toFixed(1)
                    const ts_disp = ts_v!==null?(ts_v*100).toFixed(1)+'%':'—'
                    const pm_disp = (pm_v>0?'+':'')+pm_v
                    const pm_col = pm_v>0?C.green:pm_v<0?C.red:C.muted
                    const teamName2 = teams.find(t=>t.id===selectedTeam)?.name||'TEAM'
                    return (
                      <div key={p.id} style={{background:'linear-gradient(160deg,rgba(22,22,31,0.98),rgba(14,14,20,0.99))',border:`1px solid ${C.border}`,borderRadius:'12px',padding:'20px',position:'relative',overflow:'hidden'}}>
                        <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:`linear-gradient(90deg,${C.orange},${C.maroon})`}}/>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                          <div>
                            <div style={{fontSize:'32px',fontWeight:'900',color:C.orange2,lineHeight:'1'}}>#{p.jersey_number}</div>
                            <div style={{fontSize:'13px',color:C.cream,fontWeight:'700',marginTop:'2px'}}>{p.name}</div>
                            <div style={{fontSize:'9px',letterSpacing:'3px',color:C.muted,textTransform:'uppercase',marginTop:'2px'}}>{teamName2} · {gp} GP</div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:'9px',letterSpacing:'2px',color:C.muted}}>+/−</div>
                            <div style={{fontSize:'26px',fontWeight:'900',color:pm_col}}>{pm_disp}</div>
                          </div>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                          {[['PPG',ppg],['APG',apg],['RPG',rpg],['SPG',spg],['BPG',bpg],['TS%',ts_disp]].map(([l,v])=>(
                            <div key={l} style={{background:'rgba(255,255,255,0.03)',border:`1px solid rgba(255,255,255,0.06)`,borderRadius:'8px',padding:'10px 8px',textAlign:'center'}}>
                              <div style={{color:C.orange,fontSize:'8px',letterSpacing:'2px',fontWeight:'700',textTransform:'uppercase',marginBottom:'4px'}}>{l}</div>
                              <div style={{fontSize:'20px',fontWeight:'900',color:C.cream,lineHeight:'1'}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}

        {/* SEASON */}
        {activeTab === 'season' && (
          <div>
            {seasonGames.length===0
              ? <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'32px',textAlign:'center',color:C.muted,fontSize:'13px',letterSpacing:'2px'}}>No games yet</div>
              : <>
                  <div style={{display:'flex',gap:'10px',marginBottom:'18px',flexWrap:'wrap'}}>
                    {[{lbl:'Games',val:seasonGames.length},{lbl:'Record',val:`${wins}–${losses}`},{lbl:'Avg Pts For',val:(seasonGames.reduce((s,g)=>s+g.teamPts,0)/seasonGames.length).toFixed(1)},{lbl:'Avg Pts Ag',val:(seasonGames.reduce((s,g)=>s+(g.oppPts||0),0)/seasonGames.length).toFixed(1)}].map(({lbl,val})=>(
                      <div key={lbl} style={{background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'10px',padding:'12px 18px',textAlign:'center'}}>
                        <div style={{fontSize:'9px',letterSpacing:'3px',color:C.orange,textTransform:'uppercase',marginBottom:'4px'}}>{lbl}</div>
                        <div style={{fontSize:'22px',fontWeight:'900',color:C.cream}}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:'9px',letterSpacing:'4px',color:C.orange,textTransform:'uppercase',fontWeight:'700',marginBottom:'10px'}}>Game Log</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'28px'}}>
                    {[...seasonGames].reverse().map(g=>{
                      const win=g.teamPts>(g.oppPts||0)
                      return (
                        <div key={g.id} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'16px 20px',display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:'14px',fontWeight:'700',color:C.cream}}>vs {g.opponent}</div>
                            <div style={{fontSize:'11px',color:C.muted,marginTop:'2px'}}>{g.game_date}</div>
                          </div>
                          <div style={{fontSize:'20px',fontWeight:'900',color:win?C.green:C.red}}>{g.teamPts}–{g.oppPts||'?'}</div>
                          <div style={{fontSize:'12px',fontWeight:'700',color:win?C.green:C.red}}>{win?'W':'L'}</div>
                          <button onClick={()=>setReportGame(g)} style={{background:'rgba(232,130,10,0.12)',border:`1px solid rgba(232,130,10,0.35)`,borderRadius:'6px',color:C.orange2,fontFamily:'Georgia,serif',fontSize:'10px',fontWeight:'700',padding:'6px 12px',cursor:'pointer',letterSpacing:'1px'}}>📋 Report</button>
                        </div>
                      )
                    })}
                  </div>
                  {sortedSeasonGames.length >= 2 && (
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'14px',flexWrap:'wrap'}}>
                        <div style={{fontSize:'9px',letterSpacing:'4px',color:C.orange,textTransform:'uppercase',fontWeight:'700'}}>Trends</div>
                        <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                          <button onClick={()=>{setActiveTrend('team');setTrendPlayer('')}} style={{background:activeTrend==='team'?C.maroon:'rgba(255,255,255,0.05)',border:`1px solid ${activeTrend==='team'?C.orange:C.border}`,borderRadius:'5px',color:activeTrend==='team'?C.orange2:C.muted,fontFamily:'Georgia,serif',fontSize:'10px',padding:'5px 12px',cursor:'pointer',letterSpacing:'1px',fontWeight:'700'}}>TEAM</button>
                          {allTrendPlayers.map(p=>(
                            <button key={p} onClick={()=>{setActiveTrend('player');setTrendPlayer(p)}} style={{background:activeTrend==='player'&&trendPlayer===p?C.maroon:'rgba(255,255,255,0.05)',border:`1px solid ${activeTrend==='player'&&trendPlayer===p?C.orange:C.border}`,borderRadius:'5px',color:activeTrend==='player'&&trendPlayer===p?C.orange2:C.muted,fontFamily:'Georgia,serif',fontSize:'10px',padding:'5px 12px',cursor:'pointer',letterSpacing:'1px',fontWeight:'700'}}>{p}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'12px'}}>
                        {(activeTrend==='team' ? teamTrends : (trendPlayer ? getPlayerTrends(trendPlayer).metrics : [])).map(m=>(
                          <SparkLine key={m.label} vals={m.vals} labels={activeTrend==='team'?trendLabels:getPlayerTrends(trendPlayer).labels} color={m.color} label={m.label} fmtFn={m.fmt}/>
                        ))}
                      </div>
                    </div>
                  )}
                </>
            }
          </div>
        )}
      </div>

      {toast && <div style={{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',background:C.maroon,border:`1px solid ${C.orange}`,borderRadius:'8px',padding:'10px 20px',fontSize:'11px',letterSpacing:'3px',color:C.orange2,fontWeight:'700',textTransform:'uppercase',zIndex:500,pointerEvents:'none'}}>{toast}</div>}
      {reportGame && <PostGameReport game={reportGame} onClose={()=>setReportGame(null)}/>}
    </div>
  )
}