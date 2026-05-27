import DayCell from './DayCell'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

export default function Calendar({ currentDate, setCurrentDate, events, onDayClick, onEventClick, theme, pinStyle, notes = {} }) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells = []
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: daysInPrevMonth - i, current: false, date: new Date(year, month - 1, daysInPrevMonth - i) })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, current: true, date: new Date(year, month, d) })
  for (let d = 1; d <= 42 - cells.length; d++)
    cells.push({ day: d, current: false, date: new Date(year, month + 1, d) })

  const today = new Date()
  const isToday = (date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  const dateKey = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  const eventsForDate = (date) => events.filter(e => e.date === dateKey(date))

  const accent = theme?.accent || '#7c3aed'

  return (
    <div style={{
      borderRadius: 6,
      overflow: 'hidden',
      border: '3px solid #111',
      boxShadow: '5px 5px 0 rgba(0,0,0,0.30)',
    }}>

      {/* Big month header */}
      <div style={{ background: '#faf7f2', borderBottom: '3px solid #111', padding: '12px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', lineHeight: 1 }}>
          <div style={{
            fontSize: 'clamp(48px, 13vw, 80px)',
            fontWeight: 900,
            letterSpacing: '-4px',
            color: accent,
            fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
            lineHeight: 0.88,
          }}>
            {ABBR[month]}
          </div>
          <div style={{
            fontSize: 'clamp(40px, 11vw, 68px)',
            fontWeight: 900,
            letterSpacing: '-3px',
            color: `${accent}28`,
            fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
            lineHeight: 0.88,
          }}>
            {String(month + 1).padStart(2, '0')}
          </div>
        </div>

        {/* Nav row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 12px' }}>
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            style={{ background: 'none', border: `1.5px solid ${accent}66`, borderRadius: 5, cursor: 'pointer', color: accent, width: 30, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}
          >
            ‹
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, color: '#6b7280' }}>{MONTHS[month]} {year}</span>
            <button
              onClick={() => setCurrentDate(new Date())}
              style={{ fontSize: 14, padding: '2px 10px', borderRadius: 20, background: 'none', border: `1.5px solid ${accent}55`, color: accent, cursor: 'pointer' }}
            >
              today
            </button>
          </div>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            style={{ background: 'none', border: `1.5px solid ${accent}66`, borderRadius: 5, cursor: 'pointer', color: accent, width: 30, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7" style={{ background: accent, borderBottom: '3px solid #111' }}>
        {DAYS.map((d, i) => (
          <div
            key={d}
            className="py-2 text-center"
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: i === 0 || i === 6 ? 'rgba(255,255,255,0.65)' : '#fff',
              fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid — graph paper background */}
      <div
        className="grid grid-cols-7"
        style={{
          borderLeft: '2px solid #111',
          backgroundImage: [
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.045) 0px, rgba(0,0,0,0.045) 1px, transparent 1px, transparent 24px)',
            'repeating-linear-gradient(90deg, rgba(0,0,0,0.035) 0px, rgba(0,0,0,0.035) 1px, transparent 1px, transparent 24px)',
            'linear-gradient(#faf7f2, #faf7f2)',
          ].join(', '),
        }}
      >
        {cells.map((cell, i) => (
          <DayCell
            key={i}
            day={cell.day}
            currentMonth={cell.current}
            isToday={isToday(cell.date)}
            isWeekend={cell.date.getDay() === 0 || cell.date.getDay() === 6}
            events={eventsForDate(cell.date)}
            hasNote={(notes[dateKey(cell.date)]?.length > 0)}
            onClick={() => cell.current && onDayClick(cell.date)}
            onEventClick={() => cell.current && onEventClick(cell.date)}
            theme={theme}
            pinStyle={pinStyle}
          />
        ))}
      </div>
    </div>
  )
}
