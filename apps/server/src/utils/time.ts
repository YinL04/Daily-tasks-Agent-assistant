export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function nextDayAt(hour: number, minute = 0, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function formatIcsDate(iso: string) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
