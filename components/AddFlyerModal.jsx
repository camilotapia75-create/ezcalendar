'use client'
import { useState, useRef, useEffect } from 'react'

function toDateKey(date) {
  if (!date) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatNice(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric',
  })
}

async function resizeImage(dataUrl, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

const IconCamera = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const IconUpload = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const IconLink = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)

export default function AddFlyerModal({ date, onAdd, onClose, userId }) {
  const [imagePreview, setImagePreview] = useState(null)
  const [imageForStorage, setImageForStorage] = useState(null)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const [eventDate, setEventDate] = useState(date ? toDateKey(date) : '')
  const [endDate, setEndDate] = useState('')
  const [showEndDate, setShowEndDate] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [aiDetectedDate, setAiDetectedDate] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiDetail, setAiDetail] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkScanning, setLinkScanning] = useState(false)
  const [linkError, setLinkError] = useState(null)
  const [linkWarning, setLinkWarning] = useState(null)
  const [ogImageUrl, setOgImageUrl] = useState(null)
  const [linkScanned, setLinkScanned] = useState(false)
  const [manualMode, setManualMode] = useState(false)

  const videoRef = useRef()
  const fileRef = useRef()

  useEffect(() => {
    return () => { cameraStream?.getTracks().forEach(t => t.stop()) }
  }, [cameraStream])

  useEffect(() => {
    if (cameraActive && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
    }
  }, [cameraActive, cameraStream])

  const stopCamera = () => {
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
    setCameraActive(false)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      setCameraStream(stream)
      setCameraActive(true)
    } catch {
      fileRef.current.click()
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    analyzeImage(canvas.toDataURL('image/jpeg', 0.92))
    stopCamera()
  }

  const analyzeImage = async (dataUrl) => {
    setImagePreview(dataUrl)
    setAiError(null); setAiDetail(null); setSaveError(null)
    setAnalyzing(true)
    try {
      const [forAI, forStorage] = await Promise.all([
        resizeImage(dataUrl, 800, 0.7),
        resizeImage(dataUrl, 1200, 0.85),
      ])
      setImageForStorage(forStorage)
      const res = await fetch('/api/analyze-flyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: forAI, mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (res.status === 429) { setAiError('quota'); setAiDetail(data.detail); return }
      if (!res.ok) { setAiError('failed'); setAiDetail(data.detail); return }
      if (data.title) setTitle(data.title)
      if (data.time_str) setTimeStr(data.time_str)
      if (data.location) setLocation(data.location)
      if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        setEventDate(data.date)
        setAiDetectedDate(true)
      }
      if (data.end_date && /^\d{4}-\d{2}-\d{2}$/.test(data.end_date)) {
        setEndDate(data.end_date)
        setShowEndDate(true)
      }
      if (!data.title && !data.date && !data.time_str && !data.location) setAiError('failed')
    } catch (err) {
      setAiError('failed'); setAiDetail(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => analyzeImage(e.target.result)
    reader.readAsDataURL(file)
  }

  const scanLink = async () => {
    if (!linkUrl.trim()) return
    setLinkScanning(true)
    setLinkError(null)
    setLinkWarning(null)
    try {
      const res = await fetch('/api/scan-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to read link')
      if (data.title) setTitle(data.title)
      if (data.time_str) setTimeStr(data.time_str)
      if (data.location) setLocation(data.location)
      if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        setEventDate(data.date)
        setAiDetectedDate(true)
      }
      if (data.end_date && /^\d{4}-\d{2}-\d{2}$/.test(data.end_date)) {
        setEndDate(data.end_date)
        setShowEndDate(true)
      }
      setOgImageUrl(data.og_image || null)

      // Fallback: link gave us an image but missed details — run the image
      // through the flyer pipeline (same resize + endpoint as photo uploads)
      const missingDetails = !data.date || !data.time_str || !data.location || !data.title
      if (missingDetails && data.og_image?.startsWith('data:')) {
        try {
          const small = await resizeImage(data.og_image, 800, 0.7)
          const fres = await fetch('/api/analyze-flyer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: small, mediaType: 'image/jpeg' }),
          })
          if (fres.ok) {
            const fd = await fres.json()
            if (!data.title && fd.title) setTitle(fd.title)
            if (!data.time_str && fd.time_str) setTimeStr(fd.time_str)
            if (!data.location && fd.location) setLocation(fd.location)
            if (!data.date && fd.date && /^\d{4}-\d{2}-\d{2}$/.test(fd.date)) {
              setEventDate(fd.date)
              setAiDetectedDate(true)
            }
            if (!data.end_date && fd.end_date && /^\d{4}-\d{2}-\d{2}$/.test(fd.end_date)) {
              setEndDate(fd.end_date)
              setShowEndDate(true)
            }
            // Flyer read succeeded — the link warning no longer applies
            if (fd.title || fd.date) data.warning = null
          }
        } catch {}
      }

      if (data.warning) setLinkWarning(data.warning)
      setLinkScanned(true)
    } catch (err) {
      setLinkError(err.message)
    } finally {
      setLinkScanning(false)
    }
  }

  const reset = () => {
    stopCamera()
    setImagePreview(null); setImageForStorage(null)
    setAiDetectedDate(false); setAiError(null); setAiDetail(null); setSaveError(null)
    setTitle(''); setLocation(''); setTimeStr(''); setEndDate(''); setShowEndDate(false)
    setLinkMode(false); setLinkUrl(''); setLinkScanning(false)
    setLinkError(null); setLinkWarning(null); setOgImageUrl(null); setLinkScanned(false)
    setManualMode(false)
    if (!date) setEventDate('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!eventDate) return
    if (!linkMode && !manualMode && !imageForStorage) return
    setSaveError(null)
    setUploading(true)
    try {
      let image_url = null
      if (manualMode) {
        // no image
      } else if (linkMode) {
        if (ogImageUrl?.startsWith('data:')) {
          try {
            const uploadRes = await fetch('/api/upload-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageData: ogImageUrl, userId }),
            })
            const uploadData = await uploadRes.json()
            if (uploadRes.ok) image_url = uploadData.url
          } catch {}
        } else {
          image_url = ogImageUrl || null
        }
      } else {
        const uploadRes = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: imageForStorage, userId }),
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed')
        image_url = uploadData.url
      }
      await onAdd({
        date: eventDate,
        end_date: endDate || null,
        title,
        location,
        time_str: timeStr,
        image_url,
        source_url: linkMode ? linkUrl.trim() : null,
      })
    } catch (err) {
      setSaveError(err.message || 'Failed to save — try again')
    } finally {
      setUploading(false)
    }
  }

  const showForm = imagePreview || linkScanned || manualMode
  const canSubmit = eventDate && (linkMode || manualMode ? true : !!imageForStorage)

  if (cameraActive) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-5 pt-14 pb-4">
          <button onClick={stopCamera} className="text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
          <span className="text-xs font-medium text-white/25 tracking-widest uppercase">Scan flyer</span>
          <div className="w-12" />
        </div>
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: 256, height: 320 }}>
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-xl" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 pb-16 pt-8">
          <button onClick={capturePhoto}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 32px rgba(124,58,237,0.5)' }}
          >
            <div className="w-12 h-12 rounded-full border-2 border-white/30" />
          </button>
          <span className="text-xs text-white/30">Tap to capture</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full md:max-w-md rounded-t-[28px] md:rounded-[20px] overflow-hidden"
        style={{ background: '#131316', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 md:hidden">
          <div className="w-9 h-[3px] bg-white/10 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[15px] font-semibold text-white">
            {!showForm
              ? (linkMode ? 'Paste a link' : 'Add a flyer')
              : manualMode ? 'New event'
              : analyzing || linkScanning ? 'Reading…'
              : aiDetectedDate ? `Placing on ${formatNice(eventDate)}`
              : 'Fill in details'}
          </span>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-colors" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-4">
          {!showForm && !linkMode && (
            <div className="space-y-2">
              <button type="button" onClick={startCamera}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-violet-400 flex-shrink-0" style={{ background: 'rgba(124,58,237,0.15)' }}>
                  <IconCamera />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Use camera</p>
                  <p className="text-xs text-white/30 mt-0.5">Point at the flyer</p>
                </div>
              </button>
              <button type="button" onClick={() => fileRef.current.click()}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <IconUpload />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">Upload image</p>
                  <p className="text-xs text-white/25 mt-0.5">From your photos</p>
                </div>
              </button>
              <button type="button" onClick={() => setLinkMode(true)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <IconLink />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">Paste a link</p>
                  <p className="text-xs text-white/25 mt-0.5">Instagram, Facebook, or any event page</p>
                </div>
              </button>
              <button type="button" onClick={() => setManualMode(true)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 flex-shrink-0 text-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  ✏️
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">Type it in</p>
                  <p className="text-xs text-white/25 mt-0.5">Enter event details manually, no image needed</p>
                </div>
              </button>
              <p className="text-center text-[11px] text-white/15 pt-1">AI reads the date, time &amp; location automatically</p>
            </div>
          )}

          {linkMode && !linkScanned && (
            <div className="space-y-3">
              <input
                type="url"
                placeholder="https://..."
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && scanLink()}
                autoFocus
                className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              {linkError && (
                <p className="text-xs px-1" style={{ color: 'rgba(248,113,113,0.9)' }}>{linkError}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={reset}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white/40"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  Back
                </button>
                <button type="button" onClick={scanLink} disabled={!linkUrl.trim() || linkScanning}
                  className="flex-[2] py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  {linkScanning ? 'Reading…' : 'Scan link'}
                </button>
              </div>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {!manualMode && <div className="relative rounded-2xl overflow-hidden bg-black" style={{ height: 180 }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="flyer" className="w-full h-full object-contain" />
                ) : ogImageUrl ? (
                  <img src={ogImageUrl} alt="flyer" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <IconLink />
                    <span className="text-xs">No preview image</span>
                  </div>
                )}
                {(analyzing || linkScanning) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                    <p className="text-xs text-violet-300 font-medium tracking-wide">Reading…</p>
                  </div>
                )}
                {!analyzing && !linkScanning && (
                  <button type="button" onClick={reset}
                    className="absolute top-3 right-3 text-xs text-white/70 px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                  >Retake</button>
                )}
              </div>}

              {!manualMode && linkWarning && !analyzing && (
                <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}>
                  {linkWarning}
                </div>
              )}
              {!manualMode && aiError && !analyzing && (
                <div className="px-3 py-2.5 rounded-xl text-xs" style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: aiError === 'quota' ? 'rgba(248,113,113,0.9)' : 'rgba(255,255,255,0.35)',
                }}>
                  {aiError === 'quota' ? 'Rate limit — wait a moment and retake' : "Couldn't read automatically — fill in below"}
                  {aiDetail && <div className="mt-1 text-[10px] opacity-50 break-all">{aiDetail}</div>}
                </div>
              )}
              {saveError && (
                <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgba(248,113,113,0.9)' }}>
                  {saveError}
                </div>
              )}

              {(manualMode || (!analyzing && !linkScanning)) && (
                <>
                  <div className="space-y-2">
                    <div className="relative">
                      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required
                        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all text-white/80"
                        style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${aiDetectedDate ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}` }}
                      />
                      {aiDetectedDate && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-violet-400 font-semibold tracking-widest">AI</span>}
                    </div>
                    {showEndDate ? (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1">
                          <p className="text-[10px] text-white/25">End date</p>
                          <button type="button" onClick={() => { setShowEndDate(false); setEndDate('') }}
                            className="text-[10px] text-white/25 hover:text-white/50 transition-colors">remove</button>
                        </div>
                        <div className="relative">
                          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={eventDate || undefined}
                            className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all text-white/80"
                            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${endDate ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}` }}
                          />
                          {endDate && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-violet-400 font-semibold tracking-widest">{endDate === eventDate ? 'SAME' : 'END'}</span>}
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowEndDate(true)}
                        className="text-[10px] text-white/25 hover:text-white/40 transition-colors px-1 text-left">
                        + multi-day event?
                      </button>
                    )}
                    <input type="text" placeholder="Event title" value={title} onChange={e => setTitle(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none transition-all text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${title ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}` }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Location" value={location} onChange={e => setLocation(e.target.value)}
                        className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none transition-all text-white"
                        style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${location ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}` }}
                      />
                      <input type="text" placeholder="Time" value={timeStr} onChange={e => setTimeStr(e.target.value)}
                        className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none transition-all text-white"
                        style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${timeStr ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}` }}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={!canSubmit || uploading}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.98] text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    {uploading ? 'Saving…' : eventDate
                      ? (endDate && endDate !== eventDate
                          ? `Pin ${formatNice(eventDate)} – ${formatNice(endDate)}`
                          : `Pin to ${formatNice(eventDate)}`)
                      : 'Pick a date above'}
                  </button>
                </>
              )}
            </form>
          )}

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </div>
      </div>
    </div>
  )
}
