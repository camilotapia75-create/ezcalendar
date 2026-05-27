'use client'
import { useState, useEffect, useRef } from 'react'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const PIN_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6']

const PIN_STYLES = [
  { id: 'classic',   emoji: '📌', label: 'Classic' },
  { id: 'star',      emoji: '⭐', label: 'Star' },
  { id: 'heart',     emoji: '❤️', label: 'Heart' },
  { id: 'flower',    emoji: '🌸', label: 'Flower' },
  { id: 'gem',       emoji: '💎', label: 'Gem' },
  { id: 'ribbon',    emoji: '🎀', label: 'Bow' },
  { id: 'butterfly', emoji: '🦋', label: 'Butterfly' },
  { id: 'moon',      emoji: '🌙', label: 'Moon' },
  { id: 'fire',      emoji: '🔥', label: 'Fire' },
  { id: 'rainbow',   emoji: '🌈', label: 'Rainbow' },
  { id: 'lightning', emoji: '⚡', label: 'Lightning' },
  { id: 'sparkle',   emoji: '✨', label: 'Sparkle' },
]
const EMOJI_PINS = Object.fromEntries(PIN_STYLES.slice(1).map(p => [p.id, p.emoji]))

function Pin({ styleId, colorIdx }) {
  const color = PIN_COLORS[colorIdx % PIN_COLORS.length]
  if (styleId === 'classic') {
    return (
      <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
        <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
          <circle cx="12" cy="10" r="10" fill={color} />
          <circle cx="8.5" cy="6.5" r="4" fill="rgba(255,255,255,0.30)" />
          <line x1="12" y1="19" x2="12" y2="31" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  return (
    <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none', fontSize: 26, lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.28))' }}>
      {EMOJI_PINS[styleId] || '📌'}
    </div>
  )
}

const PEN_COLORS = ['#1a1a2e', '#7c3aed', '#dc2626', '#2563eb', '#f59e0b', '#16a34a', '#db2777', '#ffffff']
const rots = [-4, 4, -3, 3, -2, 2, -3, 3, -2]

export default function DayView({ date, events, notes = [], onClose, onAdd, onDelete, onPinStyleChange, onSaveNote, onDeleteNote }) {
  const [notifEvents, setNotifEvents] = useState({})
  const [globalNotifOn, setGlobalNotifOn] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [pinStyle, setPinStyle] = useState('classic')
  const [showPinPicker, setShowPinPicker] = useState(false)

  const [showNoteManager, setShowNoteManager] = useState(false)
  const [hoveredNoteId, setHoveredNoteId] = useState(null)
  const [writeMode, setWriteMode] = useState(false)
  const [writeTool, setWriteTool] = useState('draw')
  const [penColor, setPenColor] = useState('#1a1a2e')
  const [penSize, setPenSize] = useState(3)
  const [erasing, setErasing] = useState(false)
  const [pendingText, setPendingText] = useState(null) // {x, y}
  const [pendingTextVal, setPendingTextVal] = useState('')

  const canvasRef = useRef()
  const boardRef = useRef()
  const textInputRef = useRef()
  const isDrawingRef = useRef(false)
  const lastPtRef = useRef(null)
  const hasChanges = useRef(false)
  // Keep stable refs for commitText closure
  const pendingTextRef = useRef(null)
  const pendingTextValRef = useRef('')
  const penColorRef = useRef('#1a1a2e')
  const penSizeRef = useRef(3)

  useEffect(() => { pendingTextRef.current = pendingText }, [pendingText])
  useEffect(() => { pendingTextValRef.current = pendingTextVal }, [pendingTextVal])
  useEffect(() => { penColorRef.current = penColor }, [penColor])
  useEffect(() => { penSizeRef.current = penSize }, [penSize])

  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  useEffect(() => {
    try {
      setNotifEvents(JSON.parse(localStorage.getItem('eventNotifs') || '{}'))
      setGlobalNotifOn(localStorage.getItem('notificationsEnabled') === 'true')
      const saved = localStorage.getItem('pinStyle')
      if (saved) setPinStyle(saved)
    } catch {}
  }, [])

  // Init canvas when entering write mode — use CSS pixels, no DPR scaling
  useEffect(() => {
    if (!writeMode || !canvasRef.current || !boardRef.current) return
    const canvas = canvasRef.current
    const board = boardRef.current
    const w = board.clientWidth
    const h = board.clientHeight
    canvas.width = w
    canvas.height = h
    hasChanges.current = false
  }, [writeMode])

  useEffect(() => {
    if (pendingText && textInputRef.current) textInputRef.current.focus()
  }, [pendingText])

  const selectPinStyle = (id) => {
    setPinStyle(id)
    setShowPinPicker(false)
    try { localStorage.setItem('pinStyle', id) } catch {}
    onPinStyleChange?.(id)
  }

  const toggleEventNotif = (id) => {
    setNotifEvents(prev => {
      const next = { ...prev }
      if (prev[id] === false) delete next[id]
      else next[id] = false
      localStorage.setItem('eventNotifs', JSON.stringify(next))
      return next
    })
  }
  const isEventOn = (id) => notifEvents[id] !== false

  // Coordinates relative to canvas element in CSS pixels (no DPR)
  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const src = e.touches?.[0] ?? e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const onCanvasDown = (e) => {
    if (writeTool === 'text') {
      // Commit any in-flight text first
      if (pendingTextValRef.current.trim()) flushText()
      const rect = canvasRef.current.getBoundingClientRect()
      const src = e.touches?.[0] ?? e
      setPendingText({ x: src.clientX - rect.left, y: src.clientY - rect.top })
      setPendingTextVal('')
      return
    }
    e.preventDefault()
    isDrawingRef.current = true
    lastPtRef.current = getPoint(e)
  }

  const onCanvasMove = (e) => {
    if (!isDrawingRef.current || writeTool === 'text') return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pt = getPoint(e)
    if (erasing) {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, penSizeRef.current * 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    } else {
      ctx.beginPath()
      ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y)
      ctx.lineTo(pt.x, pt.y)
      ctx.strokeStyle = penColorRef.current
      ctx.lineWidth = penSizeRef.current
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    lastPtRef.current = pt
    hasChanges.current = true
  }

  const onCanvasUp = () => {
    isDrawingRef.current = false
    lastPtRef.current = null
  }

  const flushText = () => {
    const text = pendingTextValRef.current.trim()
    const pt = pendingTextRef.current
    setPendingText(null)
    setPendingTextVal('')
    if (!text || !pt || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const fontSize = penSizeRef.current * 9
    ctx.font = `bold ${fontSize}px Caveat, cursive`
    ctx.fillStyle = penColorRef.current
    ctx.fillText(text, pt.x, pt.y + fontSize * 0.8)
    hasChanges.current = true
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    hasChanges.current = true
  }

  const exitWriteMode = async () => {
    if (pendingTextValRef.current.trim()) flushText()
    try {
      if (hasChanges.current && canvasRef.current) {
        const canvas = canvasRef.current
        if (canvas.width > 0 && canvas.height > 0) {
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
          const hasPixels = pixels.some((v, i) => i % 4 === 3 && v > 0)
          await onSaveNote?.(dateKey, {
            text_note: null,
            drawing_data: hasPixels ? canvas.toDataURL('image/png') : null,
          })
        }
      }
    } catch (err) {
      console.error('Failed to save note:', err)
    }
    setWriteMode(false)
    setPendingText(null)
  }

  const dayNum = date.getDate()
  const dayName = DAYS[date.getDay()]
  const monthName = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  const MAX = 9
  const shown = events.slice(0, MAX)
  const extra = events.length - MAX
  const currentPin = PIN_STYLES.find(p => p.id === pinStyle) || PIN_STYLES[0]

  if (selectedEvent) {
    return (
      <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }} onClick={() => setSelectedEvent(null)}>
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '5%', left: '5%', right: '5%', bottom: '5%', background: '#fffaee', border: '4px solid #1a1a1a', borderRadius: 8, boxShadow: '10px 10px 0 rgba(0,0,0,0.40)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', background: '#f5f0e8' }}>
            {selectedEvent.image_url
              ? <img src={selectedEvent.image_url} alt={selectedEvent.title || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}><p style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: '#5b21b6', padding: 24 }}>{selectedEvent.title}</p></div>
            }
            <button onClick={() => setSelectedEvent(null)} style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
          </div>
          <div style={{ flexShrink: 0, padding: '16px 20px 20px', borderTop: '2px solid #e9e0cc', background: '#fff' }}>
            {selectedEvent.title && <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>{selectedEvent.title}</p>}
            {selectedEvent.time_str && <p style={{ margin: '0 0 4px', fontSize: 14, color: '#6b7280' }}>🕐 {selectedEvent.time_str}</p>}
            {selectedEvent.location && <p style={{ margin: '0 0 4px', fontSize: 14, color: '#6b7280' }}>📍 {selectedEvent.location}</p>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              {selectedEvent.source_url
                ? <a href={selectedEvent.source_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 13, color: '#7c3aed', fontWeight: 700, textDecoration: 'none' }}>🔗 View original</a>
                : <span />}
              <button onClick={() => toggleEventNotif(selectedEvent.id)} style={{ padding: '7px 16px', borderRadius: 20, background: isEventOn(selectedEvent.id) ? 'rgba(234,179,8,0.90)' : 'rgba(200,200,200,0.65)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: isEventOn(selectedEvent.id) ? '#92400e' : '#6b7280' }}>
                {isEventOn(selectedEvent.id) ? '🔔 Reminder on' : '🔕 Reminder off'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }} onClick={writeMode ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '4%', left: '4%', right: '4%', bottom: '4%', background: '#fffaee', border: '5px solid #1a1a1a', borderRadius: 6, boxShadow: '10px 10px 0 rgba(0,0,0,0.40)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '14px 18px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '2px solid #e9e0cc', position: 'relative' }}>
          <div>
            <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: '#1a1a1a', letterSpacing: '-2px' }}>{dayNum}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#9ca3af', marginTop: 3 }}>{dayName} · {monthName} {year}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <button onClick={() => writeMode ? exitWriteMode() : setWriteMode(true)} title={writeMode ? 'Done writing' : 'Write on this day'}
              style={{ width: 32, height: 32, borderRadius: '50%', background: writeMode ? '#7c3aed' : notes.length > 0 ? '#fef9c3' : '#e5e5e5', border: writeMode ? '2px solid #5b21b6' : notes.length > 0 ? '2px solid #ca8a04' : '2px solid transparent', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', color: writeMode ? '#fff' : undefined }}>
              {writeMode ? '✓' : '✏️'}
            </button>
            {!writeMode && (
              <button onClick={e => { e.stopPropagation(); setShowPinPicker(p => !p) }} title="Change pin style"
                style={{ width: 32, height: 32, borderRadius: '50%', background: showPinPicker ? '#ede9fe' : '#e5e5e5', border: showPinPicker ? '2px solid #7c3aed' : '2px solid transparent', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {currentPin.emoji}
              </button>
            )}
            <button onClick={writeMode ? exitWriteMode : onClose}
              style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5e5e5', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
          </div>

          {showPinPicker && !writeMode && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 18, zIndex: 100, background: '#fff', borderRadius: 18, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '2px solid #e9e0cc', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, width: 208 }}>
              <div style={{ gridColumn: '1/-1', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 4 }}>Choose a pin</div>
              {PIN_STYLES.map(ps => (
                <button key={ps.id} onClick={() => selectPinStyle(ps.id)} title={ps.label}
                  style={{ width: 40, height: 40, borderRadius: 10, background: pinStyle === ps.id ? '#ede9fe' : 'rgba(0,0,0,0.03)', border: pinStyle === ps.id ? '2px solid #7c3aed' : '2px solid transparent', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {ps.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Board — canvas overlay lives here */}
        <div ref={boardRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: writeMode ? 'hidden' : 'auto', WebkitOverflowScrolling: 'touch' }} onClick={() => setShowPinPicker(false)}>

          {/* Stacked note overlays — appear as writing directly on the board */}
          {notes.map(n => n.drawing_data && (
            <div key={n.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 25, pointerEvents: 'none' }}>
              <img src={n.drawing_data} alt="" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
              {hoveredNoteId === n.id && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(253, 224, 71, 0.45)', mixBlendMode: 'multiply', transition: 'opacity 0.15s' }} />
              )}
            </div>
          ))}

          {/* Small "manage notes" button — only visible when notes exist and not in write mode */}
          {notes.length > 0 && !writeMode && (
            <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 35 }} onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowNoteManager(p => !p)}
                title="Manage notes"
                style={{ width: 28, height: 28, borderRadius: '50%', background: showNoteManager ? '#7c3aed' : 'rgba(0,0,0,0.32)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                ✏️
              </button>
              {showNoteManager && (
                <div style={{ position: 'absolute', bottom: 34, right: 0, background: '#fff', borderRadius: 12, padding: '10px 10px 8px', boxShadow: '0 6px 24px rgba(0,0,0,0.18)', border: '1.5px solid #e9e0cc', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Delete a note</div>
                  {notes.map((n) => (
                    <div key={n.id}
                      onMouseEnter={() => setHoveredNoteId(n.id)}
                      onMouseLeave={() => setHoveredNoteId(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 4px', borderRadius: 7, background: hoveredNoteId === n.id ? 'rgba(253,224,71,0.35)' : 'transparent', transition: 'background 0.15s' }}>
                      {n.drawing_data
                        ? <img src={n.drawing_data} alt="" style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 5, border: hoveredNoteId === n.id ? '2px solid #ca8a04' : '1px solid #e9e0cc', flexShrink: 0 }} />
                        : <div style={{ width: 56, height: 42, borderRadius: 5, border: hoveredNoteId === n.id ? '2px solid #ca8a04' : '1px solid #e9e0cc', background: '#fffaee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px', flexShrink: 0 }}>
                            <p style={{ fontSize: 10, fontFamily: 'var(--font-caveat), Caveat, cursive', fontWeight: 700, color: '#1a1a2e', margin: 0, textAlign: 'center', overflow: 'hidden' }}>{n.text_note?.slice(0, 24)}</p>
                          </div>
                      }
                      <button
                        onClick={() => { onDeleteNote(n.id, dateKey); setHoveredNoteId(null); if (notes.length === 1) setShowNoteManager(false) }}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,0.88)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Drawing canvas (write mode) */}
          {writeMode && (
            <canvas
              ref={canvasRef}
              style={{ position: 'absolute', top: 0, left: 0, zIndex: 30, touchAction: 'none', cursor: writeTool === 'text' ? 'text' : erasing ? 'cell' : 'crosshair' }}
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              onPointerLeave={onCanvasUp}
              onPointerCancel={onCanvasUp}
            />
          )}

          {/* Text input (write mode, text tool) */}
          {writeMode && pendingText && (
            <div style={{ position: 'absolute', left: pendingText.x, top: pendingText.y, zIndex: 40, display: 'flex', alignItems: 'flex-start', gap: 4 }} onClick={e => e.stopPropagation()}>
              <textarea
                ref={textInputRef}
                value={pendingTextVal}
                onChange={e => setPendingTextVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); flushText() }
                  if (e.key === 'Escape') { setPendingText(null); setPendingTextVal('') }
                }}
                rows={1}
                placeholder="Type…"
                style={{ background: 'transparent', border: 'none', outline: '1.5px dashed rgba(124,58,237,0.4)', resize: 'none', fontSize: penSize * 9, fontFamily: 'var(--font-caveat), Caveat, cursive', fontWeight: 700, color: penColor, minWidth: 100, lineHeight: 1.2, padding: '1px 4px', borderRadius: 3 }}
              />
              <button onPointerDown={e => { e.preventDefault(); flushText() }}
                style={{ width: 24, height: 24, borderRadius: '50%', background: '#7c3aed', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                ✓
              </button>
            </div>
          )}

          {/* Flyer cards */}
          {shown.length === 0 && !writeMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 32 }}>
              <span style={{ fontSize: 52 }}>📌</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#9ca3af', margin: 0 }}>Nothing pinned yet</p>
              <p style={{ fontSize: 13, color: '#d1d5db', margin: 0 }}>Tap Scan to add a flyer</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: shown.length === 1 ? 'minmax(0, min(75%, 380px))' : shown.length === 2 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: shown.length === 1 ? 0 : '28px 16px', justifyContent: 'center', maxWidth: shown.length === 1 ? '100%' : shown.length === 2 ? 560 : 860, margin: '0 auto', width: '100%', padding: '44px 20px 24px', boxSizing: 'border-box' }}>
              {shown.map((event, idx) => (
                <div key={event.id} onClick={() => !writeMode && setSelectedEvent(event)}
                  style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: '#fff', border: '3px solid #fff', boxShadow: '0 6px 24px rgba(0,0,0,0.22)', transform: shown.length === 1 ? `rotate(${rots[idx]}deg)` : 'none', transformOrigin: 'top center', cursor: writeMode ? 'default' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}>
                  <Pin styleId={pinStyle} colorIdx={idx} />
                  {event.image_url
                    ? <img src={event.image_url} alt={event.title || ''} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}><p style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', color: '#5b21b6', margin: 6, padding: '0 4px' }}>{event.title}</p></div>
                  }
                  <div style={{ flexShrink: 0, padding: '5px 7px 7px', background: '#fff', borderTop: '1px solid #f0ece0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {event.title && <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</p>}
                        {event.time_str && <p style={{ margin: 0, fontSize: 9, color: '#6b7280', lineHeight: 1.3 }}>🕐 {event.time_str}</p>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleEventNotif(event.id) }}
                        style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', marginTop: 1, background: isEventOn(event.id) ? 'rgba(234,179,8,0.90)' : 'rgba(200,200,200,0.65)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>
                        {isEventOn(event.id) ? '🔔' : '🔕'}
                      </button>
                    </div>
                  </div>
                  {!writeMode && (
                    <button onClick={e => { e.stopPropagation(); onDelete(event.id) }}
                      style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(239,68,68,0.88)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {extra > 0 && !writeMode && (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>+{extra} more</span>
            </div>
          )}
        </div>

        {/* Footer — always outside the canvas, always tappable */}
        {!writeMode ? (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 14px', borderTop: '2px solid #e9e0cc' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 12, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Close</button>
            <button onClick={onAdd} style={{ padding: '9px 22px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 14px rgba(124,58,237,0.38)' }}>+ Scan</button>
          </div>
        ) : (
          /* Write mode toolbar — in footer so it's NEVER covered by the canvas */
          <div style={{ flexShrink: 0, borderTop: '2px solid #e9e0cc', background: '#fff8e0', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Draw / Text */}
            <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1.5px solid #e9e0cc', flexShrink: 0 }}>
              <button onClick={() => { setWriteTool('draw'); setPendingText(null) }}
                style={{ padding: '4px 10px', fontSize: 12, border: 'none', cursor: 'pointer', background: writeTool === 'draw' ? '#7c3aed' : 'white', color: writeTool === 'draw' ? '#fff' : '#555', fontWeight: 700 }}>✏️ Draw</button>
              <button onClick={() => setWriteTool('text')}
                style={{ padding: '4px 10px', fontSize: 12, border: 'none', cursor: 'pointer', background: writeTool === 'text' ? '#7c3aed' : 'white', color: writeTool === 'text' ? '#fff' : '#555', fontWeight: 700 }}>Aa Text</button>
            </div>
            {/* Colors */}
            {PEN_COLORS.map(c => (
              <button key={c} onClick={() => { setPenColor(c); setErasing(false) }}
                style={{ width: penColor === c && !erasing ? 22 : 17, height: penColor === c && !erasing ? 22 : 17, borderRadius: '50%', background: c, border: penColor === c && !erasing ? '3px solid #1a1a1a' : '1.5px solid rgba(0,0,0,0.18)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.1s', boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #ccc' : undefined }} />
            ))}
            {/* Sizes */}
            {[2, 4, 8].map(s => (
              <button key={s} onClick={() => { setPenSize(s); setErasing(false) }}
                style={{ width: 24, height: 24, borderRadius: 6, border: penSize === s && !erasing ? '2px solid #7c3aed' : '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: s + 2, height: s + 2, borderRadius: '50%', background: erasing ? '#ccc' : penColor }} />
              </button>
            ))}
            <button onClick={() => setErasing(e => !e)}
              style={{ padding: '3px 8px', borderRadius: 20, border: erasing ? '2px solid #7c3aed' : '1.5px solid #e5e5e5', background: erasing ? '#ede9fe' : 'white', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: erasing ? '#7c3aed' : '#555', flexShrink: 0 }}>Erase</button>
            <button onClick={clearCanvas}
              style={{ padding: '3px 8px', borderRadius: 20, border: '1.5px solid #fca5a5', background: '#fff1f2', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>Clear</button>
            <button onClick={exitWriteMode}
              style={{ padding: '5px 16px', borderRadius: 20, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
