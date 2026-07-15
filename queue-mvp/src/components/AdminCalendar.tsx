import { getCalendarDays } from '../lib/slotUtils';

interface Props {
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  bookingCounts: Record<string, number>;
  pastDays?: number;
  futureDays?: number;
}

export default function AdminCalendar({
  selectedDate,
  onSelectDate,
  bookingCounts,
  pastDays = 14,
  futureDays = 14,
}: Props) {
  const days = getCalendarDays(pastDays, futureDays);
  const monthLabel = days.length
    ? new Date(days[0].iso + 'T12:00:00').toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="rounded-2xl bg-white p-4 card-shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Calendar</h2>
        <span className="text-[10px] text-slate-400">{monthLabel} ±{pastDays}d</span>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[9px] font-semibold uppercase text-slate-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: days[0] ? new Date(days[0].iso + 'T12:00:00').getDay() : 0 }).map(
          (_, i) => (
            <div key={`pad-${i}`} />
          ),
        )}
        {days.map((d) => {
          const count = bookingCounts[d.iso] ?? 0;
          const selected = selectedDate === d.iso;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => onSelectDate(d.iso)}
              title={d.label}
              className={`relative flex flex-col items-center rounded-xl py-1.5 transition ${
                selected
                  ? 'bg-primary text-white shadow-md'
                  : d.isToday
                    ? 'border-2 border-primary/40 bg-primary-light text-primary'
                    : d.isPast
                      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="text-sm font-bold">{d.day}</span>
              {count > 0 && (
                <span
                  className={`mt-0.5 rounded-full px-1 text-[8px] font-bold ${
                    selected
                      ? 'bg-white/25 text-white'
                      : d.isPast
                        ? 'bg-slate-300 text-slate-700'
                        : 'bg-primary/15 text-primary'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        Past dates show booking history
      </p>
    </div>
  );
}
