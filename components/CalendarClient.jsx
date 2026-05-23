'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Calendar from './Calendar'
import AddFlyerModal from './AddFlyerModal'
import DayView from './DayView'

export default function CalendarClient({ initialEvents, user }) {
  const [events, setEvents] = useState(initialEvents)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingToDate, setAddingToDate] = useState(null)
  const [dayViewDate, setDayViewDate] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Load notification preference from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    setNotifEnabled(localStorage.getItem('notificationsEnabled') === 'true')
  }, [])

  const checkAndNotify = useCallback((eventsToCheck) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    const today = new Date()
    const pad = n => String(n).padStart(2, '0')
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const tomorrowKey = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}`
    // Only notify once per day
    if (localStorage.getItem(`notified_${todayKey}`)) return
    const todayEvents = eventsToCheck.filter(e => e.date === todayKey)
    const tomorrowEvents = eventsToCheck.filter(e => e.date === tomorrowKey)
    if (todayEvents.length > 0) {
      new Notification(`${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''} today! 📌`, {
        body: todayEvents.map(e => e.title || 'Event').join(' • '),
        icon: '/favicon.ico',
      })
      localStorage.setItem(`notified_${todayKey}`, '1')
    } else if (tomorrowEvents.length > 0) {
      new Notification(`${tomorrowEvents.length} event${tomorrowEvents.length > 1 ? 's' : ''} tomorrow 📌`, {
        body: tomorrowEvents.map(e => e.title || 'Event').join(' • '),
        icon: '/favicon.ico',
      })
      localStorage.setItem(`notified_${todayKey}`, '1')
    }
  }, [])

  // Fire notification check whenever notifications are enabled or events change
  useEffect(() => {
    if (notifEnabled) checkAndNotify(events)
  }, [notifEnabled, events, checkAndNotify])

  const toggleNotifications = async () => {
    if (notifEnabled) {
      setNotifEnabled(false)
      localStorage.setItem('notificationsEnabled', 'false')
      return
    }
    if (!('Notification' in window)) {
      alert('Your browser does not support notifications.')
      return
    }
    let perm = Notification.permission
    if (perm === 'default') perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setNotifEnabled(true)
      localStorage.setItem('notificationsEnabled', 'true')
      checkAndNotify(events)
    } else {
      alert('Notification permission was denied. Please enable it in your browser/phone settings.')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getDayEvents = (date) => {
    if (!date) return []
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
    return events.filter(e => e.date === key)
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
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <button
            onClick={toggleNotifications}
            title={notifEnabled ? 'Notifications on — tap to turn off' : 'Tap to enable event reminders'}
            className="text-xl transition-all active:scale-90"
            style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
          >
            {notifEnabled ? '🔔' : '🕕'}
          </button>
          <button
            onClick={handleSignOut}
            className="text-[11px] transition-colors hover:text-violet-500"
            style={{ color: '#a78bfa' }}
          >
            {user.email} &middot; sign out
          </button>
        </div>
      </header>

      {/* Calendar */}
      <main className="flex-1 px-3 md:px-6 py-5 pb-24 max-w-4xl mx-auto w-full">
        <Calendar
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          events={events}
          onDayClick={(date) => setDayViewDate(date)}
          onEventClick={(date) => setDayViewDate(date)}
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

      {dayViewDate && (
        <DayView
          date={dayViewDate}
          events={getDayEvents(dayViewDate)}
          onClose={() => setDayViewDate(null)}
          onAdd={() => {
            setAddingToDate(dayViewDate)
            setDayViewDate(null)
            setShowAddModal(true)
          }}
          onDelete={deleteEvent}
        />
      )}
    </div>
  )
}
