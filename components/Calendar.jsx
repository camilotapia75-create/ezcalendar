import DayCell from './DayCell'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const CORK_BG = {
  backgroundColor: '#c49a6c',
  backgroundImage: [
    'repeating-linear-gradient(112deg, rgba(100,55,10,0.08) 0px, rgba(100,55,10,0.08) 1px, transparent 1px, transparent 9px)',
    'repeating-linear-gradient(22deg, rgba(155,95,25,0.06) 0px, rgba(155,95,25,0.06) 1px, transparent 1px, transparent 11px)',
    'radial-gradient(ellipse 14% 9% at 7% 14%, rgba(85,40,5,0.30) 0%, transparent 100%)',
    'radial-gradient(ellipse 9% 15% at 35% 70%, rgba(85,40,5,0.24) 0%, transparent 100%)',
    'radial-gradient(ellipse 16% 8% at 62% 32%, rgba(85,40,5,0.26) 0%, transparent 100%)',
    'radial-gradient(ellipse 11% 13% at 18% 82%, rgba(125,75,15,0.20) 0%, transparent 100%)',
    'radial-gradient(ellipse 17% 7% at 50% 6%, rgba(85,40,5,0.22) 0%, transparent 100%)',
    'radial-gradient(ellipse 8% 16% at 85% 72%, rgba(85,40,5,0.26) 0%, transparent 100%)',
  ].join(', '),
}

export default function Calendar({ currentDate, setCurrentDate, events, onDayClick, onEventClick, theme }) {
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

  const eventsForDate = (date) => {
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
    return events.filter(e => e.date === key)
  }

  const accent = theme?.accent || '#7c3aed'

  return (
    <div style={{
      borderRadius: '18px',
      overflow: 'hidden',
      boxShadow: '0 12px 48px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,220,150,0.2)',
      border: '10px solid #6b4510',
      outline: '2px solid #3d2408',
      ...CORK_BG,
    }}>

      {/* Month nav */}
      <div
        className="flex items-center justify-between py-4 px-5"
        style={{ background: '#6b4510', borderBottom: '4px solid #111' }}
      >
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all text-2xl hover:bg-black/15"
          style={{ color: '#f5e0b0' }}
        >
          &#8249;
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold tracking-tight" style={{ color: '#f5e0b0' }}>
            {MONTHS[month]}
            <span className="font-normal ml-2" style={{ color: '#c8a870' }}>{year}</span>
          </h2>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-[11px] px-3 py-1 rounded-full font-semibold transition-all hover:bg-black/15"
            style={{ color: '#f5e0b0', border: '1px solid rgba(245,224,176,0.35)' }}
          >
            today
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all text-2xl hover:bg-black/15"
          style={{ color: '#f5e0b0' }}
        >
          &#8250;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7" style={{ background: '#7a520f', borderBottom: '4px solid #111' }}>
        {DAYS.map((d, i) => (
          <div
            key={d}
            className="py-2.5 text-center text-[10px] font-bold tracking-widest"
            style={{ color: i === 0 || i === 6 ? '#ffd090' : '#c8a870' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7" style={{ borderLeft: '3px solid #111' }}>
        {cells.map((cell, i) => (
          <DayCell
            key={i}
            day={cell.day}
            currentMonth={cell.current}
            isToday={isToday(cell.date)}
            isWeekend={cell.date.getDay() === 0 || cell.date.getDay() === 6}
            events={eventsForDate(cell.date)}
            onClick={() => cell.current && onDayClick(cell.date)}
            onEventClick={() => cell.current && onEventClick(cell.date)}
            theme={theme}
          />
        ))}
      </div>
    </div>
  )
}
