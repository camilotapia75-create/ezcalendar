export default function DayCell({ day, currentMonth, isToday, isWeekend, events, onClick, onEventClick }) {
  const hasEvents = events.length > 0
  const stackCount = Math.min(events.length, 3)

  return (
    <div
      onClick={onClick}
      className={[
        'relative min-h-[90px] md:min-h-[110px] flex flex-col transition-colors border-r border-b',
        currentMonth ? 'cursor-pointer' : 'pointer-events-none',
      ].join(' ')}
      style={{
        borderColor: '#f3f0ff',
        background: !currentMonth
          ? '#faf9ff'
          : isWeekend
          ? '#fdf8ff'
          : '#fff',
      }}
    >
      {/* Hover tint */}
      {currentMonth && (
        <div
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.03)' }}
        />
      )}

      {/* Day number */}
      <div className="p-1.5 md:p-2">
        <span
          className="inline-flex w-6 h-6 text-[11px] items-center justify-center rounded-full font-semibold"
          style={{
            background: isToday ? '#7c3aed' : 'transparent',
            color: isToday ? '#fff' : !currentMonth ? '#d8b4fe' : isWeekend ? '#7c3aed' : '#374151',
          }}
        >
          {day}
        </span>
      </div>

      {/* Stacked flyer thumbnails */}
      {hasEvents && (
        <div className="flex-1 px-1.5 pb-2 flex items-end">
          <button
            onClick={(e) => { e.stopPropagation(); onEventClick(events) }}
            className="relative w-full"
            style={{ height: stackCount > 1 ? 68 : 52 }}
          >
            {events.slice(0, 3).map((event, idx) => {
              const stackOffset = (stackCount - 1 - idx) * 6
              const rotate = idx === 0 ? -2 : idx === 1 ? 1 : 3
              return event.image_url ? (
                <img
                  key={event.id}
                  src={event.image_url}
                  alt={event.title || ''}
                  className="absolute left-0 right-0 w-full rounded-lg object-cover"
                  style={{
                    bottom: stackOffset,
                    height: 52,
                    transform: `rotate(${rotate}deg)`,
                    zIndex: idx + 1,
                    border: '2px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  }}
                />
              ) : (
                <div
                  key={event.id}
                  className="absolute left-0 right-0 w-full rounded-lg flex items-center px-2"
                  style={{
                    bottom: stackOffset,
                    height: 28,
                    transform: `rotate(${rotate}deg)`,
                    zIndex: idx + 1,
                    background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                    border: '1.5px solid #c4b5fd',
                    boxShadow: '0 2px 6px rgba(124,58,237,0.15)',
                  }}
                >
                  <p className="text-[9px] font-semibold truncate" style={{ color: '#5b21b6' }}>{event.title}</p>
                </div>
              )
            })}
            {events.length > 3 && (
              <div
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: '#7c3aed', zIndex: 10, boxShadow: '0 1px 4px rgba(124,58,237,0.4)' }}
              >
                +{events.length - 3}
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
