// Streamed instantly while the server component awaits auth + data, so a
// home-screen PWA shows a branded shell immediately instead of a blank screen.
export default function CalendarLoading() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        backgroundColor: '#0a0a0b',
        backgroundImage: 'radial-gradient(120% 55% at 50% -5%, #14170e 0%, #0a0a0b 55%)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontSize: 30, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
        📌 ezcalendar
      </div>
      <div
        style={{
          width: 34, height: 34, borderRadius: '50%',
          border: '3px solid rgba(198,242,78,0.2)',
          borderTopColor: '#c6f24e',
          animation: 'calLoadSpin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes calLoadSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
