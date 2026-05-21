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

async function resizeImage(dataUrl, maxWidth = 1200) {
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
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = dataUrl
  })
}

export default function AddFlyerModal({ date, onAdd, onClose, uploadImage }) {
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const [eventDate, setEventDate] = useState(date ? toDateKey(date) : '')
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [aiDetectedDate, setAiDetectedDate] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const videoRef = useRef()
  const fileRef = useRef()

  // Stop camera on unmount
  useEffect(() => {
    return () => { cameraStream?.getTracks().forEach(t => t.stop()) }
  }, [cameraStream])

  // Wire stream to video element
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
      // Camera unavailable or denied — fall back to file picker
      fileRef.current.click()
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    stopCamera()
    fetch(dataUrl)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
        setImageFile(file)
        analyzeImage(dataUrl)
      })
  }

  const analyzeImage = async (dataUrl) => {
    setImagePreview(dataUrl)
    setAiError(false)
    setAnalyzing(true)
    try {
      const compressed = await resizeImage(dataUrl)
      const res = await fetch('/api/analyze-flyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: compressed, mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      if (data.title) setTitle(data.title)
      if (data.time_str) setTimeStr(data.time_str)
      if (data.location) setLocation(data.location)
      if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        setEventDate(data.date)
        setAiDetectedDate(true)
      }
      if (!data.title && !data.date && !data.time_str && !data.location) {
        setAiError(true)
      }
    } catch {
      setAiError(true)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => analyzeImage(e.target.result)
    reader.readAsDataURL(file)
  }

  const reset = () => {
    stopCamera()
    setImageFile(null)
    setImagePreview(null)
    setAiDetectedDate(false)
    setAiError(false)
    setTitle('')
    setLocation('')
    setTimeStr('')
    if (!date) setEventDate('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!eventDate) return
    setUploading(true)
    try {
      let imageUrl = null
      if (imageFile) imageUrl = await uploadImage(imageFile)
      await onAdd({ date: eventDate, title, location, time_str: timeStr, image_url: imageUrl })
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setUploading(false)
    }
  }

  const canSubmit = imageFile && eventDate && !analyzing

  // Full-screen camera view
  if (cameraActive) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-5 pt-14 pb-4">
          <button
            onClick={stopCamera}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <p className="text-xs text-white/30 tracking-wide uppercase">Point at flyer</p>
          <div className="w-12" />
        </div>

        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Viewfinder */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: 260, height: 260 }}>
              <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-white/70 rounded-br-lg" />
            </div>
          </div>
        </div>

        <div className="flex justify-center pb-16 pt-8">
          <button
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full border-4 border-white/70 flex items-center justify-center active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-full bg-white" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-2xl"
        style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.07)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-white/10 rounded-full" />
        </div>

        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="font-semibold text-[15px]">
            {!imagePreview
              ? 'Scan a flyer'
              : analyzing
              ? 'Reading flyer…'
              : aiDetectedDate
              ? `📌 Placing on ${formatNice(eventDate)}`
              : 'Fill in details'}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-white text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="p-5">
          {!imagePreview ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex flex-col items-center justify-center gap-2 h-28 rounded-2xl transition-all active:scale-[0.97]"
                  style={{
                    background: 'rgba(124,58,237,0.08)',
                    border: '1px solid rgba(124,58,237,0.25)',
                  }}
                >
                  <span className="text-3xl">📷</span>
                  <span className="text-xs font-medium text-violet-300">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current.click()}
                  className="flex flex-col items-center justify-center gap-2 h-28 rounded-2xl transition-all active:scale-[0.97]"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span className="text-3xl">🖼️</span>
                  <span className="text-xs font-medium text-zinc-400">Upload</span>
                </button>
              </div>
              <p className="text-center text-xs text-zinc-700">
                AI reads the flyer and places it on the right date
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div
                className="relative rounded-xl overflow-hidden"
                style={{ height: 208, background: '#000' }}
              >
                <img
                  src={imagePreview}
                  alt="flyer"
                  className="w-full h-full object-contain"
                />
                {analyzing ? (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                    style={{ background: 'rgba(0,0,0,0.65)' }}
                  >
                    <div className="w-7 h-7 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                    <p className="text-xs text-violet-300 font-medium">Reading flyer…</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={reset}
                    className="absolute top-2 right-2 text-xs text-white px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                  >
                    Retake
                  </button>
                )}
              </div>

              {aiError && !analyzing && (
                <p
                  className="text-xs text-amber-400/80 px-3 py-2.5 rounded-xl"
                  style={{
                    background: 'rgba(251,191,36,0.06)',
                    border: '1px solid rgba(251,191,36,0.12)',
                  }}
                >
                  Couldn’t read this flyer automatically — fill in the details below
                </p>
              )}

              {!analyzing && (
                <>
                  <div className="relative">
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                      className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors text-zinc-300"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${
                          aiDetectedDate
                            ? 'rgba(124,58,237,0.45)'
                            : 'rgba(255,255,255,0.07)'
                        }`,
                      }}
                    />
                    {aiDetectedDate && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-violet-400 font-bold tracking-widest uppercase">
                        AI
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Event title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm placeholder-zinc-700 focus:outline-none transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${
                        title ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)'
                      }`,
                    }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 text-sm placeholder-zinc-700 focus:outline-none transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${
                          location ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)'
                        }`,
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Time"
                      value={timeStr}
                      onChange={(e) => setTimeStr(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 text-sm placeholder-zinc-700 focus:outline-none transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${
                          timeStr ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)'
                        }`,
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!canSubmit || uploading}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    {uploading
                      ? 'Saving…'
                      : eventDate
                      ? `Pin to ${formatNice(eventDate)}`
                      : 'Pick a date above'}
                  </button>
                </>
              )}
            </form>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      </div>
    </div>
  )
}
