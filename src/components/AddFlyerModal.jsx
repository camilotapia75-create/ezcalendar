import { useState, useRef } from 'react'

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function AddFlyerModal({ date, onAdd, onClose }) {
  const [imageData, setImageData] = useState(null)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [time, setTime] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const displayDate = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => setImageData(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onAdd({ date: formatDateKey(date), title, location, time, imageData })
  }

  const canSubmit = imageData || title.trim()

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
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={[
              'relative rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden',
              dragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 hover:border-white/25',
              imageData ? 'h-56' : 'h-32 flex items-center justify-center',
            ].join(' ')}
          >
            {imageData ? (
              <>
                <img src={imageData} alt="preview" className="w-full h-full object-contain bg-black/50" />
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-sm text-white font-medium">Change image</span>
                </div>
              </>
            ) : (
              <div className="text-center select-none">
                <div className="text-3xl mb-1">🖼️</div>
                <p className="text-sm text-gray-500">Drop flyer image here</p>
                <p className="text-xs text-gray-700 mt-0.5">or click to upload</p>
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

          <input
            type="text"
            placeholder="Event title (optional)"
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
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors mt-1"
          >
            Pin to {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </button>
        </form>
      </div>
    </div>
  )
}
