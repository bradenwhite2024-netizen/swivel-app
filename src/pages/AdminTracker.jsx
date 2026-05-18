import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const STATS = [
  { label: '2PT Made', key: '2pt made', category: 'scoring' },
  { label: '2PT Att', key: '2pt att', category: 'scoring' },
  { label: '3PT Made', key: '3pt made', category: 'scoring' },
  { label: '3PT Att', key: '3pt att', category: 'scoring' },
  { label: 'FT Made', key: 'ft made', category: 'scoring' },
  { label: 'FT Att', key: 'ft att', category: 'scoring' },
  { label: 'AST', key: 'ast', category: 'playmaking' },
  { label: 'TO', key: 'to', category: 'playmaking' },
  { label: 'OREB', key: 'oreb', category: 'rebounding' },
  { label: 'DREB', key: 'dreb', category: 'rebounding' },
  { label: 'STL', key: 'stl', category: 'defense' },
  { label: 'BLK', key: 'blk', category: 'defense' },
  { label: 'DEFL', key: 'defl', category: 'defense' },
  { label: 'CHG', key: 'chg', category: 'defense' },
  { label: 'FOUL', key: 'foul', category: 'fouls' },
]

const s = {
  bg: '#0a0a0f', surface: '#111118', panel: '#16161f',
  border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
  maroon: '#7B1020', maroon2: '#9B1828', orange: '#E8820A', orange2: '#F5A030',
  cream: '#EDE0C4', text: '#D4C8A8', muted: 'rgba(212,200,168,0.45)',
  green: '#16A34A', red: '#DC2626', blue: '#2563EB',
}

const input = { background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: '6px', color: '#EDE0C4', fontFamily: 'Georgia,serif', fontSize: '13px', padding: '8px 10px', outline: 'none', width: '100%', boxSizing: 'border-box' }

export default function AdminTracker({ profile }) {
  const [screen, setScreen] = useState('setup')
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [activePlayer, setActivePlayer] = useState(null)
  const [onCourt, setOnCourt] = useState([])
  const [events, setEvents] = useState([])
  const [filmTime, setFilmTime] = useState(0)
  const [toast, setToast] = useState('')
  const [undoStack, setUndoStack] = useState([])
  const [newPlayerNum, setNewPlayerNum] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerPos, setNewPlayerPos] = useState('Guard')
  const [newOpp, setNewOpp] = useState('')
  const [newDate, setNewDate] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [addingGame, setAddingGame] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => { fetchTeams() }, [])
  useEffect(() => { if (selectedTeam) { fetchGames(selectedTeam); fetchPlayers(selectedTeam) } }, [selectedTeam])

  async function fetchTeams() {
    const { data } = await supabase.from('teams').select('*')
    setTeams(data || [])
  }
  async function fetchGames(teamId) {
    const { data } = await supabase.from('games').select('*').eq('team_id', teamId).order('game_date', { ascending: false })
    setGames(data || [])
  }
  async function fetchPlayers(teamId) {
    const { data } = await supabase.from('players').select('*').eq('team_id', teamId).eq('active', true).order('jersey_number')
    setPlayers(data || [])
    if (data?.length) { setActivePlayer(data[0]); setOnCourt(data.slice(0, 5).map(p => p.id)) }
  }

  async function addTeam() {
    if (!newTeamName) { showToast('ENTER TEAM NAME'); return }
    const { data, error } = await supabase.from('teams').insert({ org_id: '00000000-0000-0000-0000-000000000001', name: newTeamName, season: '2025-26' }).select().single()
    if (error) { showToast('ERROR: ' + error.message); return }
    setTeams(prev => [...prev, data])
    setSelectedTeam(data.id)
    setNewTeamName('')
    setAddingTeam(false)
    showToast('TEAM ADDED · ' + newTeamName)
  }

  async function addPlayer() {
    if (!newPlayerNum || !selectedTeam) { showToast('ENTER JERSEY NUMBER'); return }
    const { data, error } = await supabase.from('players').insert({
      team_id: selectedTeam,
      name: newPlayerName || 'Player ' + newPlayerNum,
      jersey_number: parseInt(newPlayerNum),
      position: newPlayerPos,
      active: true
    }).select().single()
    if (error) { showToast('ERROR: ' + error.message); return }
    setPlayers(prev => [...prev, data].sort((a, b) => a.jersey_number - b.jersey_number))
    setNewPlayerNum(''); setNewPlayerName(''); setAddingPlayer(false)
    showToast('PLAYER #' + newPlayerNum + ' ADDED')
  }

  async function removePlayer(playerId) {
    await supabase.from('players').update({ active: false }).eq('id', playerId)
    setPlayers(prev => prev.filter(p => p.id !== playerId))
    showToast('PLAYER REMOVED')
  }

  async function addGame() {
    if (!newOpp || !selectedTeam) { showToast('ENTER OPPONENT'); return }
    const { data, error } = await supabase.from('games').insert({
      team_id: selectedTeam, opponent: newOpp,
      game_date: newDate || new Date().toISOString().split('T')[0],
      team_score: 0, opp_score: 0
    }).select().single()
    if (error) { showToast('ERROR: ' + error.message); return }
    setGames(prev => [data, ...prev])
    setSelectedGame(data.id)
    setNewOpp(''); setNewDate(''); setAddingGame(false)
    showToast('GAME ADDED · ' + newOpp)
  }

  function fmt(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  async function logEvent(eventLabel, type, playerId = null) {
    if (!selectedGame) { showToast('SELECT A GAME FIRST'); return }
    const ts = videoRef.current ? videoRef.current.currentTime : filmTime
    const event = { game_id: selectedGame, player_id: playerId || activePlayer?.id || null, event_type: eventLabel, timestamp_sec: parseFloat(ts.toFixed(1)), period: 'game' }
    const { data, error } = await supabase.from('events').insert(event).select().single()
    if (error) { showToast('ERROR: ' + error.message); return }
    setEvents(prev => [...prev, { ...event, id: data.id, label: eventLabel }])
    setUndoStack(prev => [...prev, data.id])
    showToast(eventLabel + (activePlayer ? ' · #' + activePlayer.jersey_number : ''))
  }

  async function undoLast() {
    if (!undoStack.length) return
    const lastId = undoStack[undoStack.length - 1]
    await supabase.from('events').delete().eq('id', lastId)
    setUndoStack(prev => prev.slice(0, -1))
    setEvents(prev => prev.filter(e => e.id !== lastId))
    showToast('UNDONE')
  }

  function toggleOnCourt(playerId) {
    setOnCourt(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId])
  }

  function loadVideoFile(e) {
    const file = e.target.files[0]
    if (!file || !videoRef.current) return
    videoRef.current.src = URL.createObjectURL(file)
    showToast('FILM LOADED')
  }

  const recentEvents = [...events].reverse().slice(0, 8)

  // ── SETUP SCREEN ──
  if (screen === 'setup') return (
    <div style={{ minHeight: '100vh', background: s.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Georgia,serif' }}>
      <div style={{ height: '48px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', background: 'rgba(10,10,15,0.95)', borderBottom: `1px solid ${s.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '6px', color: s.orange2 }}>SWIVEL</span>
        <div style={{ width: '1px', height: '24px', background: s.border2 }} />
        <span style={{ fontSize: '11px', color: s.muted, flex: 1 }}>Internal Tagging Tool · Admin Only</span>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${s.border2}`, borderRadius: '6px', color: s.muted, fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>Sign out</button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
        <div style={{ background: s.panel, border: `1px solid ${s.border2}`, borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '520px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '5px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '24px', paddingBottom: '12px', borderBottom: `1px solid ${s.border}` }}>Game Setup</div>

          {/* TEAM */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '3px', color: s.muted, textTransform: 'uppercase' }}>Team</div>
              <button onClick={() => setAddingTeam(!addingTeam)} style={{ background: 'rgba(232,130,10,0.12)', border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '3px 8px', cursor: 'pointer', letterSpacing: '1px' }}>+ New Team</button>
            </div>
            {addingTeam && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input placeholder='Team name' value={newTeamName} onChange={e => setNewTeamName(e.target.value)} style={input} />
                <button onClick={addTeam} style={{ background: s.green, border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
            )}
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} style={{ ...input }}>
              <option value=''>Select team...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* ROSTER */}
          {selectedTeam && (
            <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.border}`, borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700' }}>Roster ({players.length})</div>
                <button onClick={() => setAddingPlayer(!addingPlayer)} style={{ background: 'rgba(232,130,10,0.12)', border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '3px 8px', cursor: 'pointer' }}>+ Add Player</button>
              </div>
              {addingPlayer && (
                <div style={{ marginBottom: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: '6px', marginBottom: '6px' }}>
                    <input placeholder='# Jersey' value={newPlayerNum} onChange={e => setNewPlayerNum(e.target.value)} style={input} />
                    <input placeholder='Name (optional)' value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} style={input} />
                    <select value={newPlayerPos} onChange={e => setNewPlayerPos(e.target.value)} style={input}>
                      {['Guard', 'Forward', 'Center'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <button onClick={addPlayer} style={{ width: '100%', background: s.green, border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '8px', cursor: 'pointer', letterSpacing: '2px' }}>CONFIRM ADD</button>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {players.length === 0 && <div style={{ fontSize: '11px', color: s.muted, letterSpacing: '1px' }}>No players yet — add your roster above</div>}
                {players.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(232,130,10,0.12)', border: `1px solid ${s.orange}`, borderRadius: '6px', padding: '4px 8px' }}>
                    <span style={{ fontSize: '12px', color: s.orange2, fontWeight: '700' }}>#{p.jersey_number}</span>
                    <span style={{ fontSize: '10px', color: s.muted }}>{p.name}</span>
                    <button onClick={() => removePlayer(p.id)} style={{ background: 'none', border: 'none', color: s.muted, cursor: 'pointer', fontSize: '11px', padding: '0 2px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GAME */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '3px', color: s.muted, textTransform: 'uppercase' }}>Game</div>
              <button onClick={() => setAddingGame(!addingGame)} style={{ background: 'rgba(232,130,10,0.12)', border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '3px 8px', cursor: 'pointer' }}>+ New Game</button>
            </div>
            {addingGame && (
              <div style={{ marginBottom: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                  <input placeholder='Opponent name' value={newOpp} onChange={e => setNewOpp(e.target.value)} style={input} />
                  <input type='date' value={newDate} onChange={e => setNewDate(e.target.value)} style={input} />
                </div>
                <button onClick={addGame} style={{ width: '100%', background: s.green, border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '8px', cursor: 'pointer', letterSpacing: '2px' }}>CREATE GAME</button>
              </div>
            )}
            <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)} style={{ ...input }}>
              <option value=''>Select game...</option>
              {games.map(g => <option key={g.id} value={g.id}>{g.opponent} · {g.game_date}</option>)}
            </select>
          </div>

          <button onClick={() => { if (!selectedTeam || !selectedGame) { showToast('SELECT TEAM AND GAME'); return } setScreen('tracking') }}
            style={{ width: '100%', background: `linear-gradient(135deg, ${s.maroon}, ${s.maroon2})`, border: `1px solid ${s.orange}`, borderRadius: '10px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '14px', fontWeight: '900', padding: '16px', letterSpacing: '6px', textTransform: 'uppercase', cursor: 'pointer' }}>
            START TAGGING →
          </button>
        </div>
      </div>
      {toast && <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: s.orange, color: s.maroon, fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', letterSpacing: '2px', padding: '10px 20px', borderRadius: '8px', zIndex: 9999 }}>{toast}</div>}
    </div>
  )

  // ── TRACKING SCREEN ──
  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'Georgia,serif', color: s.text }}>
      <div style={{ height: '48px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', background: 'rgba(10,10,15,0.95)', borderBottom: `1px solid ${s.border}`, position: 'sticky', top: 0, zIndex: 200 }}>
        <span style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '6px', color: s.orange2 }}>SWIVEL</span>
        <div style={{ width: '1px', height: '20px', background: s.border2 }} />
        <span style={{ fontSize: '10px', color: s.muted, flex: 1 }}>TAGGING · {games.find(g => g.id === selectedGame)?.opponent || 'Game'}</span>
        <button onClick={undoLast} style={{ padding: '5px 12px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia,serif', fontWeight: '700' }}>↩ UNDO</button>
        <button onClick={() => setScreen('setup')} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${s.border2}`, borderRadius: '6px', color: s.muted, fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>← Back</button>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Film player */}
        <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px' }}>
          <video ref={videoRef} style={{ width: '100%', maxHeight: '200px', background: '#000', borderRadius: '6px', display: 'block' }} onTimeUpdate={() => setFilmTime(videoRef.current?.currentTime || 0)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '20px', fontWeight: '900', color: s.orange2, fontFamily: 'Courier New,monospace', minWidth: '60px' }}>{fmt(filmTime)}</span>
            <input type='range' min='0' max={videoRef.current?.duration || 100} value={filmTime} step='0.1' onChange={e => { if (videoRef.current) videoRef.current.currentTime = e.target.value; setFilmTime(+e.target.value) }} style={{ flex: 1, accentColor: s.orange }} />
            <button onClick={() => { if (videoRef.current) { videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause() } }} style={{ background: s.maroon, border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '6px 14px', cursor: 'pointer', letterSpacing: '1px' }}>▶ PLAY</button>
            {[-5, 5].map(n => <button key={n} onClick={() => { if (videoRef.current) videoRef.current.currentTime += n }} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.border2}`, borderRadius: '6px', color: s.text, fontSize: '11px', padding: '6px 10px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>{n > 0 ? '+' : ''}{n}s</button>)}
            <label style={{ background: s.blue, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '900', padding: '6px 12px', cursor: 'pointer', fontFamily: 'Georgia,serif', letterSpacing: '1px' }}>
              📂 LOAD FILM<input type='file' accept='video/*' onChange={loadVideoFile} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Possession + Opp */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Possession</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => logEvent('Offensive Possession', 'poss', null)} style={{ flex: 1, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.4)', borderRadius: '6px', color: '#4ade80', fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '8px 4px', cursor: 'pointer', letterSpacing: '1px' }}>+ OFF</button>
              <button onClick={() => logEvent('Defensive Possession', 'poss', null)} style={{ flex: 1, background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.4)', borderRadius: '6px', color: '#60a5fa', fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '8px 4px', cursor: 'pointer', letterSpacing: '1px' }}>+ DEF</button>
            </div>
          </div>
          <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Opp Score</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3].map(n => <button key={n} onClick={() => logEvent('Opponent +' + n, 'opp', null)} style={{ flex: 1, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '6px', color: '#f87171', fontFamily: 'Georgia,serif', fontSize: '12px', fontWeight: '900', padding: '8px 4px', cursor: 'pointer' }}>+{n}</button>)}
            </div>
          </div>
        </div>

        {/* Active player */}
        <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '10px' }}>Active Player</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {players.map(p => (
              <button key={p.id} onClick={() => setActivePlayer(p)} style={{ background: activePlayer?.id === p.id ? s.orange : 'rgba(255,255,255,0.04)', border: `1px solid ${activePlayer?.id === p.id ? s.orange : s.border2}`, borderRadius: '6px', color: activePlayer?.id === p.id ? s.maroon : s.text, fontFamily: 'Georgia,serif', fontSize: '13px', fontWeight: '900', padding: '6px 12px', cursor: 'pointer' }}>#{p.jersey_number}</button>
            ))}
          </div>
        </div>

        {/* On court */}
        <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '10px' }}>On Court ({onCourt.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {players.map(p => (
              <button key={p.id} onClick={() => toggleOnCourt(p.id)} style={{ background: onCourt.includes(p.id) ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.04)', border: `1px solid ${onCourt.includes(p.id) ? '#3b82f6' : s.border2}`, borderRadius: '6px', color: onCourt.includes(p.id) ? '#93c5fd' : s.muted, fontFamily: 'Georgia,serif', fontSize: '12px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer' }}>#{p.jersey_number}</button>
            ))}
          </div>
        </div>

        {/* Stat buttons */}
        {['scoring', 'playmaking', 'rebounding', 'defense', 'fouls'].map(cat => {
          const catStats = STATS.filter(st => st.category === cat)
          return (
            <div key={cat} style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '10px' }}>{cat}</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(catStats.length, 3)}, 1fr)`, gap: '6px' }}>
                {catStats.map(stat => (
                  <button key={stat.key} onClick={() => logEvent(stat.label, 'stat')} style={{ background: s.maroon, border: `1px solid ${s.orange}`, borderRadius: '8px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '12px', fontWeight: '900', padding: '12px 8px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>{stat.label}</button>
                ))}
              </div>
            </div>
          )
        })}

        {/* Recent events */}
        <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px', marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '10px' }}>Recent ({events.length} total)</div>
          {recentEvents.length === 0 && <div style={{ fontSize: '11px', color: s.muted, letterSpacing: '1px' }}>No events yet — start tagging</div>}
          {recentEvents.map((e, i) => {
            const player = players.find(p => p.id === e.player_id)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${s.border}` }}>
                <span style={{ background: 'rgba(123,16,32,0.5)', border: '1px solid rgba(123,16,32,0.8)', borderRadius: '4px', padding: '2px 7px', fontSize: '10px', color: s.orange2, fontFamily: 'Courier New,monospace', fontWeight: '700', flexShrink: 0 }}>{fmt(e.timestamp_sec)}</span>
                {player && <span style={{ background: s.orange, borderRadius: '4px', padding: '2px 7px', fontSize: '10px', fontWeight: '900', color: s.maroon, flexShrink: 0 }}>#{player.jersey_number}</span>}
                <span style={{ fontSize: '12px', color: s.text, flex: 1 }}>{e.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: s.orange, color: s.maroon, fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', letterSpacing: '2px', padding: '10px 20px', borderRadius: '8px', zIndex: 9999 }}>{toast}</div>}
    </div>
  )
}