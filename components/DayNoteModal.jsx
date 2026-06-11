'use client'
import { useState, useRef, useEffect } from 'react'

const PEN_COLORS = ['#1a1a2e', '#7c3aed', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#db2777']
const PEN_SIZES = [2, 4, 8]

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function DayNoteModal({ dateStr, existingNote, onSave, onDelete, onClose }) {
  const [tab, setTab] = useState('write')
  const [text, setText] = useState(existingNote?.text_note || '')
  const [penColor, setPenColor] = useState('#1a1a2e')
  const [penSize, setPenSize] = useState(3)
  const [erasing, setErasing] = useState(false)
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef()
  const isDrawing = useRef(false)
  const lastPt = useRef(null)
  const drawingData = useRef(existingNote?.drawing_data || null)

  useEffect(() => {
    if (tab !== 'draw') return
    requestAnimationFrame(() => initCanvas())
  }, [tab])

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || canvas.offsetWidth === 0) {
      requestAnimationFrame(initCanvas)
      return
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fffef0'
    ctx.fillRect(0, 0, w, h)
    // Ruled lines
    ctx.strokeStyle = 'rgba(147,197,253,0.45)'
    ctx.lineWidth = 1
    for (let y = 32; y < h; y += 28) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    if (drawingData.current) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, w, h)
      img.src = drawingData.current
    }
  }

  const getPoint = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const src = e.touches?.[0] ?? e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    isDrawing.current = true
    lastPt.current = getPoint(e)
  }

  const doDraw = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pt = getPoint(e)

    if (erasing) {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(pt.x * dpr, pt.y * dpr, penSize * 5 * dpr, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    } else {
      ctx.beginPath()
      ctx.moveTo(lastPt.current.x * dpr, lastPt.current.y * dpr)
      ctx.lineTo(pt.x * dpr, pt.y * dpr)
      ctx.strokeStyle = penColor
      ctx.lineWidth = penSize * dpr
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    lastPt.current = pt
  }

  const endDraw = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    lastPt.current = null
    drawingData.current = canvasRef.current.toDataURL('image/jpeg', 0.8)
  }

  const clearCanvas = () => {
    drawingData.current = null
    initCanvas()
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(dateStr, {
      text_note: text.trim() || null,
      drawing_data: drawingData.current || null,
    })
    setSaving(false)
  }

  const hasContent = text.trim().length > 0 || drawingData.current

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 anim-backdrop"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="anim-modal"
        style={{
          width: '100%', maxWidth: 440,
          background: '#fffef0',
          border: '3px solid #1a1a1a',
          borderRadius: 14,
          boxShadow: '6px 6px 0 rgba(0,0,0,0.28)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '88vh', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '2px solid #e9e0cc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a' }}>📝 Day note</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{formatDate(dateStr)}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e5e5', border: 'none', cursor: 'pointer', fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e9e0cc', background: '#fff8e0', flexShrink: 0 }}>
          {[{ id: 'write', label: '⌨️ Type' }, { id: 'draw', label: '✏️ Draw' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: tab === t.id ? '#fffef0' : 'transparent',
              color: tab === t.id ? '#1a1a1a' : '#9ca3af',
              borderBottom: tab === t.id ? '3px solid #7c3aed' : '3px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Write tab */}
        {tab === 'write' && (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write something here…"
            autoFocus
            style={{
              flex: 1, minHeight: 240,
              padding: '14px 20px',
              fontSize: 24,
              fontFamily: 'var(--font-caveat), Caveat, cursive',
              lineHeight: '1.95',
              background: `repeating-linear-gradient(
                transparent, transparent calc(1.95em - 1px),
                rgba(147,197,253,0.4) calc(1.95em - 1px),
                rgba(147,197,253,0.4) 1.95em
              )`,
              border: 'none', outline: 'none', resize: 'none',
              color: '#1a1a2e',
            }}
          />
        )}

        {/* Draw tab */}
        {tab === 'draw' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1.5px solid #e9e0cc', background: '#fff8e0', flexWrap: 'wrap', flexShrink: 0 }}>
              {PEN_COLORS.map(c => (
                <button key={c} onClick={() => { setPenColor(c); setErasing(false) }}
                  style={{
                    width: penColor === c && !erasing ? 22 : 18,
                    height: penColor === c && !erasing ? 22 : 18,
                    borderRadius: '50%', background: c,
                    border: penColor === c && !erasing ? '3px solid #1a1a1a' : '2px solid rgba(0,0,0,0.12)',
                    cursor: 'pointer', flexShrink: 0, transition: 'all 0.1s',
                  }} />
              ))}
              <div style={{ width: 1, height: 18, background: '#e9e0cc' }} />
              {PEN_SIZES.map(s => (
                <button key={s} onClick={() => { setPenSize(s); setErasing(false) }}
                  style={{
                    width: 26, height: 26, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                    border: penSize === s && !erasing ? '2px solid #7c3aed' : '1.5px solid #e5e5e5',
                    background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <div style={{ width: s + 2, height: s + 2, borderRadius: '50%', background: erasing ? '#ccc' : penColor }} />
                </button>
              ))}
              <div style={{ width: 1, height: 18, background: '#e9e0cc' }} />
              <button onClick={() => setErasing(e => !e)}
                style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: erasing ? '2px solid #7c3aed' : '1.5px solid #e5e5e5', background: erasing ? '#ede9fe' : 'white' }}>
                Erase
              </button>
              <button onClick={clearCanvas}
                style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #fca5a5', background: '#fff1f2', color: '#ef4444' }}>
                Clear
              </button>
            </div>
            {/* Canvas */}
            <canvas
              ref={canvasRef}
              style={{ flex: 1, width: '100%', minHeight: 240, touchAction: 'none', cursor: erasing ? 'cell' : 'crosshair', display: 'block' }}
              onPointerDown={startDraw}
              onPointerMove={doDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '10px 14px', borderTop: '2px solid #e9e0cc', display: 'flex', gap: 8, background: '#fff8e0', flexShrink: 0 }}>
          {existingNote && (
            <button onClick={() => onDelete(dateStr)}
              style={{ padding: '9px 14px', borderRadius: 10, background: '#fff1f2', border: '1.5px solid #fca5a5', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Delete
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !hasContent}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', border: 'none', cursor: saving || !hasContent ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: saving || !hasContent ? 0.45 : 1 }}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  )
}
