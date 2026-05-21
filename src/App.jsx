import { useState, useEffect } from 'react'
import Calendar from './components/Calendar'
import AddFlyerModal from './components/AddFlyerModal'
import FlyerModal from './components/FlyerModal'

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [flyers, setFlyers] = useState(() => {
    try {
      const saved = localStorage.getItem('ezcalendar_flyers')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [addingToDate, setAddingToDate] = useState(null)
  const [viewingFlyer, setViewingFlyer] = useState(null)

  useEffect(() => {
    localStorage.setItem('ezcalendar_flyers', JSON.stringify(flyers))
  }, [flyers])

  const addFlyer = (flyer) => {
    setFlyers(prev => [...prev, { ...flyer, id: Date.now().toString() }])
    setAddingToDate(null)
  }

  const deleteFlyer = (id) => {
    setFlyers(prev => prev.filter(f => f.id !== id))
    setViewingFlyer(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <h1 className="text-xl font-bold tracking-tight">ezcalendar</h1>
        </div>
        <p className="text-sm text-gray-500">click any day to pin a flyer</p>
      </header>

      <main className="p-4 md:p-6">
        <Calendar
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          flyers={flyers}
          onDayClick={setAddingToDate}
          onFlyerClick={setViewingFlyer}
        />
      </main>

      {addingToDate && (
        <AddFlyerModal
          date={addingToDate}
          onAdd={addFlyer}
          onClose={() => setAddingToDate(null)}
        />
      )}

      {viewingFlyer && (
        <FlyerModal
          flyer={viewingFlyer}
          onDelete={deleteFlyer}
          onClose={() => setViewingFlyer(null)}
        />
      )}
    </div>
  )
}
