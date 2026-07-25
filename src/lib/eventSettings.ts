// Slideshow preferences stored client-side in localStorage.

export type SlideshowSettings = {
  speedMs: number;
  background: string; // CSS color or gradient
  fit: "contain" | "cover";
  showControls: boolean;
};

export const DEFAULT_SETTINGS: SlideshowSettings = {
  speedMs: 6000,
  background: "#000000",
  fit: "contain",
  showControls: true,
};

export const BACKGROUND_PRESETS: Array<{ name: string; value: string }> = [
  { name: "Black", value: "#000000" },
  { name: "Dark gray", value: "#111114" },
  { name: "Emerald mist", value: "linear-gradient(135deg,#02100c 0%,#0a1d16 100%)" },
  { name: "Violet dusk", value: "linear-gradient(135deg,#0d0817 0%,#1a0f2a 100%)" },
  { name: "Warm ember", value: "linear-gradient(135deg,#1a0a05 0%,#2a1408 100%)" },
];

const STORAGE_KEY = "gd_slideshow_settings";

export function loadSettings(): SlideshowSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SlideshowSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      speedMs: clampSpeed(parsed.speedMs ?? DEFAULT_SETTINGS.speedMs),
      fit: parsed.fit === "cover" ? "cover" : "contain",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: SlideshowSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clampSpeed(ms: number): number {
  const n = Number(ms);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.speedMs;
  return Math.min(30000, Math.max(2000, Math.trunc(n)));
}
