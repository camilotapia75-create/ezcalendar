'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Calendar from './Calendar'
import AddFlyerModal from './AddFlyerModal'
import DayView from './DayView'
import ShareModal from './ShareModal'

const THEMES = {
  dreamy: {
    bg: '#f0d8ff',
    sw: 'linear-gradient(135deg,#c084fc,#f472b6)',
    c: ['rgba(192,132,252,0.72)','rgba(244,114,182,0.62)','rgba(251,207,232,0.68)','rgba(216,180,254,0.72)','rgba(249,168,212,0.62)','rgba(233,213,255,0.68)'],
    cellBg: 'rgba(242,228,255,0.93)',
    weekendBg: 'rgba(255,218,245,0.87)',
    inactiveBg: 'rgba(185,155,215,0.28)',
    accent: '#7c3aed',
  },
  ocean: {
    bg: '#b8e0f8',
    sw: 'linear-gradient(135deg,#0ea5e9,#10b981)',
    c: ['rgba(14,165,233,0.72)','rgba(16,185,129,0.65)','rgba(99,102,241,0.58)','rgba(103,232,249,0.72)','rgba(52,211,153,0.65)','rgba(147,197,253,0.65)'],
    cellBg: 'rgba(218,242,255,0.93)',
    weekendBg: 'rgba(200,245,235,0.87)',
    inactiveBg: 'rgba(140,195,225,0.28)',
    accent: '#0284c7',
  },
  forest: {
    bg: '#b8f0cc',
    sw: 'linear-gradient(135deg,#22c55e,#eab308)',
    c: ['rgba(34,197,94,0.72)','rgba(234,179,8,0.62)','rgba(74,222,128,0.68)','rgba(163,230,53,0.72)','rgba(187,247,208,0.65)','rgba(254,240,138,0.65)'],
    cellBg: 'rgba(218,250,225,0.93)',
    weekendBg: 'rgba(242,255,205,0.87)',
    inactiveBg: 'rgba(140,200,155,0.28)',
    accent: '#16a34a',
  },
  sunset: {
    bg: '#fdd0a0',
    sw: 'linear-gradient(135deg,#f97316,#ef4444)',
    c: ['rgba(249,115,22,0.75)','rgba(239,68,68,0.65)','rgba(251,146,60,0.72)','rgba(252,165,165,0.68)','rgba(254,215,170,0.72)','rgba(253,186,116,0.68)'],
    cellBg: 'rgba(255,238,218,0.93)',
    weekendBg: 'rgba(255,218,215,0.87)',
    inactiveBg: 'rgba(215,165,130,0.28)',
    accent: '#ea580c',
  },
  midnight: {
    bg: '#c8c0f8',
    sw: 'linear-gradient(135deg,#6366f1,#3b82f6)',
    c: ['rgba(99,102,241,0.75)','rgba(139,92,246,0.68)','rgba(59,130,246,0.62)','rgba(167,139,250,0.75)','rgba(196,181,253,0.68)','rgba(147,197,253,0.65)'],
    cellBg: 'rgba(225,220,255,0.93)',
    weekendBg: 'rgba(215,225,255,0.87)',
    inactiveBg: 'rgba(155,145,215,0.28)',
    accent: '#4f46e5',
  },
  rose: {
    bg: '#f8c0e0',
    sw: 'linear-gradient(135deg,#ec4899,#f59e0b)',
    c: ['rgba(236,72,153,0.72)','rgba(245,158,11,0.62)','rgba(249,168,212,0.72)','rgba(253,224,71,0.65)','rgba(252,207,232,0.72)','rgba(254,243,199,0.65)'],
    cellBg: 'rgba(255,225,240,0.93)',
    weekendBg: 'rgba(255,245,205,0.87)',
    inactiveBg: 'rgba(215,155,185,0.28)',
    accent: '#db2777',
  },
}
const POS = ['75% 65% at 3% 4%','55% 55% at 52% 18%','45% 55% at 97% 12%','50% 50% at 93% 88%','65% 52% at 18% 80%','40% 40% at 75% 60%']
const STOPS = [58,55,50,52,55,50]

function buildBg(tid) {
  const t = THEMES[tid] || THEMES.dreamy
  return {
    backgroundColor: t.bg,
    backgroundImage: [
      ...POS.map((p, i) => `radial-gradient(ellipse ${p}, ${t.c[i]} 0%, transparent ${STOPS[i]}%)`),
      "url('/watercolor-bg.jpg.png')",
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }
}

export default function CalendarClient({ initialEvents, user, inviteCode, connectedCount = 0, joined = false, joinErr }) {
  const [events, setEvents] = useState(initialEvents)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingToDate, setAddingToDate] = useState(null)
  const [dayViewDate, setDayViewDate] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifToast, setNotifToast] = useState(null)
  const [themeId, setThemeId] = useState('dreamy')
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [pinStyle, setPinStyle] = useState('classic')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const saved = localStorage.getItem('calendarTheme')
    if (saved && THEMES[saved]) setThemeId(saved)
    setNotifEnabled(localStorage.getItem('notificationsEnabled') === 'true')
    const savedPin = localStorage.getItem('pinStyle')
    if (savedPin) setPinStyle(savedPin)
    if (joined) showToast('🎉 Connected! You now see your friend\'s events too.')
    else if (joinErr === 'self') showToast("That's your own invite link!")
    else if (joinErr === 'notfound') showToast('Invite link not found — ask your friend for a new one.')
  }, [])

  useEffect(() => {
    if (!showThemePicker) return
    const close = () => setShowThemePicker(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showThemePicker])

  const showToast = (msg) => {
    setNotifToast(msg)
    setTimeout(() => setNotifToast(null), 4000)
  }

  const applyTheme = (id) => {
    setThemeId(id)
    localStorage.setItem('calendarTheme', id)
    setShowThemePicker(false)
  }

  const checkAndNotify = useCallback((eventsToCheck) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    let notifEvts = {}
    try { notifEvts = JSON.parse(localStorage.getItem('eventNotifs') || '{}') } catch {}
    const today = new Date()
    const pad = n => String(n).padStart(2, '0')
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const tomorrowKey = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}`
    if (localStorage.getItem(`notified_${todayKey}`)) return
    const todayEvents = eventsToCheck.filter(e => e.date === todayKey && notifEvts[e.id] !== false)
    const tomorrowEvents = eventsToCheck.filter(e => e.date === tomorrowKey && notifEvts[e.id] !== false)
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
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS) {
        showToast('On iPhone, add this app to your Home Screen first, then enable notifications.')
      } else {
        showToast('Notifications not supported in this browser. Try Chrome.')
      }
      return
    }
    let perm = Notification.permission
    if (perm === 'default') perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setNotifEnabled(true)
      localStorage.setItem('notificationsEnabled', 'true')
      checkAndNotify(events)
    } else {
      showToast('Notifications blocked — enable them in your phone settings for this site.')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getDayEvents = (date) => {
    if (!date) return []
    const key = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
    return events.filter(e => e.date === key)
  }

  const addEvent = async (eventData) => {
    let result = await supabase.from('events').insert({ ...eventData, user_id: user.id }).select().single()
    if (result.error && result.error.message?.includes('source_url')) {
      const { source_url, ...rest } = eventData
      result = await supabase.from('events').insert({ ...rest, user_id: user.id }).select().single()
    }
    if (result.error) throw new Error(result.error.message)
    setEvents(prev => [...prev, result.data])
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
  }

  const theme = THEMES[themeId] || THEMES.dreamy

  return (
    <div className="min-h-screen flex flex-col" style={buildBg(themeId)}>

      {/* Header — position:relative so the theme picker can anchor to its bottom edge */}
      <header
        className="flex items-center justify-between px-5"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 1rem)',
          paddingBottom: '1rem',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.5)',
          boxShadow: '0 1px 12px rgba(124,58,237,0.08)',
          position: 'relative',
          zIndex: 50,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black tracking-tighter text-white"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)` }}>
            ez
          </div>
          <span className="font-semibold text-[15px] tracking-tight" style={{ color: '#1a1a2e' }}>calendar</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Palette button — picker now anchors to the header, not this button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowThemePicker(p => !p) }}
            title="Change color theme"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}
          >
            &#127912;
          </button>

          <button
            onClick={() => setShowShareModal(true)}
            title={connectedCount === 0 ? 'Invite a friend to share calendars' : `${connectedCount} friend${connectedCount > 1 ? 's' : ''} connected`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px', position: 'relative' }}
          >
            &#128101;
            {connectedCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: theme.accent, color: '#fff',
                borderRadius: '50%', width: 14, height: 14,
                fontSize: 8, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{connectedCount}</span>
            )}
          </button>

          <button
            onClick={toggleNotifications}
            title={notifEnabled ? 'Notifications on — tap to turn off' : 'Tap to enable event reminders'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}
          >
            {notifEnabled ? '🔔' : '🔕'}
          </button>

          <button onClick={handleSignOut} className="text-[11px] transition-colors hover:text-violet-500" style={{ color: theme.accent }}>
            <span className="hidden sm:inline">{user.email} &middot; </span>sign out
          </button>
        </div>

        {/* Theme picker — anchored to header bottom-right, always visible on any screen size */}
        {showThemePicker && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 16,
              background: 'white',
              borderRadius: 18,
              padding: '10px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              border: '1px solid rgba(0,0,0,0.08)',
              display: 'flex',
              gap: 10,
              zIndex: 9999,
            }}
          >
            {Object.entries(THEMES).map(([id, t]) => (
              <button
                key={id}
                onClick={() => applyTheme(id)}
                title={id.charAt(0).toUpperCase() + id.slice(1)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: t.sw,
                  border: themeId === id ? `3px solid ${t.accent}` : '3px solid transparent',
                  cursor: 'pointer', outline: 'none', flexShrink: 0,
                  boxShadow: themeId === id ? `0 0 0 2px ${t.accent}55, 0 2px 8px rgba(0,0,0,0.15)` : '0 2px 6px rgba(0,0,0,0.15)',
                }}
              />
            ))}
          </div>
        )}
      </header>

      {notifToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom) + 88px)',
            left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(30,30,40,0.96)', color: 'white',
            padding: '12px 18px', borderRadius: 14, fontSize: 13,
            maxWidth: 'calc(100vw - 40px)', textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            zIndex: 9999, backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {notifToast}
        </div>
      )}

      <main className="flex-1 px-3 md:px-6 py-5 pb-24 max-w-4xl mx-auto w-full">
        <Calendar
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          events={events}
          onDayClick={(date) => setDayViewDate(date)}
          onEventClick={(date) => setDayViewDate(date)}
          theme={theme}
          pinStyle={pinStyle}
        />
      </main>

      <button
        onClick={() => { setAddingToDate(null); setShowAddModal(true) }}
        className="fixed right-5 flex items-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm text-white transition-all active:scale-95 hover:scale-105"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}bb)`,
          boxShadow: `0 4px 24px ${theme.accent}55`,
        }}
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
          onAdd={() => { setAddingToDate(dayViewDate); setDayViewDate(null); setShowAddModal(true) }}
          onDelete={deleteEvent}
          onPinStyleChange={(id) => setPinStyle(id)}
        />
      )}

      {showShareModal && (
        <ShareModal
          inviteCode={inviteCode}
          connectedCount={connectedCount}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  )
}
