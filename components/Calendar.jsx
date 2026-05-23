import DayCell from './DayCell'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function Calendar({ currentDate, setCurrentDate, events, onDayClick, onEventClick }) {
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

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 4px 24px rgba(124,58,237,0.10)', border: '1px solid #ede9fe' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between py-4 px-5" style={{ background: '#fff', borderBottom: '1px solid #f3f0ff' }}>
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all text-xl font-light hover:bg-violet-50"
          style={{ color: '#7c3aed' }}
        >
          &#8249;
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold tracking-tight" style={{ color: '#1a1a2e' }}>
            {MONTHS[month]}
            <span className="font-normal ml-2" style={{ color: '#a78bfa' }}>{year}</span>
          </h2>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-[11px] px-3 py-1 rounded-full font-semibold transition-all hover:bg-violet-100"
            style={{ color: '#7c3aed', background: '#f3f0ff', border: '1px solid #ddd6fe' }}
          >
            today
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all text-xl font-light hover:bg-violet-50"
          style={{ color: '#7c3aed' }}
        >
          &#8250;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7" style={{ background: '#faf8ff', borderBottom: '1px solid #f3f0ff' }}>
        {DAYS.map((d, i) => (
          <div key={d} className="py-2.5 text-center text-[10px] font-bold tracking-widest"
            style={{ color: i === 0 || i === 6 ? '#7c3aed' : '#c4b5fd' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => (
          <DayCell
            key={i}
            day={cell.day}
            currentMonth={cell.current}
            isToday={isToday(cell.date)}
            isWeekend={cell.date.getDay() === 0 || cell.date.getDay() === 6}
            events={eventsForDate(cell.date)}
            onClick={() => cell.current && onDayClick(cell.date)}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  )
}
