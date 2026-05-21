export default function DayCell({ day, currentMonth, isToday, events, onClick, onEventClick }) {
  return (
    <div
      onClick={onClick}
      className={[
        'border-r border-b border-zinc-900 min-h-[100px] md:min-h-[120px] flex flex-col transition-colors',
        currentMonth
          ? 'hover:bg-white/[0.025] cursor-pointer'
          : 'opacity-20 pointer-events-none',
      ].join(' ')}
    >
      {/* Day number */}
      <div className="p-1.5 md:p-2">
        <span className={[
          'inline-flex w-5 h-5 md:w-6 md:h-6 text-[11px] items-center justify-center rounded-full font-medium',
          isToday
            ? 'bg-violet-600 text-white'
            : 'text-zinc-600',
        ].join(' ')}>
          {day}
        </span>
      </div>

      {/* Flyer thumbnails */}
      <div className="flex-1 px-1 pb-1 space-y-0.5 overflow-hidden">
        {events.slice(0, 2).map((event) => (
          <button
            key={event.id}
            onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
            className="w-full block group/thumb"
          >
            {event.image_url ? (
              <img
                src={event.image_url}
                alt={event.title || ''}
                className="w-full rounded object-cover group-hover/thumb:opacity-80 transition-opacity"
                style={{ aspectRatio: '4/3' }}
              />
            ) : (
              <div className="w-full px-1.5 py-1 rounded bg-violet-500/15 hover:bg-violet-500/25 transition-colors">
                <p className="text-[10px] text-violet-300 truncate text-left">{event.title}</p>
              </div>
            )}
          </button>
        ))}
        {events.length > 2 && (
          <p className="text-[9px] text-zinc-700 px-1">+{events.length - 2}</p>
        )}
      </div>
    </div>
  )
}
