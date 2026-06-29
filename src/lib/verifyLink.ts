// Verification settings — stored in Supabase (verify_config table).
// The share link uses a short token that references the DB row.
// The page /verify reads the token from the URL and calls the edge function.

const LOCAL_KEY = "chronoconf.verify.settings.v4";

export interface VerifySettings {
  token: string;
  conferenceId: string;
  note: string;
  contact: string;
  deadline: string; // ISO date string or ""
  editableCols: string[]; // empty = all editable
}

export const DEFAULT_SETTINGS: VerifySettings = {
  token: "",
  conferenceId: "",
  note: "",
  contact: "",
  deadline: "",
  editableCols: [],
};

/** Read cached settings from localStorage (fallback) */
export function getCachedSettings(): VerifySettings {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function cacheSettings(s: VerifySettings) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
}

/** Build the public share link from a token */
export function buildShareLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/verify?t=${encodeURIComponent(token)}`;
}

/** Extract token from URL search params */
export function getTokenFromUrl(search = window.location.search): string | null {
  return new URLSearchParams(search).get("t");
}
