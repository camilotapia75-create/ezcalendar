'use client'

// Clock, compass, and map icons — what the robot is collecting:
// time, location, and date.
const ClockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="9" fill="rgba(109,40,217,0.45)" stroke="#c4b5fd" strokeWidth="1.6"/>
    <line x1="11" y1="11" x2="11" y2="5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
    <line x1="11" y1="11" x2="15" y2="13.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="11" cy="11" r="1.2" fill="#c4b5fd"/>
  </svg>
)

const CompassIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="9" fill="rgba(109,40,217,0.45)" stroke="#c4b5fd" strokeWidth="1.6"/>
    <polygon points="11,3 13.2,11 11,9 8.8,11" fill="white"/>
    <polygon points="11,19 13.2,11 11,13 8.8,11" fill="#a78bfa"/>
    <circle cx="11" cy="11" r="1.3" fill="#c4b5fd"/>
  </svg>
)

const MapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M3 6 L8 4 L14 6 L19 4 L19 17 L14 19 L8 17 L3 19 Z"
          fill="rgba(109,40,217,0.45)" stroke="#c4b5fd" strokeWidth="1.3" strokeLinejoin="round"/>
    <line x1="8"  y1="4"  x2="8"  y2="17" stroke="#c4b5fd" strokeWidth="1" opacity="0.65"/>
    <line x1="14" y1="6"  x2="14" y2="19" stroke="#c4b5fd" strokeWidth="1" opacity="0.65"/>
  </svg>
)

export default function ScanBot({ raise = 0 }) {
  return (
    <div className="absolute inset-x-0 pointer-events-none" style={{ height: 56, bottom: 4 + raise }}>
      {/* collectibles — each appears at the wall just after the robot exits off-screen,
          then pops off when the robot runs back through and grabs it */}
      <span className="scanbot-item scanbot-item-clock"   style={{ position: 'absolute', bottom: 40, right: '4%' }}><ClockIcon /></span>
      <span className="scanbot-item scanbot-item-compass" style={{ position: 'absolute', bottom: 40, left:  '4%' }}><CompassIcon /></span>
      <span className="scanbot-item scanbot-item-map"     style={{ position: 'absolute', bottom: 40, right: '4%' }}><MapIcon /></span>

      <div className="scanbot">
        <svg width="38" height="44" viewBox="0 0 38 44" overflow="visible">
          {/* antenna */}
          <line x1="19" y1="5" x2="19" y2="10" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
          <circle className="scanbot-antenna" cx="19" cy="3" r="2.2" fill="#c4b5fd"/>
          {/* head */}
          <rect x="6" y="9" width="26" height="17" rx="7" fill="#7c3aed"/>
          {/* left eye */}
          <circle cx="13.5" cy="17.5" r="3.3" fill="white"/>
          <circle className="scanbot-eye" cx="14" cy="18" r="1.7" fill="#2e1065"/>
          <circle cx="15.3" cy="16.4" r="1.1" fill="white" opacity="0.9"/>
          {/* right eye */}
          <circle cx="24.5" cy="17.5" r="3.3" fill="white"/>
          <circle className="scanbot-eye" cx="25" cy="18" r="1.7" fill="#2e1065"/>
          <circle cx="26.3" cy="16.4" r="1.1" fill="white" opacity="0.9"/>
          {/* smile */}
          <path d="M 13 23 Q 19 27.5 25 23" stroke="#a78bfa" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
          {/* body */}
          <rect x="9" y="27" width="20" height="11" rx="4.5" fill="#6d28d9"/>
          <rect x="12" y="29" width="14" height="6"  rx="2"   fill="#a78bfa" opacity="0.65"/>
          {/* legs */}
          <rect className="scanbot-leg scanbot-leg-l" x="11" y="38" width="5" height="6" rx="2.5" fill="#5b21b6"/>
          <rect className="scanbot-leg scanbot-leg-r" x="22" y="38" width="5" height="6" rx="2.5" fill="#5b21b6"/>
        </svg>
      </div>
    </div>
  )
}
