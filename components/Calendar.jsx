import DayCell from './DayCell'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function Calendar({ currentDate, setCurrentDate, events, onDayClick, onEventClick, theme, notes = {} }) {
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

  const eventsForDate = (date) => {
    const key = dateKey(date)
    return events.filter(e => e.end_date ? e.date <= key && e.end_date >= key : e.date === key)
  }

  // Count distinct events that fall inside this month
  const monthEventCount = events.filter(e => {
    const [y, m] = e.date.split('-').map(Number)
    return y === year && m === month + 1
  }).length

  return (
    <div>
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '4px 4px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="mono-label" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>‹</button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1, margin: 0 }}>
            {MONTHS[month]}
          </h1>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="mono-label" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>›</button>
        </div>
        <span className="mono-label" style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.12em', paddingBottom: 4 }}>
          {year} · {monthEventCount} EVENT{monthEventCount === 1 ? '' : 'S'}
        </span>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, marginBottom: 8 }}>
        {DOW.map((d, i) => (
          <div key={i} className="mono-label" style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{d}</div>
        ))}
      </div>

      {/* Grid of rounded cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
        {cells.map((cell, i) => (
          <DayCell
            key={i}
            day={cell.day}
            currentMonth={cell.current}
            isToday={isToday(cell.date)}
            events={eventsForDate(cell.date)}
            hasNote={(notes[dateKey(cell.date)]?.length > 0)}
            onClick={() => cell.current && onDayClick(cell.date)}
            theme={theme}
          />
        ))}
      </div>

      <p className="mono-label" style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.14em', marginTop: 22 }}>
        TAP ANY DAY TO SEE THE FLYER
      </p>
    </div>
  )
}
