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

const THEMES = {
  paper: {
    bg: '#fef9f2',
    sw: 'linear-gradient(135deg,#fef9f2 55%,#7c3aed)',
    c: [],
    cellBg: 'rgba(255,253,248,0.95)', weekendBg: 'rgba(254,242,248,0.9)', inactiveBg: 'rgba(180,140,100,0.10)', accent: '#7c3aed',
    paper: true,
  },
  dreamy: {
    bg: '#f0d8ff',
    sw: 'linear-gradient(135deg,#c084fc,#f472b6)',
    c: ['rgba(192,132,252,0.72)','rgba(244,114,182,0.62)','rgba(251,207,232,0.68)','rgba(216,180,254,0.72)','rgba(249,168,212,0.62)','rgba(233,213,255,0.68)'],
    cellBg: 'rgba(242,228,255,0.93)', weekendBg: 'rgba(255,218,245,0.87)', inactiveBg: 'rgba(185,155,215,0.28)', accent: '#7c3aed',
  },
  ocean: {
    bg: '#b8e0f8',
    sw: 'linear-gradient(135deg,#0ea5e9,#10b981)',
    c: ['rgba(14,165,233,0.72)','rgba(16,185,129,0.65)','rgba(99,102,241,0.58)','rgba(103,232,249,0.72)','rgba(52,211,153,0.65)','rgba(147,197,253,0.65)'],
    cellBg: 'rgba(218,242,255,0.93)', weekendBg: 'rgba(200,245,235,0.87)', inactiveBg: 'rgba(140,195,225,0.28)', accent: '#0284c7',
  },
  forest: {
    bg: '#b8f0cc',
    sw: 'linear-gradient(135deg,#22c55e,#eab308)',
    c: ['rgba(34,197,94,0.72)','rgba(234,179,8,0.62)','rgba(74,222,128,0.68)','rgba(163,230,53,0.72)','rgba(187,247,208,0.65)','rgba(254,240,138,0.65)'],
    cellBg: 'rgba(218,250,225,0.93)', weekendBg: 'rgba(242,255,205,0.87)', inactiveBg: 'rgba(140,200,155,0.28)', accent: '#16a34a',
  },
  sunset: {
    bg: '#fdd0a0',
    sw: 'linear-gradient(135deg,#f97316,#ef4444)',
    c: ['rgba(249,115,22,0.75)','rgba(239,68,68,0.65)','rgba(251,146,60,0.72)','rgba(252,165,165,0.68)','rgba(254,215,170,0.72)','rgba(253,186,116,0.68)'],
    cellBg: 'rgba(255,238,218,0.93)', weekendBg: 'rgba(255,218,215,0.87)', inactiveBg: 'rgba(215,165,130,0.28)', accent: '#ea580c',
  },
  midnight: {
    bg: '#c8c0f8',
    sw: 'linear-gradient(135deg,#6366f1,#3b82f6)',
    c: ['rgba(99,102,241,0.75)','rgba(139,92,246,0.68)','rgba(59,130,246,0.62)','rgba(167,139,250,0.75)','rgba(196,181,253,0.68)','rgba(147,197,253,0.65)'],
    cellBg: 'rgba(225,220,255,0.93)', weekendBg: 'rgba(215,225,255,0.87)', inactiveBg: 'rgba(155,145,215,0.28)', accent: '#4f46e5',
  },
  rose: {
    bg: '#f8c0e0',
    sw: 'linear-gradient(135deg,#ec4899,#f59e0b)',
    c: ['rgba(236,72,153,0.72)','rgba(245,158,11,0.62)','rgba(249,168,212,0.72)','rgba(253,224,71,0.65)','rgba(252,207,232,0.72)','rgba(254,243,199,0.65)'],
    cellBg: 'rgba(255,225,240,0.93)', weekendBg: 'rgba(255,245,205,0.87)', inactiveBg: 'rgba(215,155,185,0.28)', accent: '#db2777',
  },
  noir: {
    bg: '#0d0d14',
    sw: 'linear-gradient(135deg,#1a1a2e,#0d0d14)',
    c: ['rgba(167,139,250,0.10)','rgba(99,102,241,0.08)','rgba(139,92,246,0.06)','rgba(167,139,250,0.07)','rgba(79,70,229,0.09)','rgba(109,40,217,0.06)'],
    cellBg: 'rgba(20,20,35,0.97)', weekendBg: 'rgba(30,25,50,0.97)', inactiveBg: 'rgba(255,255,255,0.03)', accent: '#a78bfa',
    dark: true,
  },
}

const POS   = ['75% 65% at 3% 4%','55% 55% at 52% 18%','45% 55% at 97% 12%','50% 50% at 93% 88%','65% 52% at 18% 80%','40% 40% at 75% 60%']
const STOPS = [58,55,50,52,55,50]

function buildBg(tid) {
  const t = THEMES[tid] || THEMES.paper
  // Paper theme — the calm cream gradient + ruled lines from the login page
  if (t.paper) {
    return {
      backgroundColor: t.bg,
      backgroundImage: [
        'linear-gradient(160deg, #fef9f2 0%, #fff5e8 55%, #fef2f8 100%)',
        'repeating-linear-gradient(transparent 0px, transparent 27px, rgba(180,140,100,0.07) 28px)',
      ].join(', '),
      backgroundAttachment: 'fixed',
    }
  }
  return {
    backgroundColor: t.bg,
    backgroundImage: POS.map((p, i) => `radial-gradient(ellipse ${p}, ${t.c[i]} 0%, transparent ${STOPS[i]}%)`).join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
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
      <h1 style={{ fontSize: 38, fontWeight: 700, color: dark ? '#e2e8f0' : '#1a1a2e', margin: '0 0 6px' }}>Friends</h1>
      <p style={{ fontSize: 16, color: dark ? '#9ca3af' : '#7c6a56', margin: '0 0 28px', lineHeight: 1.5 }}>
        {connectedCount === 0
          ? "Invite a friend — you'll both see each other's pinned events."
          : `Sharing events with ${connectedCount} friend${connectedCount > 1 ? 's' : ''}.`}
      </p>
      {connectedFriends.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {connectedFriends.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: dark ? 'rgba(255,255,255,0.05)' : '#fffdf8', border: dark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid #e8ddd0', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
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
      <div style={{ position: 'relative', background: '#fffdf8', border: '1.5px solid #e0ccb4', borderRadius: 4, boxShadow: '4px 4px 0 rgba(0,0,0,0.11)', padding: '24px 20px 20px' }}>
        <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', width: 44, height: 20, background: 'rgba(253,224,71,0.75)', borderRadius: 3 }} />
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#a89888', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your invite link</p>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#4b5563', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>{inviteUrl || `…/${inviteCode}`}</p>
        <button onClick={copyLink} style={{ width: '100%', padding: '11px', background: copied ? 'rgba(34,197,94,0.10)' : '#1a1a2e', color: copied ? '#166534' : '#fff', border: copied ? '1.5px solid rgba(34,197,94,0.3)' : '2px solid #1a1a2e', borderRadius: 6, boxShadow: copied ? 'none' : `3px 3px 0 ${accent}`, cursor: 'pointer', fontSize: 18, fontWeight: 700, transition: 'all 0.2s', fontFamily: 'var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {copied ? '✓ Copied!' : '📋 Copy invite link'}
        </button>
      </div>
      <p style={{ marginTop: 20, fontSize: 15, color: dark ? '#6b7280' : '#a89888', lineHeight: 1.6, textAlign: 'center' }}>
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
  const [themeId, setThemeId]           = useState('paper')
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [notes, setNotes]               = useState({})
  const [activeTab, setActiveTab]       = useState('feed')
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
    const saved = localStorage.getItem('calendarTheme')
    if (saved && THEMES[saved]) setThemeId(saved)
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

  useEffect(() => {
    if (!showThemePicker) return
    const close = () => setShowThemePicker(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showThemePicker])

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
  const applyTheme = (id) => { setThemeId(id); localStorage.setItem('calendarTheme', id); setShowThemePicker(false) }

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

  const getDayEvents = (date) => {
    if (!date) return []
    const key = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
    return visibleEvents.filter(e => e.end_date ? e.date <= key && e.end_date >= key : e.date === key)
  }

  const addEvent = async (eventData) => {
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
    setEvents(prev => [...prev, result.data])
    if (eventData.date) {
      const [year, month] = eventData.date.split('-').map(Number)
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

  const theme = THEMES[themeId] || THEMES.paper

  // Branded shell shown until the client resolves the session. Because the page
  // is static, THIS is the HTML the CDN serves instantly — no white screen.
  if (!user) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 18,
        ...buildBg(themeId),
      }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: theme.dark ? '#e2e8f0' : '#1a1a2e', letterSpacing: '-0.5px' }}>
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
  const navBg    = dk ? 'rgba(10,10,18,0.98)' : 'rgba(255,253,248,0.96)'
  const navBorder = dk ? '1.5px solid rgba(255,255,255,0.07)' : '1.5px solid rgba(0,0,0,0.07)'
  const navActive = dk ? '#e2e8f0' : '#1a1a2e'
  const navMuted  = dk ? '#4b5563' : '#9ca3af'

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', ...buildBg(themeId) }}>

      {/* ── Header ── */}
      <header style={{
        flexShrink: 0,
        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
        paddingBottom: '0.75rem',
        paddingLeft: '1.25rem', paddingRight: '1.25rem',
        background: dk ? 'rgba(10,10,18,0.92)' : 'rgba(255,253,248,0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: navBorder,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 50,
      }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: navActive, letterSpacing: '-0.5px' }}>ezcalendar</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); setShowThemePicker(p => !p) }} title="Change theme"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', lineHeight: 1 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={navMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="8" cy="10" r="1.5" fill={navMuted} stroke="none"/>
              <circle cx="12" cy="7" r="1.5" fill={navMuted} stroke="none"/>
              <circle cx="16" cy="10" r="1.5" fill={navMuted} stroke="none"/>
              <circle cx="16" cy="15" r="1.5" fill={navMuted} stroke="none"/>
              <circle cx="8" cy="15" r="1.5" fill={navMuted} stroke="none"/>
            </svg>
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
          {notifEnabled && (
            <button onClick={sendTestNotification} title="Send test notification"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 10, fontWeight: 700, color: theme.accent, opacity: 0.7, lineHeight: 1 }}>
              test
            </button>
          )}
          <button onClick={handleSignOut}
            style={{ fontSize: 12, color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
            sign out
          </button>
        </div>

        {showThemePicker && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 16, background: 'white', borderRadius: 18, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', gap: 10, zIndex: 9999 }}>
            {Object.entries(THEMES).map(([id, t]) => (
              <button key={id} onClick={() => applyTheme(id)} title={id}
                style={{ width: 28, height: 28, borderRadius: '50%', background: t.sw, border: themeId === id ? `3px solid ${t.accent}` : '3px solid transparent', cursor: 'pointer', outline: 'none', flexShrink: 0, boxShadow: themeId === id ? `0 0 0 2px ${t.accent}55, 0 2px 8px rgba(0,0,0,0.15)` : '0 2px 6px rgba(0,0,0,0.15)' }}
              />
            ))}
          </div>
        )}
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
              <button key={c.id} onClick={() => setCalFilter(c.id)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: calFilter === c.id ? theme.accent : (theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                  color: calFilter === c.id ? '#fff' : (theme.dark ? '#9ca3af' : '#7c6a56'),
                  border: calFilter === c.id ? `1.5px solid ${theme.accent}` : (theme.dark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(0,0,0,0.08)'),
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

        <button onClick={() => setActiveTab('calendar')}
          style={{ flex: 1, paddingTop: 10, paddingBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: activeTab === 'calendar' ? navActive : navMuted }}>
          <CalIcon active={activeTab === 'calendar'} />
          <span style={{ fontSize: 10, fontWeight: activeTab === 'calendar' ? 700 : 400, fontFamily: 'var(--font-inter), Inter, system-ui' }}>Calendar</span>
        </button>

        {/* Center scan button — elevated */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 6 }}>
          <button onClick={() => setModal({ type: 'add', date: null })} title="Scan a flyer"
            style={{ width: 56, height: 56, borderRadius: '50%', background: dk ? '#e2e8f0' : '#1a1a2e', border: dk ? '2px solid rgba(255,255,255,0.15)' : '2px solid #111', color: dk ? '#0d0d14' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(-12px)', boxShadow: `0 0 0 4px ${dk ? 'rgba(13,13,20,0.95)' : 'rgba(255,255,255,0.95)'}, 3px 3px 0 ${theme.accent}` }}>
            <CamIcon />
          </button>
        </div>

        <button onClick={() => setActiveTab('friends')}
          style={{ flex: 1, paddingTop: 10, paddingBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: activeTab === 'friends' ? navActive : navMuted, position: 'relative' }}>
          <PeopleIcon active={activeTab === 'friends'} />
          <span style={{ fontSize: 10, fontWeight: activeTab === 'friends' ? 700 : 400, fontFamily: 'var(--font-inter), Inter, system-ui' }}>Friends</span>
          {connectedCount > 0 && (
            <span style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(12px)', background: theme.accent, color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{connectedCount}</span>
          )}
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
