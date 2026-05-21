import DayCell from './DayCell'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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
    const key = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
    return events.filter(e => e.date === key)
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-5">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/5 text-white/40 hover:text-white/80"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold tracking-tight">
            {MONTHS[month]} <span className="text-white/30 font-normal">{year}</span>
          </h2>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-[11px] font-medium text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 px-2.5 py-1 rounded-lg transition-all"
          >today</button>
        </div>

        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/5 text-white/40 hover:text-white/80"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 px-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-medium text-white/20 tracking-wide">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 px-2">
        {cells.map((cell, i) => (
          <DayCell
            key={i}
            day={cell.day}
            currentMonth={cell.current}
            isToday={isToday(cell.date)}
            events={eventsForDate(cell.date)}
            onClick={() => cell.current && onDayClick(cell.date)}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  )
}
