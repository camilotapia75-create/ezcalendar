'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { makeSampleEvents, makeSampleSuggestion } from '@/lib/sampleEvents'
import Calendar from './Calendar'
import AddFlyerModal from './AddFlyerModal'
import DayView from './DayView'
import FeedView from './FeedView'
import EventDetailModal from './EventDetailModal'
import Portal from './Portal'
import Wordmark from './Wordmark'
import ErrorBoundary from './ErrorBoundary'

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

// Stable identity for a suggested event (for dedupe / dismiss / already-pinned).
const suggKey = (s) => `${String(s?.title || '').toLowerCase().trim()}|${s?.date || ''}`

// Deterministic shuffle so the "Suggested" order changes day-to-day (rotation)
// but stays stable within a day (no reshuffling on every render).
function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = seed % 233280 || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
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
function FriendsTab({ inviteCode, feedToken, connectedCount, connectedFriends = [], accent, dark, onDisconnect, onFeedTokenChange }) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [origin, setOrigin]       = useState('')
  const [copied, setCopied]     = useState(false)
  const [feedCopied, setFeedCopied] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [leaving, setLeaving] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  useEffect(() => { setInviteUrl(`${window.location.origin}/join/${inviteCode}`); setOrigin(window.location.origin) }, [inviteCode])

  const feedHttps = feedToken ? `${origin}/api/calendar/${feedToken}.ics` : ''
  const feedWebcal = feedToken ? feedHttps.replace(/^https?:/, 'webcal:') : ''

  // Google Calendar has no reliable one-tap subscribe link for an external ICS
  // (render?cid= only works for Google-hosted calendars). So copy the link and
  // open Google's "Add by URL" page, where the user pastes and taps Add.
  const addToGoogle = async () => {
    await copyText(feedHttps, setFeedCopied)
    try { window.open('https://calendar.google.com/calendar/u/0/r/settings/addbyurl', '_blank', 'noopener') } catch {}
  }

  const resetFeed = async () => {
    setResetting(true)
    try {
      const r = await fetch('/api/calendar/reset-feed', { method: 'POST' })
      const d = await r.json()
      if (r.ok && d.feedToken) { onFeedTokenChange?.(d.feedToken); setResetDone(true) }
    } catch {}
    setResetting(false)
    setConfirmReset(false)
  }

  const copyText = async (text, setter) => {
    try { await navigator.clipboard.writeText(text) } catch {
      const el = document.createElement('textarea')
      el.value = text; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.focus(); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setter(true); setTimeout(() => setter(false), 2500)
  }
  const copyLink = () => copyText(inviteUrl, setCopied)

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

      {/* Sync to phone calendar — subscribe once, everything you pin flows in */}
      {feedToken && (
        <div style={{ marginTop: 26, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 20px 20px' }}>
          <p className="mono-label" style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em' }}>Sync to your calendar</p>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Subscribe once and every event you pin shows up in your phone's calendar automatically.
          </p>
          <a href={feedWebcal} className="btn-lime" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', fontSize: 16, textDecoration: 'none', marginBottom: 8 }}>
            📆 Add to Apple Calendar
          </a>
          <button onClick={addToGoogle} className="btn-dark" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', fontSize: 16, cursor: 'pointer' }}>
            📆 Add to Google Calendar
          </button>
          <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, textAlign: 'center' }}>
            {feedCopied
              ? '✓ Link copied — paste it into Google\'s box and tap “Add calendar”.'
              : 'Copies your link and opens Google\'s “From URL” page — just paste and tap Add.'}
          </p>

          {/* Unsubscribe — rotate the token so the old feed stops updating */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            {resetDone ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                ✓ Syncing stopped. Your old link no longer updates — to finish, delete the <b>FLYRLY</b> calendar in your phone's Calendar app. Re-add it above anytime.
              </p>
            ) : !confirmReset ? (
              <button onClick={() => setConfirmReset(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12.5 }}>
                Stop syncing / reset link
              </button>
            ) : (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  This disables your current sync link everywhere it's subscribed. You'll need to re-add the calendar to keep syncing. Continue?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={resetFeed} disabled={resetting}
                    style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.10)', color: '#f87171', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: resetting ? 0.6 : 1 }}>
                    {resetting ? 'Stopping…' : 'Stop syncing'}
                  </button>
                  <button onClick={() => setConfirmReset(false)} className="btn-dark" style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
  const [feedToken, setFeedToken]     = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [dismissedSugg, setDismissedSugg] = useState([])  // persisted keys of suggestions the user hid
  const [suggestMeta, setSuggestMeta] = useState(null)  // { reason, city } for diagnostics/empty-state
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
  const [undoData, setUndoData]         = useState(null)  // { ids, label } after an auto-save
  const undoTimer = useRef(null)
  const [notes, setNotes]               = useState({})
  const [activeTab, setActiveTab]       = useState('feed')
  const [colorScheme, setColorScheme]   = useState('dark')
  const [notifEvents, setNotifEvents]   = useState({})
  // 'mine' = just your events; 'shared' = yours + connected friends' together
  const [calFilter, setCalFilter]       = useState('mine')
  const [filterOpen, setFilterOpen]     = useState(false)  // My/Shared picker collapsed by default
  const [samplesDismissed, setSamplesDismissed] = useState(false)
  const swRegRef = useRef(null)
  // True once the user has added events this session. Guards against a slow
  // initial load resolving AFTER an add and overwriting the new rows.
  const addedThisSession = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  const visibleEvents = !user
    ? []
    : calFilter === 'shared' ? events : events.filter(e => e.user_id === user.id)

  // First-run demo: when a signed-in user's feed would otherwise be empty, show
  // client-only sample events + one sample suggestion so the app looks alive and
  // teaches the flow. They are NEVER written to Supabase, and disappear the
  // moment a real event exists or the user clears them.
  const showSamples = !!user && !eventsLoading && visibleEvents.length === 0 && !samplesDismissed
  const sampleEvents = useMemo(() => (showSamples ? makeSampleEvents() : []), [showSamples])
  const sampleSuggestion = useMemo(() => (showSamples ? makeSampleSuggestion() : null), [showSamples])
  const feedEvents = showSamples ? sampleEvents : visibleEvents
  // What the Suggested row actually shows: drop events the user already pinned
  // or dismissed, rotate the pool by day for freshness, and cap the DOM.
  const feedSuggestions = useMemo(() => {
    if (showSamples) return [sampleSuggestion]
    if (calFilter !== 'mine') return []
    const dismissed = new Set(dismissedSugg)
    const mine = new Set((user ? events.filter(e => e.user_id === user.id) : []).map(suggKey))
    const filtered = suggestions.filter(s => !dismissed.has(suggKey(s)) && !mine.has(suggKey(s)))
    // Collapse the same event across dates/listings (a 2-night run, "2-day
    // ticket" variants, etc.) to ONE card — the soonest date — keyed by a
    // loose title. Prevents "Billy Strings" showing up two or three times.
    const titleKey = (s) => String(s?.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(tickets?|2 day|two day|valid both days|the \d+.. anniversary tour|world tour|tour)\b/g, '').replace(/\s+/g, ' ').trim()
    const byTitle = new Map()
    for (const s of filtered) {
      const k = titleKey(s) || suggKey(s)
      const prev = byTitle.get(k)
      if (!prev || (s.date && prev.date && s.date < prev.date)) byTitle.set(k, s)
    }
    const pool = [...byTitle.values()]
    const daySeed = Math.floor(Date.now() / 86400000)
    const KEEP_TOP = 3  // keep the AI's strongest picks pinned; rotate the rest
    const rotated = [...pool.slice(0, KEEP_TOP), ...seededShuffle(pool.slice(KEEP_TOP), daySeed)]
    return rotated.slice(0, 15)
  }, [showSamples, sampleSuggestion, calFilter, suggestions, dismissedSugg, events, user])

  const dismissSuggestion = (s) => {
    if (!s || s.sample) return
    const k = suggKey(s)
    setDismissedSugg(prev => {
      if (prev.includes(k)) return prev
      const next = [...prev, k].slice(-400)
      if (user) { try { localStorage.setItem(`dismissedSuggestions_${user.id}`, JSON.stringify(next)) } catch {} }
      return next
    })
  }
  const dismissSamples = () => {
    setSamplesDismissed(true)
    try { localStorage.setItem('samplesDismissed', '1') } catch {}
  }

  const disconnectFriend = async (friendId) => {
    const [a, b] = user.id < friendId ? [user.id, friendId] : [friendId, user.id]
    await supabase.from('calendar_connections').delete().eq('user_a_id', a).eq('user_b_id', b)
    setEvents(prev => prev.filter(e => e.user_id !== friendId))
    showToast('Left the shared calendar')
    router.refresh()
  }

  // Native (Capacitor) deep link: the iOS/Android Share Extension opens the app
  // at ezcalendar://scan?url=<post link> — turn that into a scan. No-op on web
  // (window.Capacitor is undefined in the PWA).
  useEffect(() => {
    const Cap = typeof window !== 'undefined' && window.Capacitor
    const App = Cap?.Plugins?.App
    if (!App?.addListener) return
    let handle
    const openScan = (url) => {
      try {
        const q = new URL(url).searchParams.get('url')
        if (q) setModal({ type: 'add', date: null, scanUrl: q })
      } catch {}
    }
    const p = App.addListener('appUrlOpen', ({ url }) => openScan(url))
    Promise.resolve(p).then(h => { handle = h }).catch(() => {})
    // Cold start: app launched directly from the share
    App.getLaunchUrl?.().then?.(res => { if (res?.url) openScan(res.url) }).catch?.(() => {})
    return () => { try { handle?.remove?.() } catch {} }
  }, [])

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
    if (localStorage.getItem('samplesDismissed') === '1') setSamplesDismissed(true)

    // URL params (this page is static, so we read them on the client)
    const params = new URLSearchParams(window.location.search)
    const joined  = params.get('joined') === '1'
    const joinErr = params.get('join_err')
    const scanUrl = params.get('scan')
    if (joined)                      showToast('🎉 Connected! You now see your friend\'s events too.')
    else if (joinErr === 'self')     showToast("That's your own invite link!")
    else if (joinErr === 'notfound') showToast('Invite link not found — ask your friend for a new one.')

    // Optimistic instant render: paint the app from cache WITHOUT waiting for
    // getSession's (possibly cold) network token refresh. Auth is confirmed in
    // the background below; RLS gates every query, so a stale id fetches nothing.
    try {
      const lastUid = localStorage.getItem('lastUserId')
      if (lastUid) {
        const cached = localStorage.getItem(`cachedEvents_${lastUid}`)
        const arr = cached ? JSON.parse(cached) : null
        if (Array.isArray(arr) && arr.length) {
          setUser({ id: lastUid })
          setEvents(arr)
          setEventsLoading(false)
        }
      }
    } catch {}

    // Resolve the signed-in user client-side, then load everything. Redirect to
    // the landing page if there's no session.
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (!session) { setUser(null); router.replace('/'); return }
      const u = session.user
      setUser(u)
      try { localStorage.setItem('lastUserId', u.id) } catch {}

      if (scanUrl) {
        setModal({ type: 'add', date: null, scanUrl })
        window.history.replaceState(null, '', '/calendar')
      }

      Promise.all([
        supabase.from('events').select('*').order('date', { ascending: true }),
        supabase.from('calendar_connections').select('user_a_id, user_b_id')
          .or(`user_a_id.eq.${u.id},user_b_id.eq.${u.id}`),
        supabase.from('calendar_invites').select('*').eq('owner_id', u.id).single(),
      ]).then(async ([eventsRes, connectionsRes, inviteRes]) => {
        // If the user already added something while this (cold) load was in
        // flight, its query predates the insert — re-fetch so we don't clobber
        // the new rows. Otherwise use the result we already have.
        if (addedThisSession.current) {
          const { data: fresh } = await supabase.from('events').select('*').order('date', { ascending: true })
          setEvents(fresh || eventsRes.data || [])
        } else {
          setEvents(eventsRes.data || [])
        }
        setEventsLoading(false)
        const count = connectionsRes.data?.length || 0
        setConnectedCount(count)
        if (count > 0) {
          fetch('/api/friend-profiles').then(r => r.json()).then(({ friends }) => {
            if (friends?.length) setConnectedFriends(friends)
          }).catch(() => {})
        }
        let row = inviteRes.data
        if (!row?.invite_code) {
          const { data: newInvite } = await supabase.from('calendar_invites')
            .insert({ owner_id: u.id }).select('*').single()
          row = newInvite
        }
        setInviteCode(row?.invite_code || '')
        setFeedToken(row?.feed_token || '')
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
  // the deployed commit SHA on focus and reload ONCE when a new deploy ships.
  // Guard against a reload loop: right after a deploy, Vercel's edge can briefly
  // serve /api/version from different instances, so the SHA flip-flops. Without
  // a cap, every flip fired window.location.reload() → Safari's "a problem
  // repeatedly occurred". Reload at most once per tab session.
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
        if (v === baseline) return
        // A new deploy — reload once to pick it up. Two hard guards against a
        // loop: never reload for the SAME target version twice, and never reload
        // more than once every 2 minutes (covers the post-deploy window where
        // Vercel's edge briefly flip-flops the SHA between instances).
        let last = null
        try { last = JSON.parse(localStorage.getItem('ezcal_last_reload') || 'null') } catch {}
        const now = Date.now()
        if (last && (last.v === v || now - last.t < 120000)) return
        try { localStorage.setItem('ezcal_last_reload', JSON.stringify({ v, t: now })) } catch {}
        window.location.reload()
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

  // Keep the instant-paint cache in sync with the live events (add/delete/refresh)
  useEffect(() => {
    if (user && !eventsLoading) {
      try { localStorage.setItem(`cachedEvents_${user.id}`, JSON.stringify(events)) } catch {}
    }
  }, [events, user, eventsLoading])

  const handleSignOut = async () => {
    if (user) { try { localStorage.removeItem(`cachedEvents_${user.id}`) } catch {} }
    try { localStorage.removeItem('lastUserId') } catch {}
    await supabase.auth.signOut()
    router.push('/')
  }

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
    return feedEvents.filter(e => e.end_date ? e.date <= key && e.end_date >= key : e.date === key)
  }

  // Insert one event, with graceful fallback when older DB schemas lack optional
  // columns (series_id / source_url / end_date) — progressively drop and retry.
  const insertOne = async (eventData) => {
    const attempt = (data) => supabase.from('events').insert({ ...data, user_id: user.id }).select().single()
    let data = { ...eventData }
    let result = await attempt(data)
    for (const col of ['series_id', 'source_url', 'end_date']) {
      if (!result.error) break
      if (result.error.message?.includes(col)) {
        delete data[col]
        result = await attempt(data)
      }
    }
    if (result.error) throw new Error(result.error.message)
    return result.data
  }

  // Accepts a single event object OR an array — a multi-date event (separate
  // occurrences) or a recurring series is saved as one event per date.
  // opts.auto = saved automatically from a confident scan → show an Undo toast.
  const addEvent = async (eventData, opts = {}) => {
    const items = Array.isArray(eventData) ? eventData : [eventData]
    const inserted = []
    for (const item of items) inserted.push(await insertOne(item))
    addedThisSession.current = true
    setEvents(prev => [...prev, ...inserted])
    // Point the month grid at the first new event so it's there if the user
    // switches to the grid…
    const firstDate = items[0]?.date
    if (firstDate) {
      const [year, month] = firstDate.split('-').map(Number)
      setCurrentDate(new Date(year, month - 1, 1))
    }
    setModal(null)
    // …but LAND them on the feed, where every event shows in one list regardless
    // of month. Jumping the grid to a far-future month (e.g. a 2027 festival) made
    // it look like everything else had vanished.
    setActiveTab('feed')
    if (opts.auto && inserted.length) {
      setUndoData({ ids: inserted.map(e => e.id), label: inserted[0]?.title || 'Event' })
      clearTimeout(undoTimer.current)
      undoTimer.current = setTimeout(() => setUndoData(null), 7000)
    } else if (inserted.length > 1) {
      showToast(`✅ Added ${inserted.length} dates — they're all here in your feed`)
    } else if (inserted.length === 1) {
      showToast('✅ Added to your calendar')
    }
  }

  // Undo an auto-save (delete the just-created event/series)
  const undoAdd = async () => {
    if (!undoData) return
    const ids = undoData.ids
    setUndoData(null)
    clearTimeout(undoTimer.current)
    setEvents(prev => prev.filter(e => !ids.includes(e.id)))
    await supabase.from('events').delete().in('id', ids)
  }

  // Suggested events — real local events (Ticketmaster + popular community pins)
  // ranked by taste. Cached ~12h per user so we don't recompute on every open.
  useEffect(() => {
    if (!user) return
    // Restore the user's dismissed suggestions so hidden events stay hidden.
    try {
      const d = JSON.parse(localStorage.getItem(`dismissedSuggestions_${user.id}`) || '[]')
      if (Array.isArray(d)) setDismissedSugg(d)
    } catch {}
    const cacheKey = `suggestedCache_${user.id}`
    let cached = null
    try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null') } catch {}
    // Paint from cache immediately if it's fresh (short 4h TTL so rotation
    // refreshes through the day) — but keep it around as a fallback either way.
    if (cached?.data?.length) {
      setSuggestions(cached.data)
      if (Date.now() - cached.ts < 4 * 3600 * 1000) return
    }
    fetch('/api/suggested').then(async r => {
      if (!r.ok) { setSuggestMeta({ reason: `http_${r.status}` }); return }  // keep any cached data on screen
      const d = await r.json()
      const s = d.suggestions || []
      // Never blank an existing list on a transient empty/failed refresh — only
      // replace when we actually got results (or there was nothing cached).
      if (s.length || !cached?.data?.length) setSuggestions(s)
      setSuggestMeta({ reason: d.reason || (s.length ? 'ok' : 'empty'), city: d.city || null })
      if (s.length) { try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: s })) } catch {} }
    }).catch(() => setSuggestMeta({ reason: 'fetch_error' }))  // keep any cached data on screen
  }, [user])

  // Open a suggestion in the same detail popup as a pinned event (details, link,
  // Add to Calendar) — with a "Pin to my calendar" action instead of delete.
  const openSuggestion = (s) => setModal({
    type: 'suggestion',
    raw: s,
    event: {
      title: s.title,
      date: s.date,
      end_date: null,
      time_str: s.time_str || '',
      location: [s.venue, s.city].filter(Boolean).join(', '),
      image_url: s.image || null,
      source_url: s.url || null,
    },
  })

  const pinSuggestion = async (s) => {
    // The demo suggestion is a mockup — don't write it to the DB; nudge to scan.
    if (s?.sample) { showToast("That's a sample — snap a real flyer to pin your own ✨"); setModal(null); return }
    setSuggestions(prev => {
      const next = prev.filter(x => !(x.title === s.title && x.date === s.date))
      if (user) { try { localStorage.setItem(`suggestedCache_${user.id}`, JSON.stringify({ ts: Date.now(), data: next })) } catch {} }
      return next
    })
    await addEvent({
      date: s.date,
      end_date: null,
      title: s.title,
      time_str: s.time_str || '',
      location: [s.venue, s.city].filter(Boolean).join(', '),
      image_url: s.image || null,
      source_url: s.url || null,
    })
  }

  // Delete. Recurring events (a shared series_id) remove the WHOLE series, so
  // removing one "every Thursday" clears them all. Falls back to single-row
  // delete for one-off events (and when the series_id column doesn't exist yet).
  const deleteEvent = async (id) => {
    // Sample cards aren't in the DB — removing one clears the whole demo.
    if (typeof id === 'string' && id.startsWith('__sample')) { dismissSamples(); return }
    const seriesId = events.find(e => e.id === id)?.series_id
    if (seriesId) {
      await supabase.from('events').delete().eq('series_id', seriesId)
      setEvents(prev => prev.filter(e => e.series_id !== seriesId))
    } else {
      await supabase.from('events').delete().eq('id', id)
      setEvents(prev => prev.filter(e => e.id !== id))
    }
  }

  // Remove just one occurrence of a recurring series, leaving the rest.
  const deleteOccurrence = async (id) => {
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
        <Wordmark size={32} accent={theme.accent} />
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
        <Wordmark size={22} color={navActive} accent={theme.accent} />
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

      {/* ── Auto-save "Added ✓ · Undo" toast ── */}
      {undoData && (
        <div className="anim-tab" style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 88px)', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(20,22,16,0.97)', color: '#fff', padding: '12px 12px 12px 18px', borderRadius: 16, fontSize: 14, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', zIndex: 9999, backdropFilter: 'blur(10px)', border: '1px solid rgba(198,242,78,0.4)' }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: theme.accent, fontWeight: 700 }}>✓ Added</span>{' '}{undoData.label}
          </span>
          <button onClick={undoAdd} className="btn-lime" style={{ flexShrink: 0, padding: '8px 16px', fontSize: 13, borderRadius: 11 }}>
            Undo
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <main style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
        <ErrorBoundary key={activeTab}>
        <div className="anim-tab">
        {/* Calendar filter — only meaningful once friends are connected */}
        {connectedFriends.length > 0 && (activeTab === 'feed' || activeTab === 'calendar') && (
          <div style={{ padding: '14px 16px 0', maxWidth: 900, margin: '0 auto', width: '100%' }}>
            {!filterOpen ? (
              // Collapsed: just show the active view; tap to reveal the options.
              <button onClick={() => setFilterOpen(true)} className="mono-label"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '7px 14px', borderRadius: 999, fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: 'var(--text-2)', border: '1.5px solid rgba(255,255,255,0.09)' }}>
                {calFilter === 'shared' ? 'Shared' : 'My calendar'}
                <span style={{ fontSize: 8 }}>▾</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {[
                  { id: 'mine',   label: 'My calendar' },
                  { id: 'shared', label: 'Shared' },
                ].map(c => (
                  <button key={c.id} onClick={() => { setCalFilter(c.id); setFilterOpen(false) }} className="mono-label"
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
          </div>
        )}
        {activeTab === 'feed' && (
          <FeedView events={feedEvents} accent={theme.accent} onEventTap={evt => setModal({ type: 'event', event: evt })} onDeleteEvent={deleteEvent} onScan={() => setModal({ type: 'add', date: null })} dark={dk} loading={eventsLoading} suggestions={feedSuggestions} onPinSuggested={pinSuggestion} onSuggestionTap={openSuggestion} onDismissSuggested={showSamples ? null : dismissSuggestion} suggestMeta={showSamples ? null : suggestMeta} demo={showSamples} onDismissDemo={dismissSamples} />
        )}
        {activeTab === 'calendar' && (
          <div style={{ padding: '16px 12px 8px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
            <Calendar
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              events={feedEvents}
              onDayClick={d => setModal({ type: 'dayview', date: d })}
              onEventClick={d => setModal({ type: 'dayview', date: d })}
              theme={theme}
              notes={notes}
            />
          </div>
        )}
        {activeTab === 'friends' && (
          <FriendsTab inviteCode={inviteCode} feedToken={feedToken} connectedCount={connectedCount} connectedFriends={connectedFriends} accent={theme.accent} dark={theme.dark} onDisconnect={disconnectFriend} onFeedTokenChange={setFeedToken} />
        )}
        </div>
        </ErrorBoundary>
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
          onDeleteOccurrence={deleteOccurrence}
          reminderOn={isEventOn(modal.event.id)}
          onToggleReminder={() => toggleEventNotif(modal.event.id)}
        />
      )}
      {modal?.type === 'suggestion' && (
        <EventDetailModal
          event={modal.event}
          accent={theme.accent}
          onClose={() => setModal(null)}
          suggestion
          onPin={() => pinSuggestion(modal.raw)}
        />
      )}
    </div>
  )
}
