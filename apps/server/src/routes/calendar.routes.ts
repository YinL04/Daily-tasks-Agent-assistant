import { Router } from "express";
import { z } from "zod";
import { CalendarStore } from "../storage/calendarStore.js";
import { formatIcsDate } from "../utils/time.js";

const router = Router();
const store = new CalendarStore();

const calendarEventBaseSchema = z.object({
  taskId: z.string().optional(),
  title: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  description: z.string().default("")
});

const calendarEventSchema = calendarEventBaseSchema.refine(
  (value) => {
    return new Date(value.end).getTime() > new Date(value.start).getTime();
  },
  {
    message: "End time must be after start time",
    path: ["end"]
  }
);

const calendarEventPatchSchema = calendarEventBaseSchema.partial().refine(
  (value) => {
    if (!value.start || !value.end) return true;
    return new Date(value.end).getTime() > new Date(value.start).getTime();
  },
  {
    message: "End time must be after start time",
    path: ["end"]
  }
);

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildIcs(events: Awaited<ReturnType<CalendarStore["list"]>>) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Agent Planner//CN",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.id}@personal-agent-planner`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(event.start)}`,
      `DTEND:${formatIcsDate(event.end)}`,
      `SUMMARY:${icsEscape(event.title)}`,
      `DESCRIPTION:${icsEscape(event.description || "")}`,
      "END:VEVENT"
    ]),
    "END:VCALENDAR"
  ].join("\r\n");
}

function parseIcsDate(value: string) {
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    return new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
    ).toISOString();
  }
  if (/^\d{8}T\d{6}$/.test(value)) {
    return new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`
    ).toISOString();
  }
  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T09:00:00`).toISOString();
  }
  return new Date(value).toISOString();
}

function parseIcs(ics: string) {
  const blocks = ics
    .split(/BEGIN:VEVENT/i)
    .slice(1)
    .map((block) => block.split(/END:VEVENT/i)[0]);
  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const get = (name: string) => {
      const line = lines.find((item) => item.toUpperCase().startsWith(name));
      return line
        ?.slice(line.indexOf(":") + 1)
        .replace(/\\n/g, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .trim();
    };
    const title = get("SUMMARY") || "导入日程";
    const start = parseIcsDate(get("DTSTART") || new Date().toISOString());
    const endRaw = get("DTEND");
    const end = endRaw ? parseIcsDate(endRaw) : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    return {
      id: "",
      taskId: "imported",
      title,
      start,
      end,
      priority: "medium" as const,
      description: get("DESCRIPTION") || "",
      source: "manual" as const
    };
  });
}

router.get("/", async (_req, res, next) => {
  try {
    res.json(await store.list());
  } catch (error) {
    next(error);
  }
});

router.get("/export.ics", async (_req, res, next) => {
  try {
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="personal-agent-calendar.ics"');
    res.send(buildIcs(await store.list()));
  } catch (error) {
    next(error);
  }
});

router.post("/import", async (req, res, next) => {
  try {
    const { ics } = z.object({ ics: z.string().min(1) }).parse(req.body);
    const imported = [];
    for (const event of parseIcs(ics)) {
      if (new Date(event.end).getTime() > new Date(event.start).getTime()) {
        imported.push(await store.create(event));
      }
    }
    res.status(201).json({ imported, count: imported.length });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = calendarEventSchema.parse(req.body);
    res.status(201).json(
      await store.create({
        id: "",
        taskId: body.taskId || "manual",
        title: body.title,
        start: body.start,
        end: body.end,
        priority: body.priority,
        description: body.description,
        source: "manual"
      })
    );
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const updated = await store.update(req.params.id, calendarEventPatchSchema.parse(req.body));
    if (!updated) return res.status(404).json({ error: "Calendar event not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await store.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Calendar event not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
