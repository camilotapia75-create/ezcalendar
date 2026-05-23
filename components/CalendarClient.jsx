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
  const [viewingEvents, setViewingEvents] = useState(null)
  const [viewingIndex, setViewingIndex] = useState(0)
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
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    const remaining = (viewingEvents || []).filter(e => e.id !== id)
    if (remaining.length > 0) {
      setViewingEvents(remaining)
      setViewingIndex(i => Math.min(i, remaining.length - 1))
    } else {
      setViewingEvents(null)
      setViewingIndex(0)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: '#f5eef8',
        backgroundImage: [
          "url('/watercolor-bg.jpg.png')",
          "radial-gradient(ellipse 75% 65% at 3% 4%, rgba(170,145,215,0.60) 0%, transparent 58%)",
          "radial-gradient(ellipse 55% 55% at 52% 18%, rgba(255,195,215,0.50) 0%, transparent 55%)",
          "radial-gradient(ellipse 45% 55% at 97% 12%, rgba(255,225,175,0.55) 0%, transparent 50%)",
          "radial-gradient(ellipse 50% 50% at 93% 88%, rgba(195,228,175,0.58) 0%, transparent 52%)",
          "radial-gradient(ellipse 65% 52% at 18% 80%, rgba(255,185,205,0.50) 0%, transparent 55%)",
          "radial-gradient(ellipse 40% 40% at 75% 60%, rgba(255,210,170,0.40) 0%, transparent 50%)",
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-4"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.5)',
          boxShadow: '0 1px 12px rgba(124,58,237,0.08)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black tracking-tighter text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            ez
          </div>
          <span className="font-semibold text-[15px] tracking-tight" style={{ color: '#1a1a2e' }}>calendar</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[11px] transition-colors hover:text-violet-500"
          style={{ color: '#a78bfa' }}
        >
          {user.email} &middot; sign out
        </button>
      </header>

      {/* Calendar */}
      <main className="flex-1 px-3 md:px-6 py-5 pb-24 max-w-4xl mx-auto w-full">
        <Calendar
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          events={events}
          onDayClick={(date) => { setAddingToDate(date); setShowAddModal(true) }}
          onEventClick={(eventsArr) => { setViewingEvents(eventsArr); setViewingIndex(0) }}
        />
      </main>

      {/* FAB */}
      <button
        onClick={() => { setAddingToDate(null); setShowAddModal(true) }}
        className="fixed bottom-6 right-5 flex items-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm text-white transition-all active:scale-95 hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 24px rgba(124,58,237,0.45)' }}
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
          userId={user.id}
        />
      )}

      {viewingEvents && (
        <FlyerModal
          events={viewingEvents}
          activeIndex={viewingIndex}
          onNavigate={setViewingIndex}
          onDelete={deleteEvent}
          onClose={() => { setViewingEvents(null); setViewingIndex(0) }}
        />
      )}
    </div>
  )
}
