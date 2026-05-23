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

  const addEvent = async (eventData) => {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, user_id: user.id })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setEvents(prev => [...prev, data])
    if (eventData.date) {
      const [year, month] = eventData.date.split('-').map(Number)
      setCurrentDate(new Date(year, month - 1, 1))
    }
    setShowAddModal(false)
    setAddingToDate(null)
  }

  const deleteEvent = async (id) => {
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setViewingEvent(null)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0c0c0e' }}>
      <header className="flex items-center justify-between px-5 h-14 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black tracking-tight"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>ez</div>
          <span className="text-sm font-semibold text-white/60">calendar</span>
        </div>
        <button onClick={handleSignOut} className="text-[11px] text-white/20 hover:text-white/50 transition-colors">
          sign out
        </button>
      </header>

      <main className="flex-1 overflow-auto pb-28">
        <Calendar
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          events={events}
          onDayClick={(date) => { setAddingToDate(date); setShowAddModal(true) }}
          onEventClick={setViewingEvent}
        />
      </main>

      <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-8 pt-4" style={{ background: 'linear-gradient(to top, #0c0c0e 60%, transparent)' }}>
        <button
          onClick={() => { setAddingToDate(null); setShowAddModal(true) }}
          className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 24px rgba(124,58,237,0.45)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Scan flyer
        </button>
      </div>

      {showAddModal && (
        <AddFlyerModal
          date={addingToDate}
          onAdd={addEvent}
          onClose={() => { setShowAddModal(false); setAddingToDate(null) }}
          userId={user.id}
        />
      )}
      {viewingEvent && (
        <FlyerModal event={viewingEvent} onDelete={deleteEvent} onClose={() => setViewingEvent(null)} />
      )}
    </div>
  )
}
