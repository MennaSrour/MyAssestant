"use client";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Droplets,
  Flame,
  Gift,
  Globe2,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";
import { latestWorkspace, persist, signOut } from "@/app/actions";
import {
  allocateTrackerXp,
  dayKey,
  newEntry,
  trackerProgress,
  validEntries,
  xpBalance,
  type Entry,
  type Kind,
  type Workspace,
} from "@/lib/model";
import { Button } from "./ui/button";
import { Editor, type EditRequest } from "./editor";
import { WorkspacePanel } from "./workspace-panel";
import { downloadBackup, readBackup } from "@/lib/backup";

const navigation = [
  ["Overview", "نظرة عامة", LayoutDashboard],
  ["Habits & Quran", "العادات والقرآن", BookOpen],
  ["Academic Hub", "الدراسة", GraduationCap],
  ["TA Workspace", "مساعد التدريس", CalendarDays],
  ["Dev Projects", "المشاريع", Code2],
  ["Quick Inbox", "صندوق الوارد", Inbox],
  ["Rewards", "المكافآت", Gift],
  ["Analytics", "التحليلات", Activity],
  ["Settings", "الإعدادات", Settings],
] as const;
type Page = (typeof navigation)[number][0];
const trackerIcons = {
  mint: BookOpen,
  blue: Droplets,
  violet: Timer,
  peach: Flame,
};
const storageKey = "hayati-workspace-v1";

export function Dashboard({
  initial,
  demo,
  initialDay,
}: {
  initial: Workspace;
  demo: boolean;
  initialDay: string;
}) {
  const [workspace, setWorkspace] = useState(initial);
  const [page, setPage] = useState<Page>("Overview");
  const [ar, setAr] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editor, setEditor] = useState<EditRequest>();
  const [trackerCategory, setTrackerCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState(initialDay);
  const [focus, setFocus] = useState<{
    minutes: number;
    remaining: number;
    end: number;
    course?: string;
  }>({ minutes: 25, remaining: 1500, end: 0 });
  const [ready, setReady] = useState(false);
  const saving = useRef(false);
  const current = useRef(workspace);
  const focusCompleting = useRef(false);
  const file = useRef<HTMLInputElement>(null);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const label = (entry: Entry) => (ar && entry.ar ? entry.ar : entry.title);

  useEffect(() => {
    try {
      setAr(localStorage.getItem("hayati-lang") === "ar");
      if (demo) {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (saved && validEntries(saved.entries)) {
          current.current = saved;
          setWorkspace(saved);
        }
      }
      const savedTimer = JSON.parse(
        localStorage.getItem("hayati-focus") ?? "null",
      );
      if (
        savedTimer &&
        Number.isFinite(savedTimer.remaining) &&
        Number.isFinite(savedTimer.end)
      )
        setFocus(savedTimer);
    } catch {
      /* An unavailable browser storage does not block opening the workspace. */
    }
    setReady(true);
    setToday(dayKey());
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [demo]);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = ar ? "ar" : "en";
    document.documentElement.dir = ar ? "rtl" : "ltr";
    try {
      localStorage.setItem("hayati-lang", ar ? "ar" : "en");
    } catch {}
  }, [ar, ready]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("hayati-focus", JSON.stringify(focus));
      } catch {}
  }, [focus, ready]);
  useEffect(() => {
    const clock = setInterval(() => setToday(dayKey()), 15000);
    if (demo) {
      const sync = (event: StorageEvent) => {
        if (event.key !== storageKey || !event.newValue) return;
        try {
          const next = JSON.parse(event.newValue);
          if (validEntries(next.entries)) {
            current.current = next;
            setWorkspace(next);
          }
        } catch {}
      };
      window.addEventListener("storage", sync);
      return () => {
        clearInterval(clock);
        window.removeEventListener("storage", sync);
      };
    }
    const refresh = async () => {
      if (
        document.visibilityState !== "visible" ||
        saving.current ||
        !navigator.onLine
      )
        return;
      try {
        const next = await latestWorkspace();
        if (next && !saving.current && next.version > current.current.version) {
          current.current = next;
          setWorkspace(next);
        }
      } catch {}
    };
    const interval = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(clock);
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [demo]);
  async function change(update: (entries: Entry[]) => Entry[]) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      const previous = current.current;
      const entries = update(previous.entries);
      const result = demo
        ? { version: previous.version + 1 }
        : await persist(entries, previous.version);
      if ("error" in result && result.error) {
        if (result.error.startsWith("Workspace changed")) {
          const updated = await latestWorkspace();
          if (updated) {
            current.current = updated;
            setWorkspace(updated);
          }
          setNotice(
            t(
              "Workspace updated from another device. Review your changes and retry.",
              "تم تحديث البيانات من جهاز آخر. راجعي تعديلاتك وحاولي مجددًا.",
            ),
          );
        } else setNotice(result.error);
        return false;
      }
      const next = { entries, version: result.version! };
      if (demo) localStorage.setItem(storageKey, JSON.stringify(next));
      current.current = next;
      setWorkspace(next);
      return true;
    } catch {
      setNotice(
        t(
          "Saving failed. Check your connection and try again.",
          "تعذّر الحفظ. تحققي من الاتصال وحاولي مجددًا.",
        ),
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!focus.end) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((focus.end - Date.now()) / 1000));
      if (remaining) {
        setFocus((old) =>
          old.remaining === remaining ? old : { ...old, remaining },
        );
        return;
      }
      if (focusCompleting.current || (!demo && !navigator.onLine)) return;
      focusCompleting.current = true;
      void change((entries) => {
        const id = "focus-" + focus.end;
        return entries.some((entry) => entry.id === id)
          ? entries
          : [
              ...entries,
              newEntry("focus", "Pomodoro", {
                id,
                date: dayKey(),
                value: focus.minutes,
                parent: focus.course,
              }),
            ];
      })
        .then((saved) => {
          if (saved) {
            setFocus((old) => ({
              ...old,
              end: 0,
              remaining: old.minutes * 60,
            }));
            setNotice(t("Focus session logged.", "تم تسجيل جلسة التركيز."));
          }
        })
        .finally(() => {
          focusCompleting.current = false;
        });
    };
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // The deadline is stable while the timer counts down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.end, focus.minutes, focus.course, ar, demo]);

  const entries = workspace.entries;
  const active = entries.filter((entry) => !entry.archived);
  const trackers = active.filter((entry) => entry.kind === "tracker");
  const categories = active.filter((entry) => entry.kind === "category");
  const filteredTrackers =
    page === "Habits & Quran" &&
    categories.some((category) => category.id === trackerCategory)
      ? trackers.filter((tracker) => tracker.category === trackerCategory)
      : trackers;
  const completed = trackers.filter(
    (entry) => trackerProgress(entries, entry, today) >= (entry.target ?? 1),
  ).length;
  const balance = xpBalance(entries);
  const focusToday = entries
    .filter((entry) => entry.kind === "focus" && entry.date === today)
    .reduce((sum, e) => sum + (e.value ?? 0), 0);
  let streak = 0;
  const date = new Date(today + "T12:00:00");
  const loggingDates = new Set(
    entries
      .filter((e) => e.kind === "log" && (e.value ?? 0) > 0)
      .map((e) => e.date),
  );
  if (!loggingDates.has(today)) date.setDate(date.getDate() - 1);
  while (loggingDates.has(dayKey(date))) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  const open = (kind: Kind, fields: Partial<Entry> = {}) =>
    setEditor({ kind, fields });
  const edit = (entry: Entry) => setEditor({ kind: entry.kind, entry });
  const remove = (entry: Entry) => {
    if (
      !window.confirm(
        t(
          "Delete this item and its related records?",
          "هل تريدين حذف العنصر وسجلاته المرتبطة؟",
        ),
      )
    )
      return;
    void change((old) => {
      const ids = new Set([entry.id]);
      let size = 0;
      while (size !== ids.size) {
        size = ids.size;
        old.forEach((item) => {
          if (item.parent && ids.has(item.parent)) ids.add(item.id);
        });
      }
      const next = old
        .filter((item) => !ids.has(item.id))
        .map((item) =>
          item.attendance
            ? {
                ...item,
                attendance: Object.fromEntries(
                  Object.entries(item.attendance).filter(
                    ([id]) => !ids.has(id),
                  ),
                ),
              }
            : item,
        )
        .map((item) =>
          item.category && ids.has(item.category)
            ? { ...item, category: undefined }
            : item,
        );
      const tracker =
        entry.kind === "log" && old.find((item) => item.id === entry.parent);
      return tracker ? allocateTrackerXp(next, tracker, [entry.date]) : next;
    });
  };
  const saveEdit = async (entry: Entry) => {
    const saved = await change((old) => {
      const previous = old.find((item) => item.id === entry.id);
      const next = previous
        ? old.map((item) => (item.id === entry.id ? entry : item))
        : [...old, entry];
      const tracker =
        entry.kind === "log" && old.find((item) => item.id === entry.parent);
      return tracker
        ? allocateTrackerXp(next, tracker, [previous?.date, entry.date])
        : next;
    });
    if (saved) setEditor(undefined);
    return saved;
  };
  function logTracker(tracker: Entry) {
    if (tracker.type === "range") {
      open("log", {
        parent: tracker.id,
        title: tracker.title,
        type: "range",
        date: today,
        value: 1,
        surah: tracker.surah,
        juz: tracker.juz,
      });
      return;
    }
    if (tracker.type === "number") {
      open("log", {
        parent: tracker.id,
        title: tracker.title,
        type: "number",
        date: today,
        value: 1,
        unit: tracker.unit,
      });
      return;
    }
    void change((old) => {
      const existing = old.find(
        (e) => e.kind === "log" && e.parent === tracker.id && e.date === today,
      );
      const next = existing
        ? old.filter((e) => e.id !== existing.id)
        : [
            ...old,
            newEntry("log", tracker.title, {
              parent: tracker.id,
              date: today,
              value: 1,
              type: "boolean",
            }),
          ];
      return allocateTrackerXp(next, tracker, [today]);
    });
  }
  function reorder(entry: Entry, direction: number) {
    void change((old) => {
      const group = old.filter(
        (item) => item.kind === entry.kind && item.parent === entry.parent,
      );
      const peer =
        group[group.findIndex((item) => item.id === entry.id) + direction];
      if (!peer) return old;
      return old.map((item) =>
        item.id === entry.id ? peer : item.id === peer.id ? entry : item,
      );
    });
  }
  const dateLabel = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(today + "T12:00:00"));
  const currentNav = navigation.find(([name]) => name === page)!;
  const metricTypes = {
    completed: {
      value: (
        <>
          {completed}
          <small> / {trackers.length}</small>
        </>
      ),
      caption: t("Today’s progress", "تقدّم اليوم"),
      icon: Target,
      color: "mint",
    },
    streak: {
      value: (
        <>
          {streak}
          <small> {t("days", "أيام")}</small>
        </>
      ),
      caption: t("Days with activity", "أيام النشاط"),
      icon: Flame,
      color: "peach",
    },
    focus: {
      value: (
        <>
          {focusToday}
          <small> {t("min", "دقيقة")}</small>
        </>
      ),
      caption: t("Logged today", "المسجّل اليوم"),
      icon: Clock3,
      color: "violet",
    },
    xp: {
      value: (
        <>
          {balance}
          <small> XP</small>
        </>
      ),
      caption: t("Available to spend", "متاح للاستخدام"),
      icon: Zap,
      color: "gold",
    },
    inbox: {
      value: <>{active.filter((e) => e.kind === "inbox").length}</>,
      caption: t("Waiting to be assigned", "بانتظار الإسناد"),
      icon: Inbox,
      color: "blue",
    },
    distractions: {
      value: (
        <>
          {active
            .filter((e) => e.kind === "distraction" && e.date === today)
            .reduce((sum, e) => sum + (e.value ?? 0), 0)}
          <small> {t("min", "دقيقة")}</small>
        </>
      ),
      caption: t("Logged today", "المسجّل اليوم"),
      icon: Clock3,
      color: "peach",
    },
  };
  const stats = active
    .filter((e) => e.kind === "metric")
    .flatMap((entry) => {
      const metric = metricTypes[entry.type as keyof typeof metricTypes];
      return metric ? [{ ...metric, name: label(entry), id: entry.id }] : [];
    });
  const focusCard = (
    <section className="card focus-card">
      <div className="card-heading">
        <span className="tile violet">
          <Timer size={19} />
        </span>
        <div>
          <h2>{t("Focus Timer", "مؤقّت التركيز")}</h2>
          <p>{t("Make time for deep work", "خصّصي وقتًا للتركيز")}</p>
        </div>
      </div>
      <div
        className="timer-ring"
        style={
          {
            "--progress": `${(focus.remaining / (focus.minutes * 60)) * 100}%`,
          } as React.CSSProperties
        }
      >
        <div>
          <strong dir="ltr">
            {String(Math.floor(focus.remaining / 60)).padStart(2, "0")}:
            {String(focus.remaining % 60).padStart(2, "0")}
          </strong>
          <span>
            {focus.end ? t("FOCUSING", "تركيز") : t("POMODORO", "بومودورو")}
          </span>
        </div>
      </div>
      <div className="timer-options">
        {[15, 25, 50].map((minutes) => (
          <button
            key={minutes}
            disabled={!!focus.end}
            className={minutes === focus.minutes ? "selected" : ""}
            onClick={() =>
              setFocus((old) => ({
                ...old,
                minutes,
                remaining: minutes * 60,
                end: 0,
              }))
            }
          >
            {minutes} {t("min", "د")}
          </button>
        ))}
      </div>
      {!!active.filter((e) => e.kind === "course").length && (
        <label className="focus-course">
          {t("Log time to", "تسجيل الوقت في")}
          <select
            disabled={!!focus.end}
            value={focus.course ?? ""}
            onChange={(e) =>
              setFocus((old) => ({
                ...old,
                course: e.target.value || undefined,
              }))
            }
          >
            <option value="">{t("General focus", "تركيز عام")}</option>
            {active
              .filter((e) => e.kind === "course")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {label(e)}
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="timer-actions">
        <Button
          className="primary"
          onClick={() =>
            setFocus((old) => ({
              ...old,
              remaining: old.end
                ? Math.max(1, Math.ceil((old.end - Date.now()) / 1000))
                : old.remaining,
              end: old.end ? 0 : Date.now() + old.remaining * 1000,
            }))
          }
        >
          {focus.end
            ? t("Pause timer", "إيقاف مؤقت")
            : t("Start focus", "ابدئي التركيز")}
        </Button>
        <Button
          className="icon-button bordered"
          aria-label={t("Reset timer", "إعادة المؤقّت")}
          onClick={() =>
            setFocus((old) => ({ ...old, end: 0, remaining: old.minutes * 60 }))
          }
        >
          <RotateCcw size={17} />
        </Button>
      </div>
    </section>
  );
  const trackerList = (
    <section className="card tracker-card">
      <div className="card-heading">
        <span className="tile mint">
          <Target size={19} />
        </span>
        <div>
          <h2>{t("Habit Tracker", "متابعة العادات")}</h2>
          <p>
            {t("Small steps, meaningful progress", "خطوات صغيرة وتقدّم ملموس")}
          </p>
        </div>
        <Button className="secondary add-habit" onClick={() => open("tracker")}>
          <Plus size={15} />
          {t("Add habit", "عادة جديدة")}
        </Button>
      </div>
      {page === "Habits & Quran" && categories.length > 0 && (
        <label className="category-filter">
          {t("Category", "التصنيف")}
          <select
            value={trackerCategory}
            onChange={(event) => setTrackerCategory(event.target.value)}
          >
            <option value="">{t("All categories", "كل التصنيفات")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {label(category)}
              </option>
            ))}
          </select>
        </label>
      )}
      {filteredTrackers.length === 0 && (
        <p className="empty">
          {t(
            "Create a habit to start tracking your progress.",
            "أضيفي عادة لتبدئي متابعة تقدمك.",
          )}
        </p>
      )}
      {filteredTrackers.map((item) => {
        const Icon =
          trackerIcons[item.color as keyof typeof trackerIcons] ?? Target;
        const progress = trackerProgress(entries, item, today);
        const done = progress >= (item.target ?? 1);
        const category = categories.find(
          (category) => category.id === item.category,
        );
        return (
          <div className="tracker-row" key={item.id}>
            <span className={`tile ${item.color ?? "mint"}`}>
              <Icon size={18} />
            </span>
            <button className="tracker-label" onClick={() => edit(item)}>
              <strong>{label(item)}</strong>
              <span>
                {category && `${label(category)} · `}
                {ar && item.arDetail
                  ? item.arDetail
                  : item.detail || item.cadence || t("Daily", "يومي")}
              </span>
            </button>
            {item.type === "number" && (
              <span className="counter">
                {progress}/{item.target}
              </span>
            )}
            <span className="xp-tag">+{item.xp ?? 0} XP</span>
            <button
              className={`check-button ${done ? "done" : ""}`}
              disabled={busy}
              onClick={() => logTracker(item)}
              aria-label={t("Log ", "تسجيل ") + label(item)}
            >
              {done ? (
                <Check size={15} />
              ) : item.type === "boolean" ? null : (
                <Plus size={15} />
              )}
            </button>
          </div>
        );
      })}
      {page === "Habits & Quran" && (
        <div className="log-history">
          <h3>{t("Activity log", "سجل النشاط")}</h3>
          {entries
            .filter((e) => e.kind === "log")
            .slice()
            .reverse()
            .map((log) => (
              <div key={log.id} className="record">
                <button onClick={() => edit(log)}>
                  {log.title} · {log.date}{" "}
                  {log.surah && `· ${log.surah} ${log.start}–${log.end}`}
                </button>
                <button onClick={() => remove(log)}>
                  {t("Delete", "حذف")}
                </button>
              </div>
            ))}
        </div>
      )}
    </section>
  );
  return (
    <div
      className={`shell ${collapsed ? "collapsed" : ""}`}
      dir={ar ? "rtl" : "ltr"}
    >
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage("Overview")}>
          <span className="brand-icon">
            <Sparkles size={22} />
          </span>
          <span>
            <b>Hayati OS</b>
            <small>{t("PERSONAL WORKSPACE", "مساحة العمل الشخصية")}</small>
          </span>
        </button>
        <div className="nav-group">
          <p>{t("WORKSPACE", "مساحة العمل")}</p>
          {navigation.slice(0, 7).map(([name, arabic, Icon]) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              aria-label={t(name, arabic)}
              title={t(name, arabic)}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name)}
            >
              <Icon size={19} />
              <span>{t(name, arabic)}</span>
              {name === "Quick Inbox" &&
                active.some((e) => e.kind === "inbox") && (
                  <i>{active.filter((e) => e.kind === "inbox").length}</i>
                )}
            </button>
          ))}
        </div>
        <div className="nav-group preferences">
          <p>{t("PREFERENCES", "التفضيلات")}</p>
          {navigation.slice(7).map(([name, arabic, Icon]) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              aria-label={t(name, arabic)}
              title={t(name, arabic)}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name)}
            >
              <Icon size={19} />
              <span>{t(name, arabic)}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <span className="avatar">{t("M", "م")}</span>
          <div>
            <strong>{t("My Workspace", "مساحتي")}</strong>
            <small>
              {demo
                ? t("Local workspace", "مساحة محلية")
                : t("Synced workspace", "مساحة متزامنة")}
            </small>
          </div>
          {!demo ? (
            <form action={signOut}>
              <button aria-label={t("Sign out", "تسجيل الخروج")}>
                <LogOut size={17} />
              </button>
            </form>
          ) : (
            <ChevronDown size={15} />
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button desktop-menu"
              aria-label={t("Toggle sidebar", "تبديل الشريط الجانبي")}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu size={19} />
            </button>
            <span className="breadcrumb">
              {t("Workspace", "مساحة العمل")} <ChevronRight size={14} />
            </span>
            <strong>{t(currentNav[0], currentNav[1])}</strong>
          </div>
          <div>
            <span className="header-date">
              <CalendarDays size={16} />
              {dateLabel}
            </span>
            <button className="language" onClick={() => setAr(!ar)}>
              <Globe2 size={16} />
              {t("العربية", "English")}
            </button>
            <button
              className="avatar header-avatar"
              onClick={() => setPage("Settings")}
              aria-label={t("Workspace settings", "الإعدادات")}
            >
              {t("M", "م")}
            </button>
          </div>
        </header>
        <main className="content">
          {page === "Overview" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>{t("Overview", "نظرة عامة")}</h1>
                  <p>
                    {t(
                      "Here’s what’s happening in your workspace today.",
                      "إليك ما يجري في مساحة عملك اليوم.",
                    )}
                  </p>
                </div>
                <Button
                  className="primary capture"
                  onClick={() => open("inbox")}
                >
                  <Plus size={18} />
                  {t("Quick capture", "إضافة سريعة")}
                </Button>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <Sparkles size={14} />
                    {t("YOUR DAILY SPACE", "مساحتك اليومية")}
                  </span>
                  <h2>{t("Make today count.", "اجعلي اليوم مثمرًا.")}</h2>
                  <p>
                    {t(
                      "Build better habits, stay focused, and make room for what matters.",
                      "ابني عادات أفضل وحافظي على تركيزك وامنحي ما يهمك مساحة.",
                    )}
                  </p>
                </div>
              </section>
              {stats.length > 0 && (
                <div className="metrics">
                  {stats.map(
                    ({ name, id, value, caption, icon: Icon, color }) => (
                      <div className="card metric" key={id}>
                        <div>
                          <span>{name}</span>
                          <span className={`tile ${color}`}>
                            <Icon size={18} />
                          </span>
                        </div>
                        <strong>{value}</strong>
                        <p>{caption}</p>
                      </div>
                    ),
                  )}
                </div>
              )}
              <div className="overview-grid">
                {trackerList}
                {focusCard}
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    {page === "Settings"
                      ? t(
                          "Settings & Customization Studio",
                          "الإعدادات واستوديو التخصيص",
                        )
                      : t(currentNav[0], currentNav[1])}
                  </h1>
                </div>
              </div>
              {page === "Settings" && (
                <div className="mobile-more">
                  {navigation
                    .filter(([name]) =>
                      [
                        "TA Workspace",
                        "Quick Inbox",
                        "Rewards",
                        "Analytics",
                      ].includes(name),
                    )
                    .map(([name, arabic, Icon]) => (
                      <button key={name} onClick={() => setPage(name)}>
                        <Icon size={16} />
                        {t(name, arabic)}
                        {ar ? (
                          <ArrowLeft size={14} />
                        ) : (
                          <ArrowRight size={14} />
                        )}
                      </button>
                    ))}
                </div>
              )}
              {page === "Habits & Quran" ? (
                trackerList
              ) : page === "Settings" ? (
                <div className="stack">
                  <section className="card panel">
                    <h2>
                      {t("Preferences & backups", "التفضيلات والنسخ الاحتياطي")}
                    </h2>
                    <div className="toolbar">
                      <Button className="secondary" onClick={() => setAr(!ar)}>
                        <Globe2 size={16} />
                        {t("العربية", "English")}
                      </Button>
                      <Button
                        className="secondary"
                        onClick={() => downloadBackup(entries, "json")}
                      >
                        <ArrowDownToLine size={16} />
                        JSON
                      </Button>
                      <Button
                        className="secondary"
                        onClick={() => downloadBackup(entries, "csv")}
                      >
                        <ArrowDownToLine size={16} />
                        CSV
                      </Button>
                      <Button
                        className="secondary"
                        onClick={() => file.current?.click()}
                      >
                        {t("Import backup", "استيراد نسخة")}
                      </Button>
                      {!demo && (
                        <form action={signOut}>
                          <Button className="secondary">
                            <LogOut size={16} />
                            {t("Sign out", "خروج")}
                          </Button>
                        </form>
                      )}
                    </div>
                    <input
                      ref={file}
                      hidden
                      type="file"
                      accept=".json,.csv"
                      onChange={async (event) => {
                        const selected = event.target.files?.[0];
                        event.target.value = "";
                        if (!selected) return;
                        try {
                          const restored = await readBackup(selected);
                          if (
                            window.confirm(
                              t(
                                "Replace the current workspace with this backup?",
                                "استبدال المساحة الحالية بهذه النسخة؟",
                              ),
                            ) &&
                            (await change(() => restored))
                          )
                            setNotice(
                              t("Backup restored.", "تم استرجاع النسخة."),
                            );
                        } catch {
                          setNotice(
                            t("Invalid backup file.", "ملف النسخة غير صالح."),
                          );
                        }
                      }}
                    />
                    {demo && (
                      <p>
                        {t(
                          "Browser storage is active. Connect a database to sync devices.",
                          "التخزين في المتصفح مفعّل. اربطي قاعدة بيانات للمزامنة.",
                        )}
                      </p>
                    )}
                  </section>
                  <section className="card panel">
                    <h2>{t("Customize workspace", "تخصيص مساحة العمل")}</h2>
                    <div className="toolbar">
                      {(
                        [
                          "tracker",
                          "course",
                          "section",
                          "project",
                          "reward",
                          "metric",
                          "category",
                        ] as const
                      ).map((kind) => (
                        <Button
                          key={kind}
                          className="secondary"
                          onClick={() => open(kind)}
                        >
                          <Plus size={15} />
                          {t(
                            kind,
                            {
                              tracker: "عادة",
                              course: "مقرر",
                              section: "قسم",
                              project: "مشروع",
                              reward: "مكافأة",
                              metric: "مؤشر",
                              category: "تصنيف",
                            }[kind],
                          )}
                        </Button>
                      ))}
                    </div>
                    {entries
                      .filter((e) =>
                        [
                          "tracker",
                          "course",
                          "section",
                          "project",
                          "reward",
                          "task",
                          "milestone",
                          "metric",
                          "category",
                        ].includes(e.kind),
                      )
                      .map((e) => (
                        <div className="record" key={e.id}>
                          <button onClick={() => edit(e)}>
                            {label(e)}{" "}
                            {e.archived && t("(archived)", "(مؤرشف)")}
                          </button>
                          <div className="record-actions">
                            <button
                              aria-label={t("Move up", "تحريك للأعلى")}
                              onClick={() => reorder(e, -1)}
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              aria-label={t("Move down", "تحريك للأسفل")}
                              onClick={() => reorder(e, 1)}
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              onClick={() =>
                                void change((old) =>
                                  old.map((item) =>
                                    item.id === e.id
                                      ? { ...item, archived: !item.archived }
                                      : item,
                                  ),
                                )
                              }
                            >
                              {e.archived
                                ? t("Restore", "استعادة")
                                : t("Archive", "أرشفة")}
                            </button>
                            <button onClick={() => remove(e)}>
                              {t("Delete", "حذف")}
                            </button>
                          </div>
                        </div>
                      ))}
                  </section>
                </div>
              ) : (
                <WorkspacePanel
                  key={page}
                  page={page}
                  entries={active}
                  allEntries={entries}
                  change={change}
                  open={open}
                  edit={edit}
                  remove={remove}
                  today={today}
                  balance={balance}
                  t={t}
                  label={label}
                  focusCard={focusCard}
                  notify={setNotice}
                />
              )}
            </>
          )}
        </main>
      </div>
      <button
        className="floating-capture"
        onClick={() => open("inbox")}
        aria-label={t("Quick capture", "إضافة سريعة")}
      >
        <Plus size={25} />
      </button>
      <nav className="bottom-nav">
        {[
          navigation[0],
          navigation[1],
          navigation[2],
          navigation[4],
          navigation[8],
        ].map(([name, arabic, Icon]) => (
          <button
            key={name}
            onClick={() => setPage(name)}
            className={page === name ? "active" : ""}
          >
            <Icon size={20} />
            <span>
              {t(
                name === "Habits & Quran"
                  ? "Habits"
                  : name === "Academic Hub"
                    ? "Study"
                    : name === "Dev Projects"
                      ? "Projects"
                      : name,
                arabic,
              )}
            </span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label={t("Dismiss", "إغلاق")}
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {editor && (
        <Editor
          key={editor.entry?.id ?? editor.kind}
          request={editor}
          entries={active}
          busy={busy}
          t={t}
          label={label}
          cancel={() => setEditor(undefined)}
          save={saveEdit}
        />
      )}
    </div>
  );
}
