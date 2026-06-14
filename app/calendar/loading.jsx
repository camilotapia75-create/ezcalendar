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
        backgroundColor: '#fef9f2',
        backgroundImage: [
          'linear-gradient(160deg, #fef9f2 0%, #fff5e8 55%, #fef2f8 100%)',
          'repeating-linear-gradient(transparent 0px, transparent 27px, rgba(180,140,100,0.07) 28px)',
        ].join(', '),
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-1px' }}>
        📌 ezcalendar
      </div>
      <div
        style={{
          width: 34, height: 34, borderRadius: '50%',
          border: '3px solid rgba(124,58,237,0.18)',
          borderTopColor: '#7c3aed',
          animation: 'calLoadSpin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes calLoadSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
