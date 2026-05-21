'use client'
import { useState, useRef } from 'react'

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function AddFlyerModal({ date, onAdd, onClose, uploadImage }) {
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const [eventDate, setEventDate] = useState(toDateKey(date))
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const displayDate = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

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
        if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) setEventDate(data.date)
      } catch {
        // AI failed silently — user can fill in manually
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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

  const canSubmit = (imageFile || title.trim()) && !analyzing

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="font-semibold text-base">Pin a flyer</h3>
            <p className="text-xs text-gray-500 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors text-lg leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Drop zone */}
          <div
            onClick={() => !imagePreview && fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={[
              'relative rounded-xl border-2 border-dashed transition-all overflow-hidden',
              dragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10',
              imagePreview ? 'h-60' : 'h-32 flex items-center justify-center cursor-pointer hover:border-white/25',
            ].join(' ')}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="preview" className="w-full h-full object-contain bg-black/60" />
                {analyzing ? (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-indigo-300 font-medium">AI reading flyer…</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileRef.current.click() }}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-xs text-white px-2 py-1 rounded-lg transition-colors"
                  >
                    Change
                  </button>
                )}
              </>
            ) : (
              <div className="text-center select-none pointer-events-none">
                <div className="text-3xl mb-1">🖼️</div>
                <p className="text-sm text-gray-500">Drop your flyer here</p>
                <p className="text-xs text-gray-700 mt-0.5">AI will auto-fill the details</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {/* Fields — light up after AI fills them */}
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-gray-300"
          />
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
              placeholder="Time (e.g. 4–8 PM)"
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
            {uploading ? 'Saving…' : 'Pin to calendar'}
          </button>
        </form>
      </div>
    </div>
  )
}
