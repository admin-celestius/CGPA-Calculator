export type Subject = { name: string; credits: number; grade: string };
export type CalculatorInputs = { name: string; subjects: Subject[]; previousCGPA: number };
export type HistoryEntry = CalculatorInputs & {
  id: string;
  savedAt: string;
  result: { sgpa: number; cgpa: number };
};
export const HISTORY_KEY = "celestius-gpa-history";
const grades = ["", "O", "A+", "A", "B+", "B", "C", "RE"];
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseInputs(value: unknown): CalculatorInputs {
  if (!record(value) || typeof value.name !== "string" || !finite(value.previousCGPA) ||
      !Array.isArray(value.subjects)) throw new Error("Invalid calculator inputs");
  const subjects = value.subjects.map((subject: unknown) => {
    if (!record(subject) || typeof subject.name !== "string" || !finite(subject.credits) ||
        typeof subject.grade !== "string" || !grades.includes(subject.grade)) {
      throw new Error("Invalid subject");
    }
    return { name: subject.name, credits: subject.credits, grade: subject.grade };
  });
  return { name: value.name, previousCGPA: value.previousCGPA, subjects };
}

export function parseHistory(value: unknown): HistoryEntry[] {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    throw new Error("Invalid or unsupported history file");
  }
  return value.entries.map((entry: unknown) => {
    const inputs = parseInputs(entry);
    if (!record(entry) || typeof entry.id !== "string" || !entry.id.trim() ||
        typeof entry.savedAt !== "string" || !Number.isFinite(Date.parse(entry.savedAt)) ||
        !record(entry.result) || !finite(entry.result.sgpa) || !finite(entry.result.cgpa)) {
      throw new Error("Invalid history entry");
    }
    return { ...inputs, id: entry.id, savedAt: entry.savedAt,
      result: { sgpa: entry.result.sgpa, cgpa: entry.result.cgpa } };
  });
}

export function mergeHistory(existing: HistoryEntry[], incoming: HistoryEntry[]): HistoryEntry[] {
  const entries = new Map<string, HistoryEntry>();
  // Existing entries win when an imported ID is already present.
  for (const entry of [...existing, ...incoming]) {
    if (!entries.has(entry.id)) entries.set(entry.id, entry);
  }
  return [...entries.values()].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt)).slice(0, 20);
}

export function serializeHistory(entries: HistoryEntry[]) {
  return JSON.stringify({ version: 1, entries }, null, 2);
}

export function inputsFromHash(hash: string): CalculatorInputs | null {
  if (!hash.startsWith("#calculator=")) return null;
  const value: unknown = JSON.parse(decodeURIComponent(hash.slice("#calculator=".length)));
  if (!record(value) || value.version !== 1) throw new Error("Invalid share link");
  return parseInputs(value);
}

export function inputsToHash(inputs: CalculatorInputs) {
  return `#calculator=${encodeURIComponent(JSON.stringify({ version: 1, ...inputs }))}`;
}
