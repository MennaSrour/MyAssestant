"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mic, X } from "lucide-react";
import { dayKey, newEntry, type Entry, type Kind } from "@/lib/model";
import { Button } from "./ui/button";

export type EditRequest = {
  kind: Kind;
  entry?: Entry;
  fields?: Partial<Entry>;
};
export type Translate = (english: string, arabic: string) => string;
type Speech = {
  lang: string;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
const titles: Record<Kind, [string, string]> = {
  tracker: ["Habit or tracker", "عادة أو متابع"],
  log: ["Tracker entry", "سجل المتابعة"],
  course: ["Course", "مقرر"],
  module: ["Study module", "وحدة دراسية"],
  section: ["Teaching section", "قسم تدريسي"],
  student: ["Student", "طالب"],
  session: ["Attendance session", "جلسة حضور"],
  submission: ["Assignment submission", "تسليم واجب"],
  project: ["Project", "مشروع"],
  task: ["Task", "مهمة"],
  milestone: ["Milestone", "مرحلة"],
  reward: ["Reward", "مكافأة"],
  redemption: ["Redemption", "استبدال"],
  inbox: ["Quick capture", "إضافة سريعة"],
  focus: ["Focus session", "جلسة تركيز"],
  metric: ["Dashboard metric", "مؤشر لوحة التحكم"],
  category: ["Category", "تصنيف"],
  distraction: ["Distraction log", "سجل التشتت"],
};
export function Editor({
  request,
  entries,
  busy,
  t,
  label,
  cancel,
  save,
}: {
  request: EditRequest;
  entries: Entry[];
  busy: boolean;
  t: Translate;
  label: (e: Entry) => string;
  cancel: () => void;
  save: (entry: Entry) => Promise<boolean>;
}) {
  const { kind } = request;
  const [item, setItem] = useState<Entry>(
    () =>
      request.entry ??
      newEntry(kind, "", {
        ...(kind === "task"
          ? { value: 1 }
          : kind === "project"
            ? { columns: ["To do", "In progress", "Done"] }
            : kind === "submission"
              ? { status: "submitted" }
              : {}),
        ...request.fields,
      }),
  );
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const microphone = useRef<Speech>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      microphone.current?.stop();
    };
  }, []);
  const set = <K extends keyof Entry>(key: K, value: Entry[K]) =>
    setItem((old) => ({ ...old, [key]: value }));
  const input = (
    key: keyof Entry,
    name: string,
    type = "text",
    required = false,
    min = 0,
  ) => (
    <label>
      {name}
      <input
        type={type}
        dir={type === "text" ? "auto" : undefined}
        required={required}
        min={type === "number" ? min : undefined}
        step={type === "number" ? "any" : undefined}
        maxLength={key === "title" || key === "ar" ? 500 : undefined}
        value={String(item[key] ?? "")}
        onChange={(event) =>
          set(
            key,
            type === "number"
              ? event.target.value === ""
                ? undefined
                : Number(event.target.value)
              : event.target.value,
          )
        }
      />
    </label>
  );
  const select = (
    key: keyof Entry,
    name: string,
    options: [string, string][],
    placeholder?: string,
  ) => (
    <label>
      {name}
      <select
        value={String(
          item[key] ?? (placeholder ? "" : (options[0]?.[0] ?? "")),
        )}
        onChange={(event) => set(key, event.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  function dictate() {
    if (listening) {
      microphone.current?.stop();
      return;
    }
    const browser = window as unknown as {
      SpeechRecognition?: new () => Speech;
      webkitSpeechRecognition?: new () => Speech;
    };
    const Recognition =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        t(
          "Voice dictation is unavailable in this browser.",
          "الإملاء الصوتي غير متاح في هذا المتصفح.",
        ),
      );
      return;
    }
    const speech = new Recognition();
    microphone.current = speech;
    speech.lang = t("en-US", "ar-EG");
    speech.onresult = (event) => {
      const result = event.results[0][0].transcript.trim();
      setItem((old) => ({
        ...old,
        title: old.title || result.slice(0, 500),
        detail: [old.detail, result].filter(Boolean).join("\n"),
      }));
    };
    speech.onerror = () => {
      setListening(false);
      setError(
        t(
          "Dictation failed. Check microphone access.",
          "تعذّر الإملاء. تحقّقي من إذن الميكروفون.",
        ),
      );
    };
    speech.onend = () => setListening(false);
    try {
      speech.start();
      setListening(true);
      setError("");
    } catch {
      setListening(false);
      setError(t("Could not start dictation.", "تعذّر تشغيل الإملاء."));
    }
  }
  const project = entries.find(
    (e) => e.id === item.parent && e.kind === "project",
  );
  const columns = project?.columns ?? [];
  const range = item.type === "range";
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !item.title.trim() ||
      (range &&
        kind === "log" &&
        (!item.surah ||
          !Number.isInteger(item.start) ||
          !Number.isInteger(item.end) ||
          item.end! < item.start!))
    ) {
      setError(
        t(
          "Enter a title and a valid verse range where required.",
          "أدخلي عنوانًا ونطاق آيات صالحًا عند الحاجة.",
        ),
      );
      return;
    }
    const next = { ...item, title: item.title.trim() };
    if (kind === "tracker") {
      next.type ??= "boolean";
      next.cadence ??= "daily";
      next.target = next.type === "boolean" ? 1 : next.target || 1;
    }
    if (kind === "log") {
      next.date ||= dayKey();
      next.value = range ? 1 : (next.value ?? 1);
    }
    if (kind === "project") {
      next.columns = [
        ...new Set((next.columns ?? []).map((s) => s.trim()).filter(Boolean)),
      ];
      if (!next.columns.length) {
        setError(
          t("Add at least one Kanban column.", "أضيفي عمودًا واحدًا على الأقل."),
        );
        return;
      }
    }
    if (kind === "task") {
      next.status ||= columns[0] ?? "";
      next.type ||= "feature";
    }
    if (kind === "inbox") next.type ||= "note";
    if (kind === "metric") next.type ||= "completed";
    setError("");
    void save(next).then((saved) => {
      if (!saved)
        setError(
          t(
            "Save did not complete. Review your data and try again.",
            "لم يكتمل الحفظ. راجعي بياناتك وحاولي مجددًا.",
          ),
        );
    });
  }
  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="editor-title"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      <form className="stack" onSubmit={submit}>
        <div className="dialog-head">
          <h2 id="editor-title">{t(...titles[kind])}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={cancel}
            aria-label={t("Close", "إغلاق")}
          >
            <X size={20} />
          </button>
        </div>
        {input("title", t("Title", "العنوان"), "text", true)}
        {[
          "tracker",
          "course",
          "section",
          "project",
          "reward",
          "metric",
          "category",
        ].includes(kind) &&
          input(
            "ar",
            t("Arabic title (optional)", "العنوان بالعربية (اختياري)"),
          )}
        {[
          "tracker",
          "course",
          "section",
          "project",
          "task",
          "reward",
          "inbox",
        ].includes(kind) &&
          entries.some((entry) => entry.kind === "category") &&
          select(
            "category",
            t("Category", "التصنيف"),
            entries
              .filter((entry) => entry.kind === "category")
              .map((entry) => [entry.id, label(entry)]),
            t("No category", "بدون تصنيف"),
          )}
        {kind === "metric" &&
          select("type", t("Metric source", "مصدر المؤشر"), [
            ["completed", t("Completed trackers", "العادات المكتملة")],
            ["streak", t("Activity streak", "تتابع النشاط")],
            ["focus", t("Focus minutes", "دقائق التركيز")],
            ["xp", t("XP balance", "رصيد النقاط")],
            ["inbox", t("Inbox count", "عدد عناصر الوارد")],
            ["distractions", t("Distraction minutes", "دقائق التشتت")],
          ])}
        {kind === "distraction" && (
          <div className="form-grid">
            {input("date", t("Date", "التاريخ"), "date", true)}
            {input("value", t("Minutes", "الدقائق"), "number", true, 1)}
          </div>
        )}
        {kind === "tracker" && (
          <div className="form-grid">
            {select("type", t("Input type", "نوع الإدخال"), [
              ["boolean", t("Checkbox", "علامة اختيار")],
              ["number", t("Numeric counter", "عداد رقمي")],
              ["range", t("Surah / Ayah range", "نطاق السورة والآيات")],
            ])}
            {select("cadence", t("Schedule", "التكرار"), [
              ["daily", t("Daily", "يومي")],
              ["weekly", t("Weekly", "أسبوعي")],
            ])}
            {item.type &&
              item.type !== "boolean" &&
              input("target", t("Target", "الهدف"), "number", true, 0.001)}
            {item.type === "number" && input("unit", t("Unit", "الوحدة"))}
          </div>
        )}
        {kind === "tracker" &&
          select("color", t("Tracker color", "لون المتابع"), [
            ["mint", t("Mint", "نعناعي")],
            ["blue", t("Blue", "أزرق")],
            ["violet", t("Violet", "بنفسجي")],
            ["peach", t("Peach", "خوخي")],
          ])}
        {kind === "tracker" && item.type === "range" && (
          <div className="form-grid">
            {input("surah", t("Default surah", "السورة الافتراضية"))}
            {input("juz", t("Default juz", "الجزء الافتراضي"))}
          </div>
        )}
        {kind === "log" && (
          <div className="form-grid">
            {input("date", t("Date", "التاريخ"), "date", true)}
            {item.type === "number" &&
              input(
                "value",
                item.unit || t("Amount", "الكمية"),
                "number",
                true,
              )}
            {range && (
              <>
                {input("surah", t("Surah", "السورة"), "text", true)}
                {input("juz", t("Juz (optional)", "الجزء (اختياري)"))}
                {input(
                  "start",
                  t("First ayah", "الآية الأولى"),
                  "number",
                  true,
                  1,
                )}
                {input(
                  "end",
                  t("Last ayah", "الآية الأخيرة"),
                  "number",
                  true,
                  1,
                )}
              </>
            )}
          </div>
        )}
        {["tracker", "task", "reward"].includes(kind) &&
          input(
            "xp",
            kind === "reward"
              ? t("XP cost", "تكلفة النقاط")
              : t("XP earned", "النقاط المكتسبة"),
            "number",
            kind === "reward",
            kind === "reward" ? 1 : 0,
          )}
        {kind === "project" && (
          <label>
            {t("Kanban columns, one per line", "أعمدة كانبان، عمود في كل سطر")}
            <textarea
              required
              value={(item.columns ?? ["To do", "In progress", "Done"]).join(
                "\n",
              )}
              onChange={(e) => set("columns", e.target.value.split("\n"))}
            />
          </label>
        )}
        {kind === "task" && (
          <div className="form-grid">
            {select("type", t("Backlog type", "نوع المهمة"), [
              ["feature", t("Feature", "ميزة")],
              ["bug", t("Bug", "خطأ")],
              ["task", t("Task", "مهمة")],
            ])}
            {select(
              "status",
              t("Column", "العمود"),
              columns.map((column) => [column, column]),
            )}
          </div>
        )}
        {["course", "session", "milestone", "submission"].includes(kind) &&
          input(
            "date",
            kind === "course"
              ? t("Exam date", "تاريخ الاختبار")
              : t("Date", "التاريخ"),
            "date",
            kind === "session" || kind === "milestone",
          )}
        {kind === "submission" && (
          <div className="form-grid">
            {select("status", t("Submission status", "حالة التسليم"), [
              ["submitted", t("Submitted", "تم التسليم")],
              ["missing", t("Missing", "لم يُسلّم")],
              ["graded", t("Graded", "مُقيّم")],
            ])}
            {input("value", t("Grade", "الدرجة"), "number")}
          </div>
        )}
        {kind === "session" && (
          <div className="attendance">
            {entries
              .filter((e) => e.kind === "student" && e.parent === item.parent)
              .map((student) => (
                <div className="record" key={student.id}>
                  <strong>{label(student)}</strong>
                  <div className="record-actions">
                    {[
                      ["present", t("Present", "حاضر")],
                      ["late", t("Late", "متأخر")],
                      ["absent", t("Absent", "غائب")],
                    ].map(([value, name]) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={item.attendance?.[student.id] === value}
                        onClick={() =>
                          set("attendance", {
                            ...item.attendance,
                            [student.id]: value,
                          })
                        }
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
        {kind === "inbox" && (
          <>
            {select("type", t("Capture type", "نوع الإضافة"), [
              ["note", t("Note", "ملاحظة")],
              ["link", t("Link", "رابط")],
              ["task", t("Task", "مهمة")],
              ["voice", t("Voice note", "ملاحظة صوتية")],
            ])}
            <Button className="secondary" type="button" onClick={dictate}>
              <Mic size={16} />
              {listening
                ? t("Stop dictation", "إيقاف الإملاء")
                : t("Dictate note", "إملاء ملاحظة")}
            </Button>
          </>
        )}
        {["course", "module", "inbox", "task"].includes(kind) &&
          input("link", t("Link", "الرابط"), "url")}
        <label>
          {kind === "project"
            ? t("Technical scratchpad (Markdown)", "ملاحظات تقنية (Markdown)")
            : range && kind === "log"
              ? t(
                  "Weak verses / Mutashabihat notes",
                  "ملاحظات الآيات الضعيفة والمتشابهات",
                )
              : t("Notes", "ملاحظات")}
          <textarea
            dir="auto"
            value={item.detail ?? ""}
            maxLength={60000}
            onChange={(e) => set("detail", e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <Button type="button" className="secondary" onClick={cancel}>
            {t("Cancel", "إلغاء")}
          </Button>
          <Button className="primary" disabled={busy}>
            {t("Save", "حفظ")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
