'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Calendar from './Calendar'
import AddFlyerModal from './AddFlyerModal'
import FlyerModal from './FlyerModal'

export default function CalendarClient({ initialEvents, user }) {
  const [events, setEvents] = useState(initialEvents)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingToDate, setAddingToDate] = useState(null)
  const [viewingEvent, setViewingEvent] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const uploadImage = async (file) => {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('flyer-images').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('flyer-images').getPublicUrl(path)
    return data.publicUrl
  }

  const addEvent = async (eventData) => {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, user_id: user.id })
      .select()
      .single()
    if (!error && data) {
      setEvents(prev => [...prev, data])
      if (eventData.date) {
        const [year, month] = eventData.date.split('-').map(Number)
        setCurrentDate(new Date(year, month - 1, 1))
      }
    }
    setShowAddModal(false)
    setAddingToDate(null)
  }

  const deleteEvent = async (id) => {
    const event = events.find(e => e.id === id)
    if (event?.image_url) {
      const parts = event.image_url.split('/flyer-images/')
      if (parts[1]) await supabase.storage.from('flyer-images').remove([parts[1]])
    }
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setViewingEvent(null)
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <h1 className="text-xl font-bold tracking-tight">ezcalendar</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden md:block">{user.email}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <Calendar
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          events={events}
          onDayClick={(date) => { setAddingToDate(date); setShowAddModal(true) }}
          onEventClick={setViewingEvent}
        />
      </main>

      {/* FAB — camera button always visible */}
      <button
        onClick={() => { setAddingToDate(null); setShowAddModal(true) }}
        className="fixed bottom-6 right-6 w-16 h-16 bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all hover:scale-105 z-40"
        title="Scan a flyer"
      >
        📷
      </button>

      {showAddModal && (
        <AddFlyerModal
          date={addingToDate}
          onAdd={addEvent}
          onClose={() => { setShowAddModal(false); setAddingToDate(null) }}
          uploadImage={uploadImage}
        />
      )}

      {viewingEvent && (
        <FlyerModal
          event={viewingEvent}
          onDelete={deleteEvent}
          onClose={() => setViewingEvent(null)}
        />
      )}
    </div>
  )
}
