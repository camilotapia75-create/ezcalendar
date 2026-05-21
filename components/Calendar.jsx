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
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between py-5 px-1">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all text-lg"
        >
          &#8592;
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight">
            {MONTHS[month]}
            <span className="text-zinc-600 font-normal ml-2">{year}</span>
          </h2>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-[11px] text-zinc-600 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 rounded-md transition-all"
          >
            today
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all text-lg"
        >
          &#8594;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-t border-l border-zinc-900">
        {DAYS.map(d => (
          <div key={d} className="border-r border-b border-zinc-900 py-2 text-center text-[10px] font-semibold text-zinc-700 tracking-widest">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border-l border-zinc-900">
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
