import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Save, Trash2, X } from "lucide-react";
import { calendarApi, type CalendarEvent, type Priority, type StoredCalendarEvent } from "../lib/api";

const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

type DraftEvent = {
  id?: string;
  title: string;
  start: string;
  end: string;
  priority: Priority;
  description: string;
};

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateTimeInput(date: Date | string) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string) {
  return new Date(value).toISOString();
}

function emptyDraft(day = new Date()): DraftEvent {
  const start = new Date(day);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return {
    title: "",
    start: toDateTimeInput(start),
    end: toDateTimeInput(end),
    priority: "medium",
    description: ""
  };
}

type DisplayCalendarEvent = CalendarEvent & Partial<Pick<StoredCalendarEvent, "source" | "sourceRunId" | "createdAt" | "updatedAt">>;

export default function CalendarView({ refreshKey, events: snapshotEvents }: { refreshKey?: string; events?: CalendarEvent[] }) {
  const readOnly = Boolean(snapshotEvents);
  const [events, setEvents] = useState<DisplayCalendarEvent[]>(snapshotEvents ?? []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [error, setError] = useState("");

  async function load() {
    if (snapshotEvents) {
      setEvents(snapshotEvents);
      return;
    }
    setEvents(await calendarApi.list());
  }

  useEffect(() => {
    void load();
  }, [refreshKey, snapshotEvents]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  }), [weekStart]);

  function shiftWeek(delta: number) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
  }

  function createOn(day: Date) {
    if (readOnly) return;
    setError("");
    setDraft(emptyDraft(day));
  }

  function edit(event: DisplayCalendarEvent) {
    if (readOnly) return;
    setError("");
    setDraft({
      id: event.id,
      title: event.title,
      start: toDateTimeInput(event.start),
      end: toDateTimeInput(event.end),
      priority: event.priority,
      description: event.description
    });
  }

  async function save() {
    if (!draft) return;
    setError("");
    try {
      const payload = {
        title: draft.title.trim(),
        start: fromDateTimeInput(draft.start),
        end: fromDateTimeInput(draft.end),
        priority: draft.priority,
        description: draft.description.trim()
      };
      if (!payload.title) throw new Error("请填写标题");
      if (draft.id) {
        await calendarApi.update(draft.id, payload);
      } else {
        await calendarApi.create(payload);
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await calendarApi.delete(id);
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <section className="panel calendar-panel">
      <div className="calendar-toolbar">
        <div>
          <h2>日历</h2>
          <p>{readOnly ? "这是该次运行生成的日历快照。" : "Agent 生成的安排会自动保存到这里，也可以手动调整。"}</p>
        </div>
        <div className="calendar-actions">
          <button className="icon-button" onClick={() => shiftWeek(-1)} title="上一周"><ChevronLeft size={18} /></button>
          <button className="today-button" onClick={() => setWeekStart(startOfWeek(new Date()))}>本周</button>
          <button className="icon-button" onClick={() => shiftWeek(1)} title="下一周"><ChevronRight size={18} /></button>
          {!readOnly && <button className="primary-button compact" onClick={() => createOn(new Date())}><CalendarPlus size={17} /> 新增</button>}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="calendar-grid">
        {days.map((day) => {
          const dayEvents = events.filter((event) => new Date(event.start).toDateString() === day.toDateString());
          return (
            <div className="day-column" key={day.toISOString()}>
              <div className="day-head">
                <span>{dayNames[day.getDay()]}</span>
                {readOnly
                  ? <span className="day-date">{day.getMonth() + 1}/{day.getDate()}</span>
                  : <button onClick={() => createOn(day)} title="添加到这一天">{day.getMonth() + 1}/{day.getDate()}</button>}
              </div>
              {dayEvents.length === 0 && <div className="empty-day">暂无安排</div>}
              {dayEvents.map((event) => (
                <button className={`event ${event.priority}`} key={event.id} onClick={() => edit(event)} disabled={readOnly}>
                  <span>{new Date(event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <strong>{event.title}</strong>
                  <small>{event.source === "agent" || readOnly ? "Agent" : "手动"}</small>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {draft && (
        <div className="calendar-editor">
          <div className="editor-head">
            <h3>{draft.id ? "编辑安排" : "新增安排"}</h3>
            <button className="icon-button" onClick={() => setDraft(null)} title="关闭"><X size={16} /></button>
          </div>
          <div className="editor-grid">
            <label>
              标题
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label>
              优先级
              <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label>
              开始
              <input type="datetime-local" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} />
            </label>
            <label>
              结束
              <input type="datetime-local" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} />
            </label>
            <label className="wide-field">
              说明
              <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </label>
          </div>
          <div className="editor-actions">
            {draft.id && <button className="danger-button" onClick={() => remove(draft.id!)}><Trash2 size={16} /> 删除</button>}
            <button className="primary-button compact" onClick={save}><Save size={16} /> 保存</button>
          </div>
        </div>
      )}
    </section>
  );
}
