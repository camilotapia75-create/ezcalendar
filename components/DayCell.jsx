export default function DayCell({ day, currentMonth, isToday, events, onClick, onEventClick }) {
  return (
    <div
      onClick={onClick}
      className={[
        'relative flex flex-col transition-colors rounded-xl p-1',
        currentMonth ? 'hover:bg-white/[0.03] cursor-pointer' : 'opacity-15 pointer-events-none',
      ].join(' ')}
      style={{ minHeight: 88 }}
    >
      <div className="flex items-center justify-center w-full pt-1 pb-0.5">
        <span className={[
          'w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-medium transition-colors',
          isToday ? 'text-white font-semibold' : 'text-white/30',
        ].join(' ')}
        style={isToday ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' } : {}}
        >
          {day}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 mt-0.5">
        {events.slice(0, 2).map(event => (
          <button
            key={event.id}
            onClick={e => { e.stopPropagation(); onEventClick(event) }}
            className="w-full rounded-lg overflow-hidden transition-opacity hover:opacity-80"
          >
            {event.image_url ? (
              <img
                src={event.image_url}
                alt={event.title || ''}
                className="w-full object-cover"
                style={{ aspectRatio: '3/2' }}
              />
            ) : (
              <div className="w-full px-1.5 py-1 rounded-lg text-left" style={{ background: 'rgba(124,58,237,0.12)' }}>
                <p className="text-[10px] text-violet-300/80 truncate leading-tight">{event.title}</p>
              </div>
            )}
          </button>
        ))}
        {events.length > 2 && (
          <p className="text-[9px] text-white/20 px-1">+{events.length - 2} more</p>
        )}
      </div>
    </div>
  )
}
