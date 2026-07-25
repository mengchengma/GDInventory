"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BACKGROUND_PRESETS,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type SlideshowSettings,
} from "@/lib/eventSettings";

export default function SettingsClient() {
  const [settings, setSettings] = useState<SlideshowSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveSettings(settings);
  }, [settings, ready]);

  const update = <K extends keyof SlideshowSettings>(
    key: K,
    value: SlideshowSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const speedSec = Math.round(settings.speedMs / 1000);
  const isCustomBg = !BACKGROUND_PRESETS.some((p) => p.value === settings.background);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to slideshow
        </Link>
        <button
          onClick={() => setSettings(DEFAULT_SETTINGS)}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Reset to defaults
        </button>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Slideshow settings
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Changes save automatically and are stored on this device.
        </p>
      </div>

      {/* Preview */}
      <div
        className="relative mb-6 flex h-40 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 text-xs uppercase tracking-[0.2em] text-white/60"
        style={{ background: settings.background }}
      >
        Preview
      </div>

      <div className="space-y-6">
        <Section
          title="Auto-advance speed"
          hint={`Each slide shows for ${speedSec}s`}
        >
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={speedSec}
            onChange={(e) =>
              update("speedMs", Math.max(2000, Number(e.target.value) * 1000))
            }
            className="w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-600">
            <span>2s</span>
            <span>15s</span>
            <span>30s</span>
          </div>
        </Section>

        <Section title="Background">
          <div className="flex flex-wrap gap-2">
            {BACKGROUND_PRESETS.map((p) => {
              const selected = settings.background === p.value;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => update("background", p.value)}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                    selected
                      ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-200"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded border border-zinc-700"
                    style={{ background: p.value }}
                  />
                  {p.name}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <label className="text-zinc-500">Custom color</label>
            <input
              type="color"
              value={
                isCustomBg && /^#[0-9a-fA-F]{6}$/.test(settings.background)
                  ? settings.background
                  : "#000000"
              }
              onChange={(e) => update("background", e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
            />
            <input
              type="text"
              value={settings.background}
              onChange={(e) => update("background", e.target.value)}
              placeholder="#000000 or linear-gradient(…)"
              className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500/60"
            />
          </div>
        </Section>

        <Section title="Image fit">
          <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              type="button"
              onClick={() => update("fit", "contain")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                settings.fit === "contain"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Contain (show whole photo)
            </button>
            <button
              type="button"
              onClick={() => update("fit", "cover")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                settings.fit === "cover"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Cover (fill screen)
            </button>
          </div>
        </Section>
      </div>

      <footer className="mt-10 pb-6 text-center text-[10px] text-zinc-600">
        Settings are per-device (localStorage). Clear your browser data to reset.
      </footer>
    </main>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
