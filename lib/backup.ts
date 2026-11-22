import { validEntries, type Entry } from "./model";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || !field) quoted = !quoted;
      else throw new Error("Unexpected quote.");
    } else if (!quoted && char === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\r" || char === "\n")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("Unclosed CSV field.");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function downloadBackup(entries: Entry[], format: "json" | "csv") {
  const data =
    format === "json"
      ? JSON.stringify({ schema: 1, entries }, null, 2)
      : [
          "id,kind,record_json",
          ...entries.map((entry) =>
            [entry.id, entry.kind, JSON.stringify(entry)]
              .map((value) => '"' + value.replaceAll('"', '""') + '"')
              .join(","),
          ),
        ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([data], {
      type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "hayati-backup." + format;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readBackup(file: File): Promise<Entry[]> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Backup is too large.");
  const text = await file.text();
  let data: unknown;
  if (file.name.toLowerCase().endsWith(".csv")) {
    const [header, ...records] = parseCsv(text);
    if (header?.join(",") !== "id,kind,record_json")
      throw new Error("Invalid CSV backup header.");
    data = records.map((row) => JSON.parse(row[2]));
  } else {
    const backup = JSON.parse(text);
    if (backup?.schema !== 1) throw new Error("Unsupported backup schema.");
    data = backup.entries;
  }
  if (!validEntries(data)) throw new Error("Invalid backup.");
  return data;
}
