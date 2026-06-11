'use client'

// Cute robot that runs back and forth "collecting data" while the AI reads.
// Pure CSS/SVG — no assets, no libraries; animations live in globals.css.
export default function ScanBot({ raise = 0 }) {
  return (
    <div className="absolute inset-x-0 pointer-events-none" style={{ height: 48, bottom: 4 + raise }}>
      {/* data bits popping up along the robot's path */}
      {[10, 30, 52, 72, 88].map((pct, i) => (
        <span key={i} className="scanbot-bit" style={{ left: `${pct}%`, animationDelay: `${i * 0.5}s` }}>
          {i % 2 ? '1' : '0'}
        </span>
      ))}
      <div className="scanbot">
        <svg width="38" height="42" viewBox="0 0 38 42">
          {/* antenna */}
          <line x1="19" y1="6" x2="19" y2="11" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
          <circle className="scanbot-antenna" cx="19" cy="4.5" r="2.6" fill="#c4b5fd" />
          {/* head */}
          <rect x="9" y="10" width="20" height="13" rx="4.5" fill="#7c3aed" />
          <circle className="scanbot-eye" cx="15" cy="16.5" r="2.3" fill="#fff" />
          <circle className="scanbot-eye" cx="23" cy="16.5" r="2.3" fill="#fff" />
          {/* body */}
          <rect x="11" y="24" width="16" height="10" rx="3.5" fill="#6d28d9" />
          <rect x="14.5" y="26.5" width="9" height="4.5" rx="1.5" fill="#a78bfa" opacity="0.75" />
          {/* legs */}
          <rect className="scanbot-leg scanbot-leg-l" x="13" y="34" width="3.8" height="7" rx="1.8" fill="#5b21b6" />
          <rect className="scanbot-leg scanbot-leg-r" x="21" y="34" width="3.8" height="7" rx="1.8" fill="#5b21b6" />
        </svg>
      </div>
    </div>
  )
}
