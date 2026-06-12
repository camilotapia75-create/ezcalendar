'use client'

export default function ScanBot({ raise = 0 }) {
  return (
    <div className="absolute inset-x-0 pointer-events-none" style={{ height: 58, bottom: 4 + raise }}>
      <div className="scanbot">
        <svg width="40" height="50" viewBox="0 0 40 50" overflow="visible">
          {/* antenna */}
          <line x1="20" y1="5" x2="20" y2="10" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
          <circle className="scanbot-antenna" cx="20" cy="3" r="2.5" fill="#c4b5fd" />
          {/* head — big and round */}
          <rect x="3" y="10" width="34" height="21" rx="10" fill="#7c3aed" />
          {/* left eye */}
          <circle cx="13" cy="20.5" r="5" fill="white" />
          <circle className="scanbot-eye" cx="13.5" cy="21" r="2.5" fill="#2e1065" />
          <circle cx="15.2" cy="19" r="1.2" fill="white" opacity="0.85" />
          {/* right eye */}
          <circle cx="27" cy="20.5" r="5" fill="white" />
          <circle className="scanbot-eye" cx="27.5" cy="21" r="2.5" fill="#2e1065" />
          <circle cx="29.2" cy="19" r="1.2" fill="white" opacity="0.85" />
          {/* blush */}
          <ellipse cx="6" cy="27" rx="2.5" ry="1.5" fill="#f9a8d4" opacity="0.6" />
          <ellipse cx="34" cy="27" rx="2.5" ry="1.5" fill="#f9a8d4" opacity="0.6" />
          {/* smile */}
          <path d="M 14 28.5 Q 20 33 26 28.5" stroke="#a78bfa" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          {/* body */}
          <rect x="11" y="32" width="18" height="12" rx="5" fill="#6d28d9" />
          <rect x="14" y="34.5" width="12" height="6" rx="2" fill="#a78bfa" opacity="0.6" />
          {/* left arm + magnifying glass */}
          <g className="scanbot-arm scanbot-arm-l">
            <rect x="-4" y="33" width="15" height="5" rx="2.5" fill="#5b21b6" />
            <circle cx="-7" cy="35.5" r="3.8" fill="none" stroke="#c4b5fd" strokeWidth="1.5" />
            <line x1="-4.5" y1="38.5" x2="-2" y2="41.5" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          {/* right arm + wrench */}
          <g className="scanbot-arm scanbot-arm-r">
            <rect x="29" y="33" width="15" height="5" rx="2.5" fill="#5b21b6" />
            <circle cx="46.5" cy="33.5" r="3" fill="none" stroke="#c4b5fd" strokeWidth="1.5" />
            <line x1="45.5" y1="36.5" x2="43.5" y2="40.5" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
          </g>
          {/* legs — short and stubby */}
          <rect className="scanbot-leg scanbot-leg-l" x="13" y="44" width="6" height="6" rx="3" fill="#5b21b6" />
          <rect className="scanbot-leg scanbot-leg-r" x="21" y="44" width="6" height="6" rx="3" fill="#5b21b6" />
        </svg>
      </div>
    </div>
  )
}
