// Streamed instantly while the server component awaits auth + data, so a
// home-screen PWA shows a branded shell immediately instead of a blank screen.
import Wordmark from '@/components/Wordmark'

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
      <Wordmark size={30} color="#fff" pin />
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
