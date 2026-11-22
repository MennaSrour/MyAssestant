"use client";
import { useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Code2,
  Gift,
  GraduationCap,
  Inbox,
  Plus,
  Upload,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseCsv } from "@/lib/backup";
import {
  dayKey,
  earnedXp,
  newEntry,
  xpBalance,
  type Entry,
  type Kind,
} from "@/lib/model";
import type { Translate } from "./editor";
import { Button } from "./ui/button";

type Props = {
  page: string;
  entries: Entry[];
  allEntries: Entry[];
  today: string;
  balance: number;
  t: Translate;
  label: (entry: Entry) => string;
  change: (update: (entries: Entry[]) => Entry[]) => Promise<boolean>;
  open: (kind: Kind, fields?: Partial<Entry>) => void;
  edit: (entry: Entry) => void;
  remove: (entry: Entry) => void;
  focusCard: React.ReactNode;
  notify: (message: string) => void;
};

export function WorkspacePanel({
  page,
  entries,
  allEntries,
  today,
  balance,
  t,
  label,
  change,
  open,
  edit,
  remove,
  focusCard,
  notify,
}: Props) {
  const [selection, setSelection] = useState("");
  const [studentId, setStudentId] = useState("");
  const [destination, setDestination] = useState<Record<string, string>>({});
  const rosterFile = useRef<HTMLInputElement>(null);
  const byKind = (kind: Kind, parent?: string) =>
    entries.filter(
      (e) => e.kind === kind && (parent === undefined || e.parent === parent),
    );
  const add = (kind: Kind, text: string, fields?: Partial<Entry>) => (
    <Button className="secondary" onClick={() => open(kind, fields)}>
      <Plus size={16} />
      {text}
    </Button>
  );
  const editButton = (entry: Entry) => (
    <button className="text-button" onClick={() => edit(entry)}>
      {t("Edit", "تعديل")}
    </button>
  );
  const empty = (text: string) => <p className="empty">{text}</p>;
  const notes = (entry: Entry) => (
    <>
      {entry.detail && (
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {entry.detail}
          </ReactMarkdown>
        </div>
      )}
      {entry.link && /^https?:\/\//i.test(entry.link) && (
        <a
          className="text-button"
          href={entry.link}
          target="_blank"
          rel="noreferrer"
        >
          {t("Open link", "فتح الرابط")}
        </a>
      )}
    </>
  );
  const list = (kind: Kind, parent: string) =>
    byKind(kind, parent).map((entry) => (
      <div className="record" key={entry.id}>
        <div>
          <strong>{label(entry)}</strong>
          {entry.date && <small className="record-meta">{entry.date}</small>}
          {notes(entry)}
        </div>
        <div className="record-actions">{editButton(entry)}</div>
      </div>
    ));
  const group =
    page === "Academic Hub"
      ? "course"
      : page === "TA Workspace"
        ? "section"
        : page === "Dev Projects"
          ? "project"
          : undefined;
  const groups = group ? byKind(group) : [];
  const selected = groups.find((e) => e.id === selection) ?? groups[0];
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today + "T12:00:00");
    date.setDate(date.getDate() - 6 + index);
    return dayKey(date);
  });

  if (group) {
    const Icon =
      group === "course"
        ? GraduationCap
        : group === "section"
          ? CalendarDays
          : Code2;
    const roster = selected ? byKind("student", selected.id) : [];
    const student = roster.find((e) => e.id === studentId) ?? roster[0];
    const selectGroup = (
      <section className="card panel">
        <div className="panel-heading">
          <span className="tile mint">
            <Icon size={20} />
          </span>
          <h2>
            {group === "course"
              ? t("Study courses", "المقررات الدراسية")
              : group === "section"
                ? t("Teaching sections", "الأقسام التدريسية")
                : t("Projects", "المشاريع")}
          </h2>
          {add(group, t("Add new", "إضافة جديد"))}
        </div>
        {groups.length ? (
          <div className="selector">
            {groups.map((entry) => (
              <Button
                className={selected?.id === entry.id ? "primary" : "secondary"}
                key={entry.id}
                onClick={() => setSelection(entry.id)}
              >
                {label(entry)}
              </Button>
            ))}
          </div>
        ) : (
          empty(
            t(
              "Create your first item to get started.",
              "أضيفي أول عنصر للبدء.",
            ),
          )
        )}
      </section>
    );
    if (!selected)
      return (
        <div className="stack">
          {selectGroup}
          {group === "course" && focusCard}
        </div>
      );
    const days = selected.date
      ? Math.round((Date.parse(selected.date) - Date.parse(today)) / 86400000)
      : undefined;
    return (
      <div className="stack">
        {selectGroup}
        <section className="card panel">
          <div className="panel-heading">
            <h2>{label(selected)}</h2>
            {editButton(selected)}
          </div>
          {notes(selected)}
          {group === "course" && (
            <>
              {days !== undefined && (
                <p className="accent">
                  {days < 0
                    ? t("Exam date passed", "انقضى تاريخ الاختبار")
                    : days === 0
                      ? t("Exam today", "الاختبار اليوم")
                      : t(
                          `${days} days until exam`,
                          `متبقي ${days} أيام على الاختبار`,
                        )}
                </p>
              )}
              <div className="panel-heading">
                <h3>{t("Study modules", "الوحدات الدراسية")}</h3>
                {add("module", t("Add module", "إضافة وحدة"), {
                  parent: selected.id,
                })}
              </div>
              {list("module", selected.id)}
              <p>
                {t("Logged study time", "وقت الدراسة المسجّل")}:{" "}
                {(
                  byKind("focus", selected.id).reduce(
                    (sum, e) => sum + (e.value ?? 0),
                    0,
                  ) / 60
                ).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                {t("hours", "ساعة")}
              </p>
            </>
          )}
          {group === "section" && (
            <>
              <div className="panel-heading">
                <h3>
                  {t("Student roster", "قائمة الطلاب")} ({roster.length})
                </h3>
                <div className="toolbar">
                  {add("student", t("Add student", "إضافة طالب"), {
                    parent: selected.id,
                  })}
                  <Button
                    className="secondary"
                    onClick={() => rosterFile.current?.click()}
                  >
                    <Upload size={16} />
                    CSV
                  </Button>
                </div>
              </div>
              <input
                ref={rosterFile}
                hidden
                type="file"
                accept=".csv,text/csv"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const [headers, ...rows] = parseCsv(await file.text());
                    const nameColumn = headers.findIndex((h) =>
                      ["name", "student", "student name", "الاسم"].includes(
                        h.trim().toLowerCase(),
                      ),
                    );
                    if (nameColumn < 0) throw new Error("Missing name column");
                    const names = [
                      ...new Set(
                        rows
                          .map((row) => row[nameColumn]?.trim())
                          .filter((name): name is string => !!name),
                      ),
                    ];
                    if (
                      await change((old) => [
                        ...old,
                        ...names
                          .filter(
                            (name) =>
                              !old.some(
                                (e) =>
                                  e.kind === "student" &&
                                  e.parent === selected.id &&
                                  e.title === name,
                              ),
                          )
                          .map((name) =>
                            newEntry("student", name, { parent: selected.id }),
                          ),
                      ])
                    )
                      notify(t("Roster imported.", "تم استيراد قائمة الطلاب."));
                  } catch {
                    notify(
                      t(
                        "CSV needs a name column.",
                        "يجب أن يحتوي CSV على عمود الاسم.",
                      ),
                    );
                  }
                }}
              />
              {list("student", selected.id)}
              <div className="panel-heading">
                <h3>{t("Attendance", "الحضور")}</h3>
                {add("session", t("Take attendance", "تسجيل الحضور"), {
                  parent: selected.id,
                  date: today,
                  title: t("Session", "جلسة"),
                })}
              </div>
              {byKind("session", selected.id).map((session) => (
                <div className="record" key={session.id}>
                  <div>
                    <strong>{label(session)}</strong>
                    <small className="record-meta">
                      {session.date} ·{" "}
                      {
                        Object.values(session.attendance ?? {}).filter(
                          (v) => v === "present",
                        ).length
                      }{" "}
                      {t("present", "حاضر")}
                    </small>
                    {notes(session)}
                  </div>
                  {editButton(session)}
                </div>
              ))}
              <div className="panel-heading">
                <h3>{t("Assignments & grades", "الواجبات والدرجات")}</h3>
                {student &&
                  add("submission", t("Log submission", "تسجيل تسليم"), {
                    parent: student.id,
                    date: today,
                  })}
              </div>
              {student ? (
                <>
                  <label>
                    {t("Student", "الطالب")}
                    <select
                      value={student.id}
                      onChange={(event) => setStudentId(event.target.value)}
                    >
                      {roster.map((e) => (
                        <option value={e.id} key={e.id}>
                          {label(e)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {byKind("submission", student.id).map((entry) => (
                    <div className="record" key={entry.id}>
                      <div>
                        <strong>{label(entry)}</strong>
                        <small className="record-meta">
                          {entry.date} ·{" "}
                          {entry.status &&
                            {
                              submitted: t("Submitted", "تم التسليم"),
                              missing: t("Missing", "لم يُسلّم"),
                              graded: t("Graded", "مُقيّم"),
                            }[entry.status]}{" "}
                          {entry.value !== undefined && `· ${entry.value}`}
                        </small>
                        {notes(entry)}
                      </div>
                      {editButton(entry)}
                    </div>
                  ))}
                </>
              ) : (
                empty(
                  t(
                    "Add students to log their submissions.",
                    "أضيفي طلابًا لتسجيل واجباتهم.",
                  ),
                )
              )}
            </>
          )}
          {group === "project" && (
            <>
              <div className="panel-heading">
                <h3>{t("Kanban backlog", "قائمة مهام كانبان")}</h3>
                {add("task", t("Add task", "إضافة مهمة"), {
                  parent: selected.id,
                })}
              </div>
              <div className="kanban">
                {(selected.columns ?? []).map((column, index) => (
                  <div key={column}>
                    <h4>{column}</h4>
                    {byKind("task", selected.id)
                      .filter(
                        (task) =>
                          task.status === column ||
                          (index === 0 &&
                            !selected.columns?.includes(task.status ?? "")),
                      )
                      .map((task) => (
                        <article key={task.id} className="task">
                          <strong>{label(task)}</strong>
                          <small>
                            {
                              {
                                feature: t("Feature", "ميزة"),
                                bug: t("Bug", "خطأ"),
                                task: t("Task", "مهمة"),
                              }[task.type ?? "task"]
                            }{" "}
                            · {task.xp ?? 0} XP
                          </small>
                          <select
                            aria-label={t("Move to column", "نقل إلى عمود")}
                            value={
                              selected.columns?.includes(task.status ?? "")
                                ? task.status
                                : column
                            }
                            onChange={(event) => {
                              const status = event.target.value;
                              void change((old) =>
                                old.map((e) =>
                                  e.id === task.id ? { ...e, status } : e,
                                ),
                              );
                            }}
                          >
                            {selected.columns?.map((name) => (
                              <option key={name}>{name}</option>
                            ))}
                          </select>
                          <div className="record-actions">
                            {editButton(task)}
                            <button
                              aria-pressed={task.value === 0}
                              onClick={() =>
                                void change((old) =>
                                  old.map((e) =>
                                    e.id === task.id
                                      ? {
                                          ...e,
                                          value: e.value === 0 ? 1 : 0,
                                          date:
                                            e.value === 0 ? undefined : today,
                                        }
                                      : e,
                                  ),
                                )
                              }
                            >
                              <Check size={14} />
                              {task.value === 0
                                ? t("Reopen", "إعادة فتح")
                                : t("Complete", "إكمال")}
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                ))}
              </div>
              <div className="panel-heading">
                <h3>{t("Milestone timeline", "الجدول الزمني للمراحل")}</h3>
                {add("milestone", t("Add milestone", "إضافة مرحلة"), {
                  parent: selected.id,
                  date: today,
                })}
              </div>
              {byKind("milestone", selected.id)
                .toSorted((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
                .map((entry) => (
                  <div className="record" key={entry.id}>
                    <div>
                      <strong>{label(entry)}</strong>
                      <small className="record-meta">{entry.date}</small>
                      {notes(entry)}
                    </div>
                    {editButton(entry)}
                  </div>
                ))}
            </>
          )}
        </section>
        {group === "course" && focusCard}
      </div>
    );
  }
  if (page === "Quick Inbox")
    return (
      <section className="card panel">
        <div className="panel-heading">
          <span className="tile mint">
            <Inbox size={20} />
          </span>
          <h2>{t("Captured items", "العناصر المضافة")}</h2>
          {add("inbox", t("Quick capture", "إضافة سريعة"))}
        </div>
        {!byKind("inbox").length &&
          empty(t("Your inbox is clear.", "صندوق الوارد فارغ."))}
        {byKind("inbox").map((entry) => (
          <div className="record inbox-record" key={entry.id}>
            <div>
              <strong>{label(entry)}</strong>
              {notes(entry)}
            </div>
            <div className="record-actions">
              {editButton(entry)}
              <select
                aria-label={t("Destination", "الوجهة")}
                value={destination[entry.id] ?? ""}
                onChange={(e) =>
                  setDestination((old) => ({
                    ...old,
                    [entry.id]: e.target.value,
                  }))
                }
              >
                <option value="">{t("Assign to…", "إسناد إلى…")}</option>
                {entries
                  .filter((e) =>
                    [
                      "course",
                      "section",
                      "project",
                      "tracker",
                      "reward",
                    ].includes(e.kind),
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {label(e)}
                    </option>
                  ))}
              </select>
              <button
                disabled={!destination[entry.id]}
                onClick={() => {
                  const parent = entries.find(
                    (e) => e.id === destination[entry.id],
                  );
                  if (!parent) return;
                  if (parent.kind === "project" || parent.kind === "course") {
                    void change((old) =>
                      old.map((e) =>
                        e.id === entry.id
                          ? {
                              ...e,
                              kind:
                                parent.kind === "project" ? "task" : "module",
                              parent: parent.id,
                              status: parent.columns?.[0],
                              type:
                                parent.kind === "project" ? "task" : undefined,
                              value: parent.kind === "project" ? 1 : undefined,
                            }
                          : e,
                      ),
                    );
                  } else {
                    const captured = [entry.title, entry.detail, entry.link]
                      .filter(Boolean)
                      .join("\n");
                    void change((old) =>
                      old
                        .filter((e) => e.id !== entry.id)
                        .map((e) =>
                          e.id === parent.id
                            ? {
                                ...e,
                                detail: [e.detail, captured]
                                  .filter(Boolean)
                                  .join("\n\n"),
                              }
                            : e,
                        ),
                    );
                  }
                }}
              >
                <ArrowRight size={16} />
                {t("Assign", "إسناد")}
              </button>
              <button onClick={() => remove(entry)}>
                {t("Delete", "حذف")}
              </button>
            </div>
          </div>
        ))}
      </section>
    );
  if (page === "Rewards")
    return (
      <section className="card panel">
        <div className="panel-heading">
          <span className="tile gold">
            <Gift size={20} />
          </span>
          <h2>{t("Reward Store", "متجر المكافآت")}</h2>
          {add("reward", t("Add reward", "إضافة مكافأة"))}
        </div>
        <p className="accent">
          {balance} XP {t("available", "متاحة")}
        </p>
        {!byKind("reward").length &&
          empty(
            t(
              "Add a reward you’d like to work toward.",
              "أضيفي مكافأة ترغبين في الحصول عليها.",
            ),
          )}
        {byKind("reward").map((reward) => (
          <div className="record" key={reward.id}>
            <div>
              <strong>{label(reward)}</strong>
              {notes(reward)}
            </div>
            <div className="record-actions">
              {editButton(reward)}
              <Button
                className="primary"
                disabled={!reward.xp || balance < reward.xp}
                onClick={() => {
                  if (
                    !window.confirm(
                      t("Redeem this reward?", "استبدال هذه المكافأة؟"),
                    )
                  )
                    return;
                  void change((old) =>
                    xpBalance(old) < (reward.xp ?? Infinity)
                      ? old
                      : [
                          ...old,
                          newEntry("redemption", reward.title, {
                            date: today,
                            xp: -(reward.xp ?? 0),
                          }),
                        ],
                  );
                }}
              >
                <Zap size={15} />
                {reward.xp} XP
              </Button>
            </div>
          </div>
        ))}
        {!!byKind("redemption").length && (
          <>
            <h3>{t("Redemption history", "سجل الاستبدال")}</h3>
            {byKind("redemption").map((e) => (
              <div className="record" key={e.id}>
                <strong>{label(e)}</strong>
                <span>
                  {e.date} · {e.xp} XP
                </span>
              </div>
            ))}
          </>
        )}
      </section>
    );
  const weekly = weekdays.map((date) => {
    const records = allEntries.filter((e) => e.date === date);
    const count = records.filter(
      (e) => e.kind === "log" && (e.value ?? 0) > 0,
    ).length;
    return {
      date,
      count,
      earned: records.reduce(
        (sum, e) => sum + (e.kind === "redemption" ? 0 : earnedXp(e)),
        0,
      ),
      focus: records.reduce(
        (sum, e) => sum + (e.kind === "focus" ? (e.value ?? 0) : 0),
        0,
      ),
    };
  });
  const focusDays = weekly.filter((e) => e.focus > 0).length;
  const consistentDays = weekly.filter((e) => e.count > 0).length;
  let run = 0;
  let bestStreak = 0;
  for (const day of weekly) {
    run = day.count > 0 ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }
  const distractions = byKind("distraction").filter(
    (e) => e.date && e.date >= weekdays[0] && e.date <= today,
  );
  const distractionMinutes = distractions.reduce(
    (sum, e) => sum + (e.value ?? 0),
    0,
  );
  const focusMinutes = weekly.reduce((sum, e) => sum + e.focus, 0);
  const max = Math.max(1, ...weekly.map((e) => e.earned));
  return (
    <div className="stack">
      <section className="card panel">
        <h2>{t("Weekly activity", "النشاط الأسبوعي")}</h2>
        <p>
          {t(
            "Daily XP earned, habit logs, and focus minutes over the last seven days.",
            "النقاط وسجلات العادات ودقائق التركيز خلال الأيام السبعة الأخيرة.",
          )}
        </p>
        <div className="chart">
          {weekly.map((e) => (
            <div key={e.date}>
              <span>{e.earned} XP</span>
              <div className="chart-track">
                <div
                  style={{ height: `${Math.max(4, (e.earned / max) * 100)}%` }}
                />
              </div>
              <strong>{e.date.slice(5)}</strong>
              <small>
                {e.count} {t("logs", "سجلات")} · {e.focus} {t("min", "د")}
              </small>
            </div>
          ))}
        </div>
      </section>
      <section className="card panel">
        <div className="panel-heading">
          <h2>{t("Focus & consistency", "التركيز والمواظبة")}</h2>
          {add("distraction", t("Log distraction", "تسجيل تشتت"), {
            date: today,
          })}
        </div>
        <p>
          {t(
            `Habits logged on ${consistentDays} of 7 days. Longest streak: ${bestStreak} days.`,
            `سُجّلت العادات في ${consistentDays} من ٧ أيام. أطول تتابع: ${bestStreak} أيام.`,
          )}
        </p>
        <p>
          {t(
            `Focus was logged on ${focusDays} of the last 7 days.`,
            `تم تسجيل التركيز في ${focusDays} من آخر ٧ أيام.`,
          )}
        </p>
        <p>
          {focusMinutes} {t("focus min", "دقيقة تركيز")} · {distractionMinutes}{" "}
          {t("distraction min", "دقيقة تشتت")}
        </p>
        {distractionMinutes > focusMinutes && (
          <p className="accent" role="status">
            {t(
              "Logged distraction time exceeded focus time this week.",
              "تجاوز وقت التشتت المسجّل وقت التركيز هذا الأسبوع.",
            )}
          </p>
        )}
        {distractions.map((entry) => (
          <div className="record" key={entry.id}>
            <div>
              <strong>{label(entry)}</strong>
              <small className="record-meta">
                {entry.date} · {entry.value} {t("min", "د")}
              </small>
            </div>
            <div className="record-actions">
              {editButton(entry)}
              <button onClick={() => remove(entry)}>
                {t("Delete", "حذف")}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
