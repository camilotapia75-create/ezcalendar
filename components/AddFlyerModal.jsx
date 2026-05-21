'use client'
import { useState, useRef } from 'react'

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatNice(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
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
  const [dragging, setDragging] = useState(false)
  const [aiDetectedDate, setAiDetectedDate] = useState(false)
  const cameraRef = useRef()
  const fileRef = useRef()

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target.result
      setImagePreview(dataUrl)
      setAnalyzing(true)
      try {
        const res = await fetch('/api/analyze-flyer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: dataUrl, mediaType: file.type }),
        })
        const data = await res.json()
        if (data.title) setTitle(data.title)
        if (data.time_str) setTimeStr(data.time_str)
        if (data.location) setLocation(data.location)
        if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
          setEventDate(data.date)
          setAiDetectedDate(true)
        }
      } catch {
        // AI failed — user fills manually
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const reset = () => {
    setImageFile(null)
    setImagePreview(null)
    setAiDetectedDate(false)
    setTitle('')
    setLocation('')
    setTimeStr('')
    if (!date) setEventDate('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
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

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-t-3xl md:rounded-2xl w-full md:max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar on mobile */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h3 className="font-semibold">
            {imagePreview && !analyzing
              ? aiDetectedDate ? `🧠 AI placed on ${formatNice(eventDate)}` : 'Confirm details'
              : 'Scan a flyer'}
          </h3>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {!imagePreview ? (
            // Step 1: capture or upload
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Camera */}
                <button
                  type="button"
                  onClick={() => cameraRef.current.click()}
                  className="flex flex-col items-center justify-center gap-3 h-32 rounded-2xl border-2 border-white/10 hover:border-indigo-400 hover:bg-indigo-500/10 active:scale-95 transition-all"
                >
                  <span className="text-4xl">📷</span>
                  <span className="text-sm text-gray-400 font-medium">Camera</span>
                </button>

                {/* Upload / drop */}
                <div
                  onClick={() => fileRef.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-3 h-32 rounded-2xl border-2 cursor-pointer transition-all ${
                    dragging
                      ? 'border-indigo-400 bg-indigo-500/10'
                      : 'border-white/10 hover:border-indigo-400 hover:bg-indigo-500/10'
                  }`}
                >
                  <span className="text-4xl">🖼️</span>
                  <span className="text-sm text-gray-400 font-medium">Upload</span>
                </div>
              </div>
              <p className="text-center text-xs text-gray-600">AI reads the flyer and places it on the right date</p>
            </>
          ) : (
            // Step 2: preview + AI results
            <>
              <div className="relative rounded-xl overflow-hidden h-52">
                <img src={imagePreview} alt="flyer" className="w-full h-full object-contain bg-black/70" />
                {analyzing && (
                  <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-indigo-300 font-semibold">AI reading flyer…</p>
                    <p className="text-xs text-gray-400">Extracting date, time & location</p>
                  </div>
                )}
                {!analyzing && (
                  <button
                    type="button"
                    onClick={reset}
                    className="absolute top-2 right-2 bg-black/70 hover:bg-black text-xs text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Retake
                  </button>
                )}
              </div>

              {!analyzing && (
                <>
                  <div className="relative">
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-gray-300"
                    />
                    {aiDetectedDate && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 font-medium uppercase tracking-wide">AI</span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Event title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <input
                      type="text"
                      placeholder="Time"
                      value={timeStr}
                      onChange={(e) => setTimeStr(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!canSubmit || uploading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors"
                  >
                    {uploading
                      ? 'Saving…'
                      : eventDate
                      ? `Pin to ${formatNice(eventDate)}`
                      : 'Pin to calendar'
                    }
                  </button>
                </>
              )}
            </>
          )}

          {/* Hidden file inputs */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </form>
      </div>
    </div>
  )
}
