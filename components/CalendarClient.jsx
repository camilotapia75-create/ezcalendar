'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Calendar from './Calendar'
import AddFlyerModal from './AddFlyerModal'
import DayView from './DayView'
import FeedView from './FeedView'
import EventDetailModal from './EventDetailModal'
import Portal from './Portal'

// The Push API requires applicationServerKey as a Uint8Array, NOT a base64 string.
// Without this conversion pushManager.subscribe() throws and background push never works.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// Create (or refresh) the Web Push subscription and sync it to the server.
// Safe to call on every load — pushManager.subscribe() returns the existing
// subscription if one already matches, so this also self-heals rotated subs.
// Throws on any failure so the caller can surface the error to the user.
async function subscribePush(reg) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) throw new Error('VAPID_KEY_MISSING')
  if (!reg?.pushManager) throw new Error('PUSH_MANAGER_UNAVAILABLE')
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null
  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub, timezone }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error || `Server save failed (${res.status})`)
  }
}

// Single fixed gig-poster theme. `ink` = text/icon color on the lime accent.
const THEME = {
  bg: '#0a0a0b',
  accent: '#c6f24e',
  ink: '#0a0a0b',
  cellBg: '#161619',
  weekendBg: '#1b1b1f',
  inactiveBg: 'rgba(255,255,255,0.02)',
  dark: true,
}

function buildBg() {
  return {
    background: 'var(--app-bg)',
    backgroundAttachment: 'fixed',
  }
}

// ── Nav icons ──────────────────────────────────────────────────────────────
const FeedIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="16" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const CalIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const PeopleIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const CamIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

// ── Friends tab ────────────────────────────────────────────────────────────
function FriendsTab({ inviteCode, connectedCount, connectedFriends = [], accent, dark, onDisconnect }) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied]     = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [leaving, setLeaving] = useState(null)

  useEffect(() => { setInviteUrl(`${window.location.origin}/join/${inviteCode}`) }, [inviteCode])

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteUrl) } catch {
      const el = document.createElement('textarea')
      el.value = inviteUrl; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.focus(); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  const displayName = (f) => f.name || f.email || 'Friend'
  const initials    = (f) => {
    const n = f.name || f.email || ''
    return n.split(/[\s@.]+/).filter(Boolean).slice(0,2).map(p => p[0].toUpperCase()).join('') || '?'
  }

  return (
    <div style={{ padding: '28px 20px 20px', maxWidth: 440, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', margin: '0 0 6px' }}>Friends</h1>
      <p style={{ fontSize: 16, color: 'var(--text-2)', margin: '0 0 28px', lineHeight: 1.5 }}>
        {connectedCount === 0
          ? "Invite a friend — you'll both see each other's pinned events."
          : `Sharing events with ${connectedCount} friend${connectedCount > 1 ? 's' : ''}.`}
      </p>
      {connectedFriends.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {connectedFriends.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: dark ? 'rgba(255,255,255,0.05)' : '#fffdf8', border: dark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid #e8ddd0', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#0a0a0b', flexShrink: 0 }}>
                {initials(f)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {f.name && <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: dark ? '#e2e8f0' : '#1a1a2e', lineHeight: 1.2 }}>{f.name}</p>}
                <p style={{ margin: 0, fontSize: 13, color: dark ? '#9ca3af' : '#7c6a56', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email}</p>
              </div>
              {confirmId === f.id ? (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={async () => { setLeaving(f.id); await onDisconnect(f.id); setLeaving(null); setConfirmId(null) }}
                    disabled={leaving === f.id}
                    style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', opacity: leaving === f.id ? 0.6 : 1 }}
                  >
                    {leaving === f.id ? 'Leaving…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    style={{ fontSize: 11, fontWeight: 700, color: dark ? '#9ca3af' : '#7c6a56', background: 'transparent', border: dark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e0ccb4', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'rgba(34,197,94,0.10)', borderRadius: 999, padding: '2px 8px' }}>Sharing</span>
                  <button
                    onClick={() => setConfirmId(f.id)}
                    title="Leave shared calendar"
                    style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: 'rgba(220,38,38,0.08)', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    Leave
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {connectedCount > 0 && connectedFriends.length === 0 && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.28)', borderRadius: 4, padding: '11px 16px', marginBottom: 20, fontSize: 15, color: '#166534' }}>
          🎉 {connectedCount} friend{connectedCount > 1 ? 's' : ''} connected!
        </div>
      )}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 20px 20px' }}>
        <p className="mono-label" style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em' }}>Your invite link</p>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)', wordBreak: 'break-all', fontFamily: 'var(--font-mono-stack)', lineHeight: 1.5 }}>{inviteUrl || `…/${inviteCode}`}</p>
        <button onClick={copyLink} className={copied ? 'btn-dark' : 'btn-lime'} style={{ width: '100%', padding: '14px', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...(copied ? { color: 'var(--lime)', borderColor: 'rgba(198,242,78,0.4)' } : {}) }}>
          {copied ? '✓ Copied!' : '📋 Copy invite link'}
        </button>
      </div>
      <p style={{ marginTop: 20, fontSize: 15, color: 'var(--text-3)', lineHeight: 1.6, textAlign: 'center' }}>
        Send this link to a friend. When they sign in, you'll both see each other's pinned events.
      </p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CalendarClient() {
  // The /calendar page is fully static (served instantly from the CDN — no
  // serverless cold start, no white screen). We resolve the signed-in user
  // client-side here; RLS protects every query regardless.
  const [user, setUser]             = useState(null)
  const [events, setEvents]         = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [inviteCode, setInviteCode]   = useState('')
  const [connectedCount, setConnectedCount] = useState(0)
  const [connectedFriends, setConnectedFriends] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  // Single modal state — only one overlay can ever show at a time
  // null | { type: 'add', date: Date|null }
  //      | { type: 'dayview', date: Date }
  //      | { type: 'event', event: {} }
  const [modal, setModal]           = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifToast, setNotifToast]     = useState(null)
  const [notes, setNotes]               = useState({})
  const [activeTab, setActiveTab]       = useState('feed')
  const [colorScheme, setColorScheme]   = useState('dark')
  const [notifEvents, setNotifEvents]   = useState({})
  // 'mine' = just your events; 'shared' = yours + connected friends' together
  const [calFilter, setCalFilter]       = useState('mine')
  const swRegRef = useRef(null)
  const router = useRouter()
  const supabase = createClient()

  const visibleEvents = !user
    ? []
    : calFilter === 'shared' ? events : events.filter(e => e.user_id === user.id)

  const disconnectFriend = async (friendId) => {
    const [a, b] = user.id < friendId ? [user.id, friendId] : [friendId, user.id]
    await supabase.from('calendar_connections').delete().eq('user_a_id', a).eq('user_b_id', b)
    setEvents(prev => prev.filter(e => e.user_id !== friendId))
    showToast('Left the shared calendar')
    router.refresh()
  }

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        swRegRef.current = reg
        // Ensure a valid subscription exists on the server when the app opens.
        // Subscription rotation is handled by the SW's pushsubscriptionchange handler
        // which fires automatically without the app being open.
        if (localStorage.getItem('notificationsEnabled') === 'true' &&
            'Notification' in window && Notification.permission === 'granted') {
          subscribePush(reg).catch(() => {})
        }
      }).catch(() => {})
    }

    // Local prefs (no auth needed) — apply immediately so the UI matches the user.
    setNotifEnabled(localStorage.getItem('notificationsEnabled') === 'true')
    try { setNotifEvents(JSON.parse(localStorage.getItem('eventNotifs') || '{}')) } catch {}

    // URL params (this page is static, so we read them on the client)
    const params = new URLSearchParams(window.location.search)
    const joined  = params.get('joined') === '1'
    const joinErr = params.get('join_err')
    const scanUrl = params.get('scan')
    if (joined)                      showToast('🎉 Connected! You now see your friend\'s events too.')
    else if (joinErr === 'self')     showToast("That's your own invite link!")
    else if (joinErr === 'notfound') showToast('Invite link not found — ask your friend for a new one.')

    // Resolve the signed-in user client-side, then load everything. Redirect to
    // the landing page if there's no session.
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (!session) { router.replace('/'); return }
      const u = session.user
      setUser(u)

      if (scanUrl) {
        setModal({ type: 'add', date: null, scanUrl })
        window.history.replaceState(null, '', '/calendar')
      }

      Promise.all([
        supabase.from('events').select('*').order('date', { ascending: true }),
        supabase.from('calendar_connections').select('user_a_id, user_b_id')
          .or(`user_a_id.eq.${u.id},user_b_id.eq.${u.id}`),
        supabase.from('calendar_invites').select('invite_code').eq('owner_id', u.id).single(),
      ]).then(async ([eventsRes, connectionsRes, inviteRes]) => {
        setEvents(eventsRes.data || [])
        setEventsLoading(false)
        const count = connectionsRes.data?.length || 0
        setConnectedCount(count)
        if (count > 0) {
          fetch('/api/friend-profiles').then(r => r.json()).then(({ friends }) => {
            if (friends?.length) setConnectedFriends(friends)
          }).catch(() => {})
        }
        let code = inviteRes.data?.invite_code || ''
        if (!code) {
          const { data: newInvite } = await supabase.from('calendar_invites')
            .insert({ owner_id: u.id }).select('invite_code').single()
          code = newInvite?.invite_code || ''
        }
        setInviteCode(code)
      }).catch(() => setEventsLoading(false))

      supabase.from('day_notes').select('id, date, text_note, drawing_data').then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(n => {
          if (!map[n.date]) map[n.date] = []
          map[n.date].push({ id: n.id, text_note: n.text_note, drawing_data: n.drawing_data })
        })
        setNotes(map)
      })
    })
    return () => { cancelled = true }
  }, [])

  // Auto-update: home-screen PWAs cache the old bundle aggressively. Compare
  // the deployed commit SHA on focus and reload once when a new deploy ships.
  useEffect(() => {
    let baseline = null
    let lastCheck = 0
    const check = async () => {
      if (Date.now() - lastCheck < 60000) return
      lastCheck = Date.now()
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        const { v } = await res.json()
        if (!v || v === 'dev') return
        if (baseline === null) { baseline = v; return }
        if (v !== baseline) window.location.reload()
      } catch {}
    }
    check()
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const showToast = (msg) => { setNotifToast(msg); setTimeout(() => setNotifToast(null), 4000) }

  const saveNote = async (dateStr, noteData) => {
    const { data, error } = await supabase.from('day_notes')
      .insert({ user_id: user.id, date: dateStr, text_note: noteData.text_note, drawing_data: noteData.drawing_data })
      .select('id, text_note, drawing_data').single()
    if (!error && data) setNotes(prev => ({ ...prev, [dateStr]: [...(prev[dateStr] || []), data] }))
  }

  const deleteNote = async (noteId, dateStr) => {
    await supabase.from('day_notes').delete().eq('id', noteId)
    setNotes(prev => ({ ...prev, [dateStr]: (prev[dateStr] || []).filter(n => n.id !== noteId) }))
  }

  const sendTestNotification = async () => {
    showToast('Sending daily digest preview...')
    try {
      const res = await fetch('/api/push-test', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const msg = data.todayCount > 0
          ? `Sent: "${data.title}" — notifications working!`
          : data.tomorrowCount > 0
            ? `Sent tomorrow reminder — notifications working!`
            : `Sent — no events today/tomorrow but pipeline works!`
        showToast(msg)
      } else if (data.error === 'no_subscription') {
        showToast('No subscription saved — toggle notifications off then on again.')
      } else if (res.status === 410) {
        showToast('Subscription expired — toggle notifications off then on to re-register.')
      } else if (data.error === 'vapid_mismatch') {
        showToast('Server key mismatch — contact support or re-add VAPID keys to Vercel.')
      } else {
        showToast(`Test failed: ${data.message || data.error || 'unknown error'}`)
      }
    } catch {
      showToast('Test failed — check your connection.')
    }
  }

  const toggleNotifications = async () => {
    if (notifEnabled) {
      setNotifEnabled(false)
      localStorage.setItem('notificationsEnabled', 'false')
      try {
        const reg = swRegRef.current || await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) { await sub.unsubscribe(); await fetch('/api/push-subscribe', { method: 'DELETE' }) }
      } catch {}
      return
    }
    if (!('Notification' in window)) {
      showToast(/iPad|iPhone|iPod/.test(navigator.userAgent)
        ? 'On iPhone, add to Home Screen first, then enable notifications.'
        : 'Notifications not supported. Try Chrome.')
      return
    }
    let perm = Notification.permission
    if (perm === 'default') perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      showToast('Notifications blocked — enable them in your phone settings for this site.')
      return
    }
    setNotifEnabled(true)
    localStorage.setItem('notificationsEnabled', 'true')
    try {
      const reg = swRegRef.current || await navigator.serviceWorker.ready
      await subscribePush(reg)
      showToast("Notifications on — sending test to confirm...")
      // Auto-test so the user immediately knows if the pipeline works end-to-end
      setTimeout(async () => {
        try {
          const res = await fetch('/api/push-test', { method: 'POST' })
          if (!res.ok) {
            const d = await res.json()
            showToast(`Notification setup issue: ${d.message || d.error || 'check Vercel env vars'}`)
          }
        } catch {}
      }, 1500)
    } catch {
      showToast("Couldn't enable notifications — try again.")
    }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  // Light/dark toggle — the theme is applied via <html data-theme> (set pre-paint
  // in layout.jsx). Here we just flip it and persist the choice.
  useEffect(() => { setColorScheme(document.documentElement.dataset.theme || 'dark') }, [])
  const toggleColorScheme = () => {
    setColorScheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try { localStorage.setItem('colorScheme', next) } catch {}
      return next
    })
  }

  const getDayEvents = (date) => {
    if (!date) return []
    const key = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
    return visibleEvents.filter(e => e.end_date ? e.date <= key && e.end_date >= key : e.date === key)
  }

  // Insert one event, with graceful fallback when older DB schemas lack columns
  const insertOne = async (eventData) => {
    let result = await supabase.from('events').insert({ ...eventData, user_id: user.id }).select().single()
    if (result.error?.message?.includes('source_url')) {
      const { source_url, ...rest } = eventData
      result = await supabase.from('events').insert({ ...rest, user_id: user.id }).select().single()
    }
    if (result.error?.message?.includes('end_date')) {
      const { end_date, source_url, ...rest } = eventData
      result = await supabase.from('events').insert({ ...rest, user_id: user.id }).select().single()
    }
    if (result.error) throw new Error(result.error.message)
    return result.data
  }

  // Accepts a single event object OR an array — a multi-date event (separate
  // occurrences) is saved as one event per date so each keeps its own venue/time.
  const addEvent = async (eventData) => {
    const items = Array.isArray(eventData) ? eventData : [eventData]
    const inserted = []
    for (const item of items) inserted.push(await insertOne(item))
    setEvents(prev => [...prev, ...inserted])
    const firstDate = items[0]?.date
    if (firstDate) {
      const [year, month] = firstDate.split('-').map(Number)
      setCurrentDate(new Date(year, month - 1, 1))
    }
    setModal(null)
  }

  const deleteEvent = async (id) => {
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const handleFeedEventTap    = (event) => setModal({ type: 'event', event })
  const handleDayViewEventTap = (event) => setModal({ type: 'event', event })

  const toggleEventNotif = (id) => {
    setNotifEvents(prev => {
      const next = { ...prev }
      if (prev[id] === false) delete next[id]
      else next[id] = false
      try { localStorage.setItem('eventNotifs', JSON.stringify(next)) } catch {}
      return next
    })
  }
  const isEventOn = (id) => notifEvents[id] !== false

  const theme = THEME

  // Branded shell shown until the client resolves the session. Because the page
  // is static, THIS is the HTML the CDN serves instantly — no white screen.
  if (!user) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 18,
        ...buildBg(),
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          ezcalendar
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: `3px solid ${theme.accent}30`, borderTopColor: theme.accent,
          animation: 'calLoadSpin 0.7s linear infinite',
        }} />
        <style>{'@keyframes calLoadSpin { to { transform: rotate(360deg); } }'}</style>
      </div>
    )
  }

  const dateKey = (date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')

  const dk = theme.dark
  const navBg     = 'var(--nav-bg)'
  const navBorder = '1px solid var(--border)'
  const navActive = 'var(--text)'
  const navMuted  = 'var(--text-3)'

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', ...buildBg() }}>

      {/* ── Header ── */}
      <header style={{
        flexShrink: 0,
        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
        paddingBottom: '0.75rem',
        paddingLeft: '1.25rem', paddingRight: '1.25rem',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(12px)',
        borderBottom: navBorder,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 50,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 17 }}>📌</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: navActive, letterSpacing: '-0.02em' }}>ezcalendar</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={toggleColorScheme} title={colorScheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', lineHeight: 1, color: navMuted }}>
            {colorScheme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <button onClick={toggleNotifications} title={notifEnabled ? 'Tap to disable notifications' : 'Enable notifications'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', lineHeight: 1 }}>
            <svg width="19" height="19" viewBox="0 0 24 24"
              fill={notifEnabled ? `${theme.accent}22` : 'none'}
              stroke={notifEnabled ? theme.accent : navMuted}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              {!notifEnabled && <line x1="3" y1="3" x2="21" y2="21" />}
            </svg>
          </button>
          <button onClick={() => setActiveTab('friends')} className="mono-label"
            style={{ position: 'relative', fontSize: 10, letterSpacing: '0.1em', color: activeTab === 'friends' ? theme.accent : 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
            FRIENDS
            {connectedCount > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, background: theme.accent, color: theme.ink, borderRadius: '50%', minWidth: 13, height: 13, padding: '0 3px', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{connectedCount}</span>
            )}
          </button>
          <button onClick={handleSignOut} className="mono-label"
            style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
            SIGN OUT
          </button>
        </div>
      </header>

      {/* ── Toast ── */}
      {notifToast && (
        <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 88px)', left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,30,40,0.96)', color: 'white', padding: '12px 18px', borderRadius: 14, fontSize: 13, maxWidth: 'calc(100vw - 40px)', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 9999, backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {notifToast}
        </div>
      )}

      {/* ── Content ── */}
      <main style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
        <div key={activeTab} className="anim-tab">
        {/* Calendar filter — only meaningful once friends are connected */}
        {connectedFriends.length > 0 && (activeTab === 'feed' || activeTab === 'calendar') && (
          <div style={{ display: 'flex', gap: 8, padding: '14px 16px 0', maxWidth: 900, margin: '0 auto', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {[
              { id: 'mine',   label: 'My calendar' },
              { id: 'shared', label: 'Shared' },
            ].map(c => (
              <button key={c.id} onClick={() => setCalFilter(c.id)} className="mono-label"
                style={{
                  flexShrink: 0, padding: '7px 15px', borderRadius: 999, fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
                  background: calFilter === c.id ? theme.accent : 'rgba(255,255,255,0.05)',
                  color: calFilter === c.id ? theme.ink : 'var(--text-3)',
                  border: calFilter === c.id ? `1.5px solid ${theme.accent}` : '1.5px solid rgba(255,255,255,0.09)',
                  transition: 'all 0.15s',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {activeTab === 'feed' && (
          <FeedView events={visibleEvents} accent={theme.accent} onEventTap={evt => setModal({ type: 'event', event: evt })} onDeleteEvent={deleteEvent} onScan={() => setModal({ type: 'add', date: null })} dark={dk} loading={eventsLoading} />
        )}
        {activeTab === 'calendar' && (
          <div style={{ padding: '16px 12px 8px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
            <Calendar
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              events={visibleEvents}
              onDayClick={d => setModal({ type: 'dayview', date: d })}
              onEventClick={d => setModal({ type: 'dayview', date: d })}
              theme={theme}
              notes={notes}
            />
          </div>
        )}
        {activeTab === 'friends' && (
          <FriendsTab inviteCode={inviteCode} connectedCount={connectedCount} connectedFriends={connectedFriends} accent={theme.accent} dark={theme.dark} onDisconnect={disconnectFriend} />
        )}
        </div>
      </main>

      {/* ── Bottom Nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: navBg, backdropFilter: 'blur(16px)', borderTop: navBorder, paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex', alignItems: 'stretch' }}>
        <button onClick={() => setActiveTab('feed')}
          style={{ flex: 1, paddingTop: 10, paddingBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: activeTab === 'feed' ? navActive : navMuted }}>
          <FeedIcon active={activeTab === 'feed'} />
          <span style={{ fontSize: 10, fontWeight: activeTab === 'feed' ? 700 : 400, fontFamily: 'var(--font-inter), Inter, system-ui' }}>Upcoming</span>
        </button>

        {/* Center scan button — elevated */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 6 }}>
          <button onClick={() => setModal({ type: 'add', date: null })} title="Scan a flyer"
            style={{ width: 58, height: 58, borderRadius: '50%', background: theme.accent, border: 'none', color: theme.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(-12px)', boxShadow: `0 0 0 5px #0a0a0b, 0 6px 22px rgba(198,242,78,0.4)` }}>
            <CamIcon />
          </button>
        </div>

        <button onClick={() => setActiveTab('calendar')}
          style={{ flex: 1, paddingTop: 10, paddingBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: activeTab === 'calendar' ? navActive : navMuted }}>
          <CalIcon active={activeTab === 'calendar'} />
          <span style={{ fontSize: 10, fontWeight: activeTab === 'calendar' ? 700 : 400, fontFamily: 'var(--font-inter), Inter, system-ui' }}>Calendar</span>
        </button>
      </nav>

      {/* ── Modals — single state, only one ever renders ── */}
      {modal?.type === 'add' && (
        <AddFlyerModal
          date={modal.date}
          onAdd={addEvent}
          onClose={() => setModal(null)}
          userId={user.id}
          initialUrl={modal.scanUrl || null}
        />
      )}
      {modal?.type === 'dayview' && (
        <DayView
          date={modal.date}
          events={getDayEvents(modal.date)}
          notes={notes[dateKey(modal.date)] || []}
          onClose={() => setModal(null)}
          onAdd={() => setModal({ type: 'add', date: modal.date })}
          onDelete={deleteEvent}
          onSaveNote={saveNote}
          onDeleteNote={deleteNote}
          accent={theme.accent}
          onEventTap={handleDayViewEventTap}
        />
      )}
      {modal?.type === 'event' && (
        <EventDetailModal
          event={modal.event}
          accent={theme.accent}
          onClose={() => setModal(null)}
          onDelete={deleteEvent}
          reminderOn={isEventOn(modal.event.id)}
          onToggleReminder={() => toggleEventNotif(modal.event.id)}
        />
      )}
    </div>
  )
}
