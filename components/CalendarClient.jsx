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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-xs font-black tracking-tighter">ez</div>
          <span className="font-semibold text-[15px] tracking-tight">calendar</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {user.email} &middot; sign out
        </button>
      </header>

      {/* Calendar */}
      <main className="flex-1 px-3 pb-24">
        <Calendar
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          events={events}
          onDayClick={(date) => { setAddingToDate(date); setShowAddModal(true) }}
          onEventClick={setViewingEvent}
        />
      </main>

      {/* FAB */}
      <button
        onClick={() => { setAddingToDate(null); setShowAddModal(true) }}
        className="fixed bottom-6 right-5 flex items-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm shadow-2xl transition-all active:scale-95 hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        Scan flyer
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
