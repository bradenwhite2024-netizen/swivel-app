import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const STATS = [
  { label: '2PT Made', category: 'scoring' },
  { label: '2PT Att',  category: 'scoring' },
  { label: '3PT Made', category: 'scoring' },
  { label: '3PT Att',  category: 'scoring' },
  { label: 'FT Made',  category: 'scoring' },
  { label: 'FT Att',   category: 'scoring' },
  { label: 'AST',      category: 'playmaking' },
  { label: 'TO',       category: 'playmaking' },
  { label: 'OREB',     category: 'rebounding' },
  { label: 'DREB',     category: 'rebounding' },
  { label: 'STL',      category: 'defense' },
  { label: 'BLK',      category: 'defense' },
  { label: 'DEFL',     category: 'defense' },
  { label: 'CHG',      category: 'defense' },
  { label: 'FOUL',     category: 'fouls' },
]

const s = {
  bg: '#0a0a0f', surface: '#111118', panel: '#16161f',
  border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
  maroon: '#7B1020', maroon2: '#9B1828', orange: '#E8820A', orange2: '#F5A030',
  cream: '#EDE0C4', text: '#D4C8A8', muted: 'rgba(212,200,168,0.45)',
  green: '#16A34A', red: '#DC2626', blue: '#2563EB',
}

const inp = {
  background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: '6px', color: '#EDE0C4', fontFamily: 'Georgia,serif',
  fontSize: '13px', padding: '8px 10px', outline: 'none', width: '100%', boxSizing: 'border-box'
}


export default function AdminTracker({ profile }) {
  const [screen, setScreen]           = useState('setup')
  const [teams, setTeams]             = useState([])
  const [games, setGames]             = useState([])
  const [players, setPlayers]         = useState([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [activePlayer, setActivePlayer] = useState(null)
  const [onCourt, setOnCourt]         = useState([])
  const [events, setEvents]           = useState([])
  const [filmTime, setFilmTime]       = useState(0)
  const [toast, setToast]             = useState('')
  const [undoStack, setUndoStack]     = useState([])
  const [newPlayerNum, setNewPlayerNum] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerPos, setNewPlayerPos] = useState('Guard')
  const [newOpp, setNewOpp]           = useState('')
  const [newDate, setNewDate]         = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [addingGame, setAddingGame]   = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [addingTeam, setAddingTeam]   = useState(false)
  const [editingGameName, setEditingGameName] = useState(false)
  const [gameNameEdit, setGameNameEdit] = useState('')
  const [uploadProgress, setUploadProgress] = useState(null)
  const [filmUploaded, setFilmUploaded] = useState(false)
  const [floatVideo, setFloatVideo]   = useState(false)
  const [addingPlayerMid, setAddingPlayerMid] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
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
    setNewTeamName(''); setAddingTeam(false)
    showToast('TEAM ADDED · ' + newTeamName)
  }

  async function addPlayer(mid = false) {
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
    setNewPlayerNum(''); setNewPlayerName('')
    if (mid) setAddingPlayerMid(false)
    else setAddingPlayer(false)
    setActivePlayer(data)
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

  async function saveGameName() {
    if (!gameNameEdit.trim()) return
    await supabase.from('games').update({ opponent: gameNameEdit }).eq('id', selectedGame)
    setGames(prev => prev.map(g => g.id === selectedGame ? { ...g, opponent: gameNameEdit } : g))
    setEditingGameName(false)
    showToast('GAME NAME UPDATED')
  }

  async function uploadFilm() {
    if (!selectedFile) { showToast('LOAD A FILM FILE FIRST'); return }
    if (!selectedGame) { showToast('SELECT A GAME FIRST'); return }
    setUploadProgress(10)
    try {
      const res = await fetch('/api/upload-film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeam, gameId: selectedGame, fileSize: selectedFile.size })
      })
      const json = await res.json()
      if (!json.url) throw new Error(json.error || 'No URL returned')
      setUploadProgress(30)
      const putRes = await fetch(json.url, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': 'video/mp4' }
      })
      if (!putRes.ok) throw new Error('Upload failed: ' + putRes.status)
      setUploadProgress(90)
      const filmUrl = `${import.meta.env.VITE_R2_PUBLIC_URL}/${json.key}`
      await supabase.from('games').update({ film_url: filmUrl }).eq('id', selectedGame)
      setGames(prev => prev.map(g => g.id === selectedGame ? { ...g, film_url: filmUrl } : g))
      setFilmUploaded(true)
      setUploadProgress(null)
      showToast('FILM UPLOADED TO CLOUD ✓')
    } catch (err) {
      setUploadProgress(null)
      showToast('UPLOAD ERROR: ' + err.message)
    }
  }

  function loadVideoFile(e) {
    const file = e.target.files[0]
    if (!file || !videoRef.current) return
    setSelectedFile(file)
    videoRef.current.src = URL.createObjectURL(file)
    showToast('FILM LOADED · ' + file.name)
  }

  function fmt(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function logEvent(eventLabel, type = 'stat', playerId = null) {
    if (!selectedGame) { showToast('SELECT A GAME FIRST'); return }
    const ts = videoRef.current ? videoRef.current.currentTime : filmTime
    const event = {
      game_id: selectedGame,
      player_id: type === 'stat' ? (playerId || activePlayer?.id || null) : null,
      event_type: eventLabel,
      timestamp_sec: parseFloat(ts.toFixed(1)),
      period: 'game'
    }
    const { data, error } = await supabase.from('events').insert(event).select().single()
    if (error) { showToast('ERROR: ' + error.message); return }
    setEvents(prev => [...prev, { ...event, id: data.id, label: eventLabel }])
    setUndoStack(prev => [...prev, data.id])
    showToast(eventLabel + (activePlayer && type === 'stat' ? ' · #' + activePlayer.jersey_number : ''))
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

  const recentEvents = [...events].reverse().slice(0, 10)
  const currentGame = games.find(g => g.id === selectedGame)

  if (screen === 'setup') return (
    <div style={{ minHeight: '100vh', background: s.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Georgia,serif' }}>
      <div style={{ height: '48px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', background: 'rgba(10,10,15,0.95)', borderBottom: `1px solid ${s.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '6px', color: s.orange2 }}>SWIVEL</span>
        <div style={{ width: '1px', height: '24px', background: s.border2 }} />
        <span style={{ fontSize: '11px', color: s.muted, flex: 1 }}>Admin Tagging Tool</span>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${s.border2}`, borderRadius: '6px', color: s.muted, fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>Sign out</button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
        <div style={{ background: s.panel, border: `1px solid ${s.border2}`, borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '520px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '5px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '24px', paddingBottom: '12px', borderBottom: `1px solid ${s.border}` }}>Game Setup</div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '3px', color: s.muted, textTransform: 'uppercase' }}>Team</div>
              <button onClick={() => setAddingTeam(!addingTeam)} style={{ background: 'rgba(232,130,10,0.12)', border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '3px 8px', cursor: 'pointer' }}>+ New Team</button>
            </div>
            {addingTeam && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input placeholder='Team name' value={newTeamName} onChange={e => setNewTeamName(e.target.value)} style={inp} />
                <button onClick={addTeam} style={{ background: s.green, border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
            )}
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} style={inp}>
              <option value=''>Select team...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {selectedTeam && (
            <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.border}`, borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700' }}>Roster ({players.length})</div>
                <button onClick={() => setAddingPlayer(!addingPlayer)} style={{ background: 'rgba(232,130,10,0.12)', border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '3px 8px', cursor: 'pointer' }}>+ Add Player</button>
              </div>
              {addingPlayer && (
                <div style={{ marginBottom: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: '6px', marginBottom: '6px' }}>
                    <input placeholder='# Jersey' value={newPlayerNum} onChange={e => setNewPlayerNum(e.target.value)} style={inp} />
                    <input placeholder='Name' value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} style={inp} />
                    <select value={newPlayerPos} onChange={e => setNewPlayerPos(e.target.value)} style={inp}>
                      {['Guard', 'Forward', 'Center'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <button onClick={() => addPlayer(false)} style={{ width: '100%', background: s.green, border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '8px', cursor: 'pointer', letterSpacing: '2px' }}>CONFIRM ADD</button>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {players.length === 0 && <div style={{ fontSize: '11px', color: s.muted }}>No players yet</div>}
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

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '3px', color: s.muted, textTransform: 'uppercase' }}>Game</div>
              <button onClick={() => setAddingGame(!addingGame)} style={{ background: 'rgba(232,130,10,0.12)', border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '3px 8px', cursor: 'pointer' }}>+ New Game</button>
            </div>
            {addingGame && (
              <div style={{ marginBottom: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                  <input placeholder='Opponent name' value={newOpp} onChange={e => setNewOpp(e.target.value)} style={inp} />
                  <input type='date' value={newDate} onChange={e => setNewDate(e.target.value)} style={inp} />
                </div>
                <button onClick={addGame} style={{ width: '100%', background: s.green, border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '8px', cursor: 'pointer', letterSpacing: '2px' }}>CREATE GAME</button>
              </div>
            )}
            <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)} style={inp}>
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

  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'Georgia,serif', color: s.text }}>
      <div style={{ height: '48px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', background: 'rgba(10,10,15,0.95)', borderBottom: `1px solid ${s.border}`, position: 'sticky', top: 0, zIndex: 200 }}>
        <span style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '6px', color: s.orange2 }}>SWIVEL</span>
        <div style={{ width: '1px', height: '20px', background: s.border2 }} />

        {editingGameName ? (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input value={gameNameEdit} onChange={e => setGameNameEdit(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveGameName()} style={{ ...inp, width: '160px', fontSize: '11px', padding: '4px 8px' }} autoFocus />
            <button onClick={saveGameName} style={{ background: s.green, border: 'none', borderRadius: '5px', color: '#fff', fontSize: '10px', fontWeight: '900', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>Save</button>
            <button onClick={() => setEditingGameName(false)} style={{ background: 'none', border: `1px solid ${s.border2}`, borderRadius: '5px', color: s.muted, fontSize: '10px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: s.muted }}>vs {currentGame?.opponent}</span>
            <button onClick={() => { setGameNameEdit(currentGame?.opponent || ''); setEditingGameName(true) }} style={{ background: 'rgba(232,130,10,0.1)', border: `1px solid rgba(232,130,10,0.3)`, borderRadius: '4px', color: s.orange2, fontSize: '9px', padding: '2px 7px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>✏ Edit</button>
          </div>
        )}

        <span style={{ fontSize: '10px', color: s.muted, flex: 1 }}>{events.length} events tagged</span>
        <button onClick={() => setFloatVideo(!floatVideo)} style={{ padding: '5px 10px', background: floatVideo ? s.maroon : 'rgba(255,255,255,0.04)', border: `1px solid ${floatVideo ? s.orange : s.border2}`, borderRadius: '6px', color: floatVideo ? s.orange2 : s.muted, fontSize: '10px', cursor: 'pointer', fontFamily: 'Georgia,serif', fontWeight: '700' }}>⧉ Float Video</button>
        <button onClick={undoLast} style={{ padding: '5px 12px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia,serif', fontWeight: '700' }}>↩ UNDO</button>
        <button onClick={() => setScreen('setup')} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${s.border2}`, borderRadius: '6px', color: s.muted, fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>← Back</button>
      </div>

      {floatVideo && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '380px', zIndex: 500, background: s.panel, border: `1px solid ${s.border2}`, borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          <div style={{ padding: '6px 10px', background: 'rgba(123,16,32,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', letterSpacing: '2px', color: s.orange2, fontWeight: '700' }}>FILM · {fmt(filmTime)}</span>
            <button onClick={() => setFloatVideo(false)} style={{ background: 'none', border: 'none', color: s.muted, cursor: 'pointer', fontSize: '14px' }}>✕</button>
          </div>
          <video ref={floatVideo ? videoRef : undefined} style={{ width: '100%', maxHeight: '200px', background: '#000', display: 'block' }} onTimeUpdate={() => setFilmTime(videoRef.current?.currentTime || 0)} controls />
          <div style={{ padding: '8px 10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[-5, 5].map(n => <button key={n} onClick={() => { if (videoRef.current) videoRef.current.currentTime += n }} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.border2}`, borderRadius: '5px', color: s.text, fontSize: '10px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>{n > 0 ? '+' : ''}{n}s</button>)}
            <label style={{ background: s.blue, border: 'none', borderRadius: '5px', color: '#fff', fontSize: '10px', fontWeight: '900', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>
              📂 Load<input type='file' accept='video/*' onChange={loadVideoFile} style={{ display: 'none' }} />
            </label>
            {selectedFile && !filmUploaded && (
              <button onClick={uploadFilm} style={{ background: s.maroon, border: `1px solid ${s.orange}`, borderRadius: '5px', color: s.orange2, fontSize: '10px', fontWeight: '900', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>
                {uploadProgress !== null ? `${uploadProgress}%` : '☁ Upload'}
              </button>
            )}
            {filmUploaded && <span style={{ fontSize: '10px', color: s.green, alignSelf: 'center' }}>✓ Uploaded</span>}
          </div>
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {!floatVideo && (
          <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px' }}>
            <video ref={videoRef} style={{ width: '100%', maxHeight: '220px', background: '#000', borderRadius: '6px', display: 'block' }} onTimeUpdate={() => setFilmTime(videoRef.current?.currentTime || 0)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px', fontWeight: '900', color: s.orange2, fontFamily: 'Courier New,monospace', minWidth: '60px' }}>{fmt(filmTime)}</span>
              <input type='range' min='0' max={videoRef.current?.duration || 100} value={filmTime} step='0.1'
                onChange={e => { if (videoRef.current) videoRef.current.currentTime = e.target.value; setFilmTime(+e.target.value) }}
                style={{ flex: 1, accentColor: s.orange }} />
              <button onClick={() => { if (videoRef.current) { videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause() } }}
                style={{ background: s.maroon, border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '6px 14px', cursor: 'pointer' }}>▶ PLAY</button>
              {[-5, 5].map(n => <button key={n} onClick={() => { if (videoRef.current) videoRef.current.currentTime += n }} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.border2}`, borderRadius: '6px', color: s.text, fontSize: '11px', padding: '6px 10px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>{n > 0 ? '+' : ''}{n}s</button>)}
              <label style={{ background: s.blue, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '900', padding: '6px 12px', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>
                📂 LOAD FILM<input type='file' accept='video/*' onChange={loadVideoFile} style={{ display: 'none' }} />
              </label>
              {selectedFile && !filmUploaded && (
                <button onClick={uploadFilm} style={{ background: s.maroon, border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '6px 12px', cursor: 'pointer', letterSpacing: '1px' }}>
                  {uploadProgress !== null ? `UPLOADING ${uploadProgress}%` : '☁ UPLOAD TO CLOUD'}
                </button>
              )}
              {filmUploaded && <span style={{ fontSize: '11px', color: s.green, fontWeight: '700' }}>✓ FILM SAVED TO CLOUD</span>}
              {currentGame?.film_url && !filmUploaded && <span style={{ fontSize: '10px', color: s.muted }}>Film stored in cloud</span>}
              {selectedFile && <span style={{ fontSize: '10px', color: s.muted }}>📎 {selectedFile.name}</span>}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Possession</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => logEvent('Offensive Possession', 'poss')} style={{ flex: 1, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.4)', borderRadius: '6px', color: '#4ade80', fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '8px 4px', cursor: 'pointer' }}>+ OFF</button>
              <button onClick={() => logEvent('Defensive Possession', 'poss')} style={{ flex: 1, background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.4)', borderRadius: '6px', color: '#60a5fa', fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '8px 4px', cursor: 'pointer' }}>+ DEF</button>
            </div>
          </div>
          <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Opp Score</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3].map(n => <button key={n} onClick={() => logEvent('Opponent +' + n, 'opp')} style={{ flex: 1, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '6px', color: '#f87171', fontFamily: 'Georgia,serif', fontSize: '12px', fontWeight: '900', padding: '8px 4px', cursor: 'pointer' }}>+{n}</button>)}
            </div>
          </div>
        </div>

        <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700' }}>Active Player</div>
            <button onClick={() => setAddingPlayerMid(!addingPlayerMid)} style={{ background: 'rgba(232,130,10,0.12)', border: `1px solid ${s.orange}`, borderRadius: '6px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '10px', fontWeight: '700', padding: '3px 8px', cursor: 'pointer' }}>+ Add Player</button>
          </div>
          {addingPlayerMid && (
            <div style={{ marginBottom: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', border: `1px solid ${s.border2}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: '6px', marginBottom: '6px' }}>
                <input placeholder='# Jersey' value={newPlayerNum} onChange={e => setNewPlayerNum(e.target.value)} style={{ ...inp, fontSize: '12px' }} />
                <input placeholder='Name' value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} style={{ ...inp, fontSize: '12px' }} />
                <select value={newPlayerPos} onChange={e => setNewPlayerPos(e.target.value)} style={{ ...inp, fontSize: '12px' }}>
                  {['Guard', 'Forward', 'Center'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <button onClick={() => addPlayer(true)} style={{ width: '100%', background: s.green, border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '900', padding: '8px', cursor: 'pointer', letterSpacing: '2px' }}>ADD TO ROSTER</button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {players.map(p => (
              <button key={p.id} onClick={() => setActivePlayer(p)} style={{ background: activePlayer?.id === p.id ? s.orange : 'rgba(255,255,255,0.04)', border: `1px solid ${activePlayer?.id === p.id ? s.orange : s.border2}`, borderRadius: '6px', color: activePlayer?.id === p.id ? s.maroon : s.text, fontFamily: 'Georgia,serif', fontSize: '13px', fontWeight: '900', padding: '6px 12px', cursor: 'pointer' }}>#{p.jersey_number}</button>
            ))}
          </div>
        </div>

        <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '10px' }}>On Court ({onCourt.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {players.map(p => (
              <button key={p.id} onClick={() => toggleOnCourt(p.id)} style={{ background: onCourt.includes(p.id) ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.04)', border: `1px solid ${onCourt.includes(p.id) ? '#3b82f6' : s.border2}`, borderRadius: '6px', color: onCourt.includes(p.id) ? '#93c5fd' : s.muted, fontFamily: 'Georgia,serif', fontSize: '12px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer' }}>#{p.jersey_number}</button>
            ))}
          </div>
        </div>

        {['scoring', 'playmaking', 'rebounding', 'defense', 'fouls'].map(cat => {
          const catStats = STATS.filter(st => st.category === cat)
          return (
            <div key={cat} style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '10px' }}>{cat}</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(catStats.length, 3)}, 1fr)`, gap: '6px' }}>
                {catStats.map(stat => (
                  <button key={stat.label} onClick={() => logEvent(stat.label, 'stat')}
                    style={{ background: s.maroon, border: `1px solid ${s.orange}`, borderRadius: '8px', color: s.orange2, fontFamily: 'Georgia,serif', fontSize: '12px', fontWeight: '900', padding: '12px 8px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>{stat.label}</button>
                ))}
              </div>
            </div>
          )
        })}

        <div style={{ background: s.panel, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px', marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '3px', color: s.orange, textTransform: 'uppercase', fontWeight: '700', marginBottom: '10px' }}>Recent Events ({events.length} total)</div>
          {recentEvents.length === 0 && <div style={{ fontSize: '11px', color: s.muted }}>No events yet — start tagging</div>}
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