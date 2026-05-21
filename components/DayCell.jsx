export default function DayCell({ day, currentMonth, isToday, events, onClick, onEventClick }) {
  return (
    <div
      onClick={onClick}
      className={[
        'min-h-[110px] md:min-h-[130px] rounded-xl p-2 transition-all group',
        currentMonth
          ? 'bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/20 cursor-pointer'
          : 'opacity-20 cursor-default',
      ].join(' ')}
    >
      <div className={[
        'text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full mb-1.5',
        isToday ? 'bg-indigo-500 text-white' : 'text-gray-500 group-hover:text-gray-300',
      ].join(' ')}>
        {day}
      </div>

      <div className="space-y-1">
        {events.slice(0, 2).map((event) => (
          <button
            key={event.id}
            onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
            className="w-full text-left block"
          >
            {event.image_url ? (
              <img
                src={event.image_url}
                alt={event.title || 'flyer'}
                className="w-full h-14 md:h-16 object-cover rounded-lg hover:opacity-80 transition-opacity ring-1 ring-white/10"
              />
            ) : (
              <div className="w-full h-8 bg-indigo-500/20 rounded-lg flex items-center px-2 hover:bg-indigo-500/30 transition-colors">
                <span className="text-xs text-indigo-300 truncate">{event.title}</span>
              </div>
            )}
          </button>
        ))}
        {events.length > 2 && (
          <p className="text-[10px] text-gray-600 pl-0.5">+{events.length - 2} more</p>
        )}
        {currentMonth && events.length === 0 && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center h-10">
            <span className="text-[10px] text-gray-600">+ pin flyer</span>
          </div>
        )}
      </div>
    </div>
  )
}
