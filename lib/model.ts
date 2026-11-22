import seed from "./seed.json";
export const kinds = [
  "tracker",
  "log",
  "course",
  "module",
  "section",
  "student",
  "session",
  "submission",
  "project",
  "task",
  "milestone",
  "reward",
  "redemption",
  "inbox",
  "focus",
  "metric",
  "distraction",
  "category",
] as const;
export type Kind = (typeof kinds)[number];
export type Entry = {
  id: string;
  kind: Kind;
  title: string;
  ar?: string;
  detail?: string;
  arDetail?: string;
  type?: string;
  cadence?: string;
  target?: number;
  unit?: string;
  xp?: number;
  color?: string;
  category?: string;
  parent?: string;
  date?: string;
  value?: number;
  start?: number;
  end?: number;
  surah?: string;
  juz?: string;
  status?: string;
  columns?: string[];
  attendance?: Record<string, string>;
  archived?: boolean;
  link?: string;
};
export type Workspace = { version: number; entries: Entry[] };
export const initialEntries = seed as Entry[];
export const newEntry = (
  kind: Kind,
  title: string,
  fields: Partial<Entry> = {},
): Entry => ({ id: crypto.randomUUID(), kind, title, ...fields });
export function dayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function weekStart(day: string) {
  const date = new Date(day + "T12:00:00");
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dayKey(date);
}
export function trackerProgress(entries: Entry[], tracker: Entry, day: string) {
  const start = tracker.cadence === "weekly" ? weekStart(day) : day;
  return entries
    .filter(
      (entry) =>
        entry.kind === "log" &&
        entry.parent === tracker.id &&
        entry.date &&
        entry.date >= start &&
        entry.date <= day,
    )
    .reduce((sum, entry) => sum + (entry.value ?? 0), 0);
}
export function xpBalance(entries: Entry[]) {
  return entries.reduce((sum, entry) => sum + earnedXp(entry), 0);
}
export function earnedXp(entry: Entry) {
  return entry.kind === "log" ||
    entry.kind === "redemption" ||
    (entry.kind === "task" && entry.value === 0)
    ? (entry.xp ?? 0)
    : 0;
}
export function allocateTrackerXp(
  entries: Entry[],
  tracker: Entry,
  dates: (string | undefined)[],
) {
  const period = (date: string) =>
    tracker.cadence === "weekly" ? weekStart(date) : date;
  const affected = new Set(
    dates.filter((date): date is string => Boolean(date)).map(period),
  );
  const totals = new Map<string, number>();
  const awards = new Map<string, number>();
  entries
    .filter(
      (entry) =>
        entry.kind === "log" &&
        entry.parent === tracker.id &&
        entry.date &&
        affected.has(period(entry.date)),
    )
    .sort((a, b) => a.date!.localeCompare(b.date!))
    .forEach((entry) => {
      const key = period(entry.date!);
      const before = totals.get(key) ?? 0;
      const after = before + (entry.value ?? 0);
      const target = tracker.target ?? 1;
      awards.set(
        entry.id,
        before < target && after >= target ? (tracker.xp ?? 0) : 0,
      );
      totals.set(key, after);
    });
  return entries.map((entry) =>
    awards.has(entry.id) ? { ...entry, xp: awards.get(entry.id) } : entry,
  );
}
const strings = [
  "ar",
  "detail",
  "arDetail",
  "type",
  "cadence",
  "unit",
  "color",
  "category",
  "parent",
  "date",
  "surah",
  "juz",
  "status",
  "link",
] as const;
const numbers = ["target", "xp", "value", "start", "end"] as const;
export function validEntries(data: unknown): data is Entry[] {
  if (!Array.isArray(data) || data.length > 50000) return false;
  const ids = new Set<string>();
  return data.every((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id ||
      item.id.length > 150 ||
      ids.has(item.id) ||
      typeof item.title !== "string" ||
      item.title.length > 500 ||
      !kinds.includes(item.kind)
    )
      return false;
    ids.add(item.id);
    return (
      strings.every(
        (key) =>
          item[key] === undefined ||
          (typeof item[key] === "string" && item[key].length <= 60000),
      ) &&
      numbers.every(
        (key) =>
          item[key] === undefined ||
          (typeof item[key] === "number" &&
            Number.isFinite(item[key]) &&
            Math.abs(item[key]) <= 1e9),
      ) &&
      (item.archived === undefined || typeof item.archived === "boolean") &&
      (item.columns === undefined ||
        (Array.isArray(item.columns) &&
          item.columns.every((value: unknown) => typeof value === "string"))) &&
      (item.attendance === undefined ||
        (item.attendance &&
          typeof item.attendance === "object" &&
          !Array.isArray(item.attendance) &&
          Object.values(item.attendance).every(
            (value) => typeof value === "string",
          )))
    );
  });
}
