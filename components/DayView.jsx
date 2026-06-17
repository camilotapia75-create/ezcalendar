'use client'
import { useState, useEffect, useRef } from 'react'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function Pin() {
  return (
    <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none', fontSize: 26, lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.28))' }}>
      📌
    </div>
  )
}

const PEN_COLORS = ['#1a1a2e', '#7c3aed', '#dc2626', '#2563eb', '#f59e0b', '#16a34a', '#db2777', '#ffffff']
const rots = [-4, 4, -3, 3, -2, 2, -3, 3, -2]

// Replay vector ops onto a 2D context. Coordinates are fractions (0–1) of w/h.
function replayOps(ctx, ops, w, h) {
  for (const op of (ops || [])) {
    if (op.type === 'text') {
      const fontSize = op.size * 9
      ctx.font = `bold ${fontSize}px Caveat, cursive`
      ctx.fillStyle = op.color
      ctx.fillText(op.text, op.x * w, op.y * h)
    } else {
      const pts = (op.points || []).map(p => ({ x: p.x * w, y: p.y * h }))
      if (!pts.length) continue
      if (op.isEraser) {
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        for (const pt of pts) {
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, op.size * 7, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      } else {
        ctx.beginPath()
        pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        ctx.strokeStyle = op.color
        ctx.lineWidth = op.size
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
    }
  }
}

// Full-board note overlay — rerenders on resize, crisp at any DPR
function NoteCanvas({ data, boardRef, highlighted }) {
  const elRef = useRef()

  useEffect(() => {
    if (!data) return
    // Legacy PNG (saved before vector format) — handled by the img fallback below
    if (data.startsWith('data:')) return

    let parsed
    try { parsed = JSON.parse(data) } catch { return }
    const ops = parsed.ops || []

    const draw = () => {
      const canvas = elRef.current
      const board = boardRef?.current
      if (!canvas || !board) return
      const w = board.clientWidth
      const h = board.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      replayOps(ctx, ops, w, h)
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [data, boardRef])

  const glow = highlighted
    ? 'drop-shadow(0 0 6px #fbbf24) drop-shadow(0 0 14px #f59e0b) brightness(1.15) saturate(1.4)'
    : 'none'

  if (data?.startsWith('data:')) {
    return <img src={data} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', zIndex: 25, filter: glow, transition: 'filter 0.2s' }} />
  }
  return (
    <canvas ref={elRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 25, filter: glow, transition: 'filter 0.2s' }} />
  )
}

// Small thumbnail used in the note manager popover
function NoteThumbnail({ data, highlighted }) {
  const elRef = useRef()
  const W = 56, H = 42

  useEffect(() => {
    if (!data || data.startsWith('data:')) return
    let parsed
    try { parsed = JSON.parse(data) } catch { return }
    const ops = parsed.ops || []
    const canvas = elRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Scale line widths down for the thumbnail
    replayOps(ctx, ops.map(op =>
      op.type === 'text' ? { ...op, size: Math.max(0.4, op.size * 0.32) }
                         : { ...op, size: Math.max(0.5, op.size * 0.38) }
    ), W, H)
  }, [data])

  const border = highlighted ? '2px solid #ca8a04' : '1px solid #e9e0cc'

  if (data?.startsWith('data:')) {
    return <img src={data} alt="" style={{ width: W, height: H, objectFit: 'cover', borderRadius: 5, border, flexShrink: 0 }} />
  }
  return (
    <canvas ref={elRef} style={{ width: W, height: H, borderRadius: 5, border, flexShrink: 0, background: '#fffaee' }} />
  )
}

export default function DayView({ date, events, notes = [], onClose, onAdd, onDelete, onSaveNote, onDeleteNote, accent = '#7c3aed', onEventTap }) {
  const [showNoteManager, setShowNoteManager] = useState(false)
  const [hoveredNoteId, setHoveredNoteId] = useState(null)
  const [writeMode, setWriteMode] = useState(false)
  const [writeTool, setWriteTool] = useState('draw')
  const [penColor, setPenColor] = useState('#1a1a2e')
  const [penSize, setPenSize] = useState(3)
  const [erasing, setErasing] = useState(false)
  const [pendingText, setPendingText] = useState(null)
  const [pendingTextVal, setPendingTextVal] = useState('')

  const canvasRef = useRef()
  const boardRef = useRef()
  const textInputRef = useRef()
  const isDrawingRef = useRef(false)
  const lastPtRef = useRef(null)
  const hasChanges = useRef(false)

  // Vector recording
  const opsRef = useRef([])
  const currentStrokeRef = useRef(null)

  // Stable refs so event handlers never capture stale state
  const pendingTextRef = useRef(null)
  const pendingTextValRef = useRef('')
  const penColorRef = useRef('#1a1a2e')
  const penSizeRef = useRef(3)
  const erasingRef = useRef(false)

  useEffect(() => { pendingTextRef.current = pendingText }, [pendingText])
  useEffect(() => { pendingTextValRef.current = pendingTextVal }, [pendingTextVal])
  useEffect(() => { penColorRef.current = penColor }, [penColor])
  useEffect(() => { penSizeRef.current = penSize }, [penSize])
  useEffect(() => { erasingRef.current = erasing }, [erasing])

  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  // Init drawing canvas with full DPR resolution
  useEffect(() => {
    if (!writeMode || !canvasRef.current || !boardRef.current) return
    const canvas = canvasRef.current
    const board = boardRef.current
    const w = board.clientWidth
    const h = board.clientHeight
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
    opsRef.current = []
    hasChanges.current = false
  }, [writeMode])

  useEffect(() => {
    if (pendingText && textInputRef.current) textInputRef.current.focus()
  }, [pendingText])

  // CSS pixel coords — ctx.setTransform(dpr…) handles the rest
  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const src = e.touches?.[0] ?? e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const onCanvasDown = (e) => {
    if (writeTool === 'text') {
      if (pendingTextValRef.current.trim()) flushText()
      const rect = canvasRef.current.getBoundingClientRect()
      const src = e.touches?.[0] ?? e
      setPendingText({ x: src.clientX - rect.left, y: src.clientY - rect.top })
      setPendingTextVal('')
      return
    }
    e.preventDefault()
    isDrawingRef.current = true
    const pt = getPoint(e)
    lastPtRef.current = pt
    const board = boardRef.current
    currentStrokeRef.current = {
      type: 'stroke',
      color: erasingRef.current ? null : penColorRef.current,
      size: penSizeRef.current,
      isEraser: erasingRef.current,
      points: [{ x: pt.x / board.clientWidth, y: pt.y / board.clientHeight }],
    }
  }

  const onCanvasMove = (e) => {
    if (!isDrawingRef.current || writeTool === 'text') return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pt = getPoint(e)
    const board = boardRef.current

    if (erasingRef.current) {
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
    currentStrokeRef.current?.points.push({ x: pt.x / board.clientWidth, y: pt.y / board.clientHeight })
    hasChanges.current = true
  }

  const onCanvasUp = () => {
    isDrawingRef.current = false
    if (currentStrokeRef.current) {
      opsRef.current.push(currentStrokeRef.current)
      currentStrokeRef.current = null
    }
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
    const drawY = pt.y + fontSize * 0.8
    ctx.fillText(text, pt.x, drawY)
    const board = boardRef.current
    opsRef.current.push({
      type: 'text',
      text,
      x: pt.x / board.clientWidth,
      y: drawY / board.clientHeight,
      size: penSizeRef.current,
      color: penColorRef.current,
    })
    hasChanges.current = true
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const board = boardRef.current
    canvas.getContext('2d').clearRect(0, 0, board.clientWidth, board.clientHeight)
    opsRef.current = []
    hasChanges.current = true
  }

  const exitWriteMode = async () => {
    if (pendingTextValRef.current.trim()) flushText()
    try {
      if (hasChanges.current && opsRef.current.length > 0) {
        await onSaveNote?.(dateKey, {
          drawing_data: JSON.stringify({ ops: opsRef.current }),
          text_note: null,
        })
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

  return (
    <div className="fixed inset-0 z-50 anim-backdrop" style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }} onClick={writeMode ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} className="anim-modal" style={{ position: 'absolute', top: '4%', left: '4%', right: '4%', bottom: '4%', background: '#fffaee', border: '5px solid #1a1a2e', borderRadius: 6, boxShadow: '10px 10px 0 rgba(0,0,0,0.40)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '14px 18px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '2px solid #e9e0cc', position: 'relative' }}>
          <div>
            <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: '#1a1a2e', letterSpacing: '-2px' }}>{dayNum}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#9ca3af', marginTop: 3 }}>{dayName} · {monthName} {year}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <button onClick={() => writeMode ? exitWriteMode() : setWriteMode(true)} title={writeMode ? 'Done writing' : 'Write on this day'}
              style={{ width: 32, height: 32, borderRadius: '50%', background: writeMode ? '#7c3aed' : notes.length > 0 ? '#fef9c3' : '#e5e5e5', border: writeMode ? '2px solid #5b21b6' : notes.length > 0 ? '2px solid #ca8a04' : '2px solid transparent', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', color: writeMode ? '#fff' : undefined }}>
              {writeMode ? '✓' : '✏️'}
            </button>
            <button onClick={writeMode ? exitWriteMode : onClose}
              style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5e5e5', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
          </div>

        </div>

        {/* Board */}
        <div ref={boardRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: writeMode ? 'hidden' : 'auto', WebkitOverflowScrolling: 'touch' }}>

          {/* Note overlays — vector, crisp at any DPR, scale to current board size */}
          {notes.map(n => n.drawing_data && (
            <NoteCanvas key={n.id} data={n.drawing_data} boardRef={boardRef} highlighted={hoveredNoteId === n.id} />
          ))}

          {/* Note manager button */}
          {notes.length > 0 && !writeMode && (
            <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 35 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowNoteManager(p => !p)} title="Manage notes"
                style={{ width: 28, height: 28, borderRadius: '50%', background: showNoteManager ? '#7c3aed' : 'rgba(0,0,0,0.32)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                ✏️
              </button>
              {showNoteManager && (
                <div style={{ position: 'absolute', bottom: 34, right: 0, background: '#fff', borderRadius: 12, padding: '10px 10px 8px', boxShadow: '0 6px 24px rgba(0,0,0,0.18)', border: '1.5px solid #e9e0cc', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Delete a note</div>
                  {notes.map(n => (
                    <div key={n.id}
                      onMouseEnter={() => setHoveredNoteId(n.id)}
                      onMouseLeave={() => setHoveredNoteId(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 4px', borderRadius: 7, background: hoveredNoteId === n.id ? 'rgba(253,224,71,0.35)' : 'transparent', transition: 'background 0.15s' }}>
                      <NoteThumbnail data={n.drawing_data} highlighted={hoveredNoteId === n.id} />
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
            <canvas ref={canvasRef}
              style={{ position: 'absolute', top: 0, left: 0, zIndex: 30, touchAction: 'none', cursor: writeTool === 'text' ? 'text' : erasing ? 'cell' : 'crosshair' }}
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              onPointerLeave={onCanvasUp}
              onPointerCancel={onCanvasUp}
            />
          )}

          {/* Floating text input (write mode, text tool) */}
          {writeMode && pendingText && (
            <div style={{ position: 'absolute', left: pendingText.x, top: pendingText.y, zIndex: 40, display: 'flex', alignItems: 'flex-start', gap: 4 }} onClick={e => e.stopPropagation()}>
              <textarea ref={textInputRef} value={pendingTextVal} onChange={e => setPendingTextVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); flushText() }
                  if (e.key === 'Escape') { setPendingText(null); setPendingTextVal('') }
                }}
                rows={1} placeholder="Type…"
                style={{ background: 'transparent', border: 'none', outline: '1.5px dashed rgba(124,58,237,0.4)', resize: 'none', fontSize: penSize * 9, fontFamily: 'var(--font-jakarta), \'Plus Jakarta Sans\', system-ui, sans-serif', fontWeight: 700, color: penColor, minWidth: 100, lineHeight: 1.2, padding: '1px 4px', borderRadius: 3 }}
              />
              <button onPointerDown={e => { e.preventDefault(); flushText() }}
                style={{ width: 24, height: 24, borderRadius: '50%', background: '#7c3aed', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>✓</button>
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
                <div key={event.id} onClick={() => !writeMode && onEventTap?.(event)}
                  style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: '#fff', border: '3px solid #fff', boxShadow: '0 6px 24px rgba(0,0,0,0.22)', transform: shown.length === 1 ? `rotate(${rots[idx]}deg)` : 'none', transformOrigin: 'top center', cursor: writeMode ? 'default' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', zIndex: writeMode ? 'auto' : 28 }}>
                  <Pin />
                  {event.image_url
                    ? <img src={event.image_url} alt={event.title || ''} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', aspectRatio: '3/4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: `linear-gradient(135deg, ${accent}14, ${accent}30)` }}><span style={{ fontSize: 26, lineHeight: 1 }}>📌</span><p style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: accent, margin: 0, padding: '0 6px' }}>{event.title}</p></div>
                  }
                  <div style={{ flexShrink: 0, padding: '5px 7px 7px', background: '#fff', borderTop: '1px solid #f0ece0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {event.title && <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</p>}
                      {event.time_str && <p style={{ margin: '0 0 1px', fontSize: 11, fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>🕐 {event.time_str}</p>}
                      {event.location && <p style={{ margin: 0, fontSize: 10, fontWeight: 500, color: '#6b7280', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {event.location}</p>}
                    </div>
                  </div>
                  {!writeMode && (
                    <button onClick={e => { e.stopPropagation(); onDelete(event.id) }} title="Remove event"
                      style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(26,26,46,0.55)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {extra > 0 && !writeMode && (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <span style={{ background: `${accent}1c`, color: accent, borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>+{extra} more</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {!writeMode ? (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 14px', borderTop: '2px solid #e9e0cc' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 12, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Close</button>
            <button onClick={onAdd} style={{ padding: '9px 22px', borderRadius: 12, background: '#1a1a2e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: `3px 3px 0 ${accent}` }}>+ Scan</button>
          </div>
        ) : (
          <div style={{ flexShrink: 0, borderTop: '2px solid #e9e0cc', background: '#fff8e0', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1.5px solid #e9e0cc', flexShrink: 0 }}>
              <button onClick={() => { setWriteTool('draw'); setPendingText(null) }}
                style={{ padding: '4px 10px', fontSize: 12, border: 'none', cursor: 'pointer', background: writeTool === 'draw' ? '#7c3aed' : 'white', color: writeTool === 'draw' ? '#fff' : '#555', fontWeight: 700 }}>✏️ Draw</button>
              <button onClick={() => setWriteTool('text')}
                style={{ padding: '4px 10px', fontSize: 12, border: 'none', cursor: 'pointer', background: writeTool === 'text' ? '#7c3aed' : 'white', color: writeTool === 'text' ? '#fff' : '#555', fontWeight: 700 }}>Aa Text</button>
            </div>
            {PEN_COLORS.map(c => (
              <button key={c} onClick={() => { setPenColor(c); setErasing(false) }}
                style={{ width: penColor === c && !erasing ? 22 : 17, height: penColor === c && !erasing ? 22 : 17, borderRadius: '50%', background: c, border: penColor === c && !erasing ? '3px solid #1a1a1a' : '1.5px solid rgba(0,0,0,0.18)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.1s', boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #ccc' : undefined }} />
            ))}
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
              style={{ padding: '5px 16px', borderRadius: 20, background: '#1a1a2e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: `2px 2px 0 ${accent}` }}>Done</button>
          </div>
        )}

      </div>
    </div>
  )
}
