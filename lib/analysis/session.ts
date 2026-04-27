export type AnalysisSessionPayload = {
  source: "bot" | "online";
  title: string;
  fens: string[];
};

const KEY_PREFIX = "hyperchess:analysis:";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function saveAnalysisSession(payload: AnalysisSessionPayload): string {
  const id = makeId();
  sessionStorage.setItem(`${KEY_PREFIX}${id}`, JSON.stringify(payload));
  return id;
}

export function loadAnalysisSession(id: string): AnalysisSessionPayload | null {
  const raw = sessionStorage.getItem(`${KEY_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalysisSessionPayload;
  } catch {
    return null;
  }
}

