import { useState } from "react";
import type { CalendarEvent } from "../lib/api";

const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const start = startOfWeek(events[0] ? new Date(events[0].start) : new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });

  return (
    <section className="panel">
      <h2>周日历</h2>
      <div className="calendar-grid">
        {days.map((day) => {
          const dayEvents = events.filter((event) => new Date(event.start).toDateString() === day.toDateString());
          return (
            <div className="day-column" key={day.toISOString()}>
              <div className="day-head">{dayNames[day.getDay()]} <span>{day.getMonth() + 1}/{day.getDate()}</span></div>
              {dayEvents.map((event) => (
                <button className={`event ${event.priority}`} key={event.id} onClick={() => setSelected(event)}>
                  <span>{new Date(event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {event.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="detail-strip">
          <strong>{selected.title}</strong>
          <span>{new Date(selected.start).toLocaleString()} - {new Date(selected.end).toLocaleTimeString()}</span>
          <p>{selected.description}</p>
        </div>
      )}
    </section>
  );
}
