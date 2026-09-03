"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, FormEvent } from "react";

// ────────────────────────────────────────────────────────────
// Register member — wraps the iCafeCloud member portal in Gaming Dojo chrome.
//
// ?request_type=register opens the registration modal on load, so the customer
// never has to find the "Create a New Account" link on the sign-in screen. The
// portal declares that modal data-backdrop="static" data-keyboard="false", so a
// stray tap outside it won't dismiss it back to the login form.
//
// ?dName tags which station the signup came from — it lands in the member's
// pc_name field.
//
// Everything inside the frame is cross-origin: we cannot restyle it, hide its
// sign-in form, read what was typed, or clear its session. Those are the limits
// of wrapping someone else's page.
// ────────────────────────────────────────────────────────────

const PORTAL_URL =
  "https://cp.icafecloud.com/shop/000115961189?request_type=register&dName=Front%20Desk%20Tablet";

/** No parent-visible activity for this long → ask whether they're still there. */
const IDLE_PROMPT_MS = 90_000;
/** Unanswered prompt for this long → reload the frame for the next customer.
 *  NOTE: this reloads the form but does NOT clear the portal's sessionStorage,
 *  which is cross-origin. If a customer completed signup they stay logged in
 *  inside the frame. Clearing that is a Fully Kiosk Browser setting, not ours. */
const IDLE_GRACE_MS = 20_000;
/** Iframe silent past this → assume framing is blocked and offer the direct link. */
const FRAME_TIMEOUT_MS = 6_000;

const LOCK_KEY = "gd_kiosk_locked";

export default function MembersClient() {
  const [locked, setLocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Bumped to remount the iframe — the only way to reset a cross-origin form.
  const [frameNonce, setFrameNonce] = useState(0);

  const resetFrame = useCallback(() => setFrameNonce((n) => n + 1), []);

  // Restore the lock before the customer can exploit a reload to escape it.
  useEffect(() => {
    try {
      setLocked(sessionStorage.getItem(LOCK_KEY) === "1");
    } catch {
      /* private mode — default to unlocked staff view */
    }
    setHydrated(true);
  }, []);

  // Held while locked so Android doesn't dim and sleep mid-signup. The browser
  // drops it whenever the page is hidden, so it is re-acquired on return.
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = useCallback(async () => {
    try {
      wakeLock.current = await navigator.wakeLock?.request("screen");
    } catch {
      /* unsupported, or denied on a non-secure origin — not fatal */
    }
  }, []);

  const lock = useCallback(() => {
    try {
      sessionStorage.setItem(LOCK_KEY, "1");
    } catch {
      /* ignore */
    }
    setLocked(true);

    // Must run inside this tap: browsers only grant fullscreen on a gesture.
    document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {
      /* refused (desktop Safari, embedded webviews) — the page still works */
    });
    void acquireWakeLock();
  }, [acquireWakeLock]);

  const unlock = useCallback(() => {
    try {
      sessionStorage.removeItem(LOCK_KEY);
    } catch {
      /* ignore */
    }
    setLocked(false);

    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  // Android releases the wake lock on tab switch or screen-off; take it back.
  useEffect(() => {
    if (!locked) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [locked, acquireWakeLock]);

  // Opt this route out of the app-wide fixed-attachment background, which
  // smears under the iframe. See body.kiosk-mode in globals.css.
  useEffect(() => {
    document.body.classList.add("kiosk-mode");
    return () => document.body.classList.remove("kiosk-mode");
  }, []);

  // Trap the hardware back button while locked. Re-pushing on every popstate
  // means the customer stays put; staff leave via the PIN instead.
  useEffect(() => {
    if (!locked) return;
    history.pushState({ kiosk: true }, "");
    const onPop = () => history.pushState({ kiosk: true }, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [locked]);

  if (!hydrated) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950">
      {locked ? (
        <LockedBar onDone={resetFrame} />
      ) : (
        <StaffBar onLock={lock} />
      )}
      <PortalFrame locked={locked} nonce={frameNonce} onReset={resetFrame} />
      {locked && <StaffExit onUnlock={unlock} />}
    </div>
  );
}

// ── Chrome ──────────────────────────────────────────────────

function StaffBar({ onLock }: { onLock: () => void }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-900/80 bg-zinc-950/50 px-4 py-3 backdrop-blur sm:px-6">
      <Link
        href="/"
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
          aria-hidden
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to hub
      </Link>

      <div className="hidden text-center sm:block">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
          Gaming Dojo
        </div>
        <div className="text-sm font-semibold text-zinc-100">
          Register member
        </div>
      </div>

      <button
        onClick={onLock}
        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
      >
        Hand to customer
      </button>
    </header>
  );
}

/**
 * Locked chrome — the only Gaming Dojo branding in the flow, since the framed
 * portal renders iCafeCloud's own artwork and we cannot restyle it.
 *
 * The "Done" action is here because registration success is UNDETECTABLE from
 * this side: the portal submits over AJAX and only shows a toast, so there is
 * no load event, no postMessage, and no readable URL. An explicit tap is the
 * only honest signal that one customer has finished and the next can start.
 */
function LockedBar({ onDone }: { onDone: () => void }) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-emerald-500/20 bg-zinc-950 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
          Gaming Dojo
        </div>
        <h1 className="mt-0.5 text-base font-bold tracking-tight text-zinc-50 sm:text-lg">
          Create your account
        </h1>
        <p className="mt-0.5 text-xs text-zinc-400">
          Fill in the form below — then sign in at any PC.
        </p>
      </div>

      <button
        onClick={onDone}
        className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-semibold text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-300 active:scale-95"
      >
        Done
      </button>
    </header>
  );
}

// ── The portal frame ────────────────────────────────────────

function PortalFrame({
  locked,
  nonce,
  onReset,
}: {
  locked: boolean;
  nonce: number;
  onReset: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // A remount starts the load-watchdog over.
  useEffect(() => {
    setLoaded(false);
    setBlocked(false);
  }, [nonce]);

  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setBlocked(true), FRAME_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loaded, nonce]);

  return (
    <div className="relative flex-1">
      <iframe
        key={nonce}
        src={PORTAL_URL}
        title="iCafeCloud member portal"
        onLoad={() => setLoaded(true)}
        className="h-full w-full border-0"
      />

      {blocked && !loaded && <FrameFallback />}
      {locked && <IdleReset key={nonce} onReset={onReset} />}
    </div>
  );
}

/**
 * Shown when the portal never loads. iCafeCloud currently sends no
 * X-Frame-Options or CSP frame-ancestors, but that is their choice to reverse
 * at any time — this degrades to a plain hand-off instead of a blank rectangle.
 */
function FrameFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <p className="text-sm text-zinc-400">
        The registration page couldn&rsquo;t load here.
      </p>
      <a
        href={PORTAL_URL}
        className="rounded-xl bg-emerald-500 px-6 py-3 text-base font-semibold text-zinc-950 transition hover:bg-emerald-400"
      >
        Tap to continue
      </a>
    </div>
  );
}

// ── Idle handling ───────────────────────────────────────────

/**
 * A cross-origin iframe swallows every touch and keypress, so the parent gets
 * NO signal while a customer fills in the form. A silent timer would therefore
 * wipe the form out from under someone mid-signup.
 *
 * So it asks first. An abandoned tablet ignores the prompt and resets; a
 * customer who is still typing taps once and carries on.
 */
function IdleReset({ onReset }: { onReset: () => void }) {
  const [prompting, setPrompting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prompting) return;
    timer.current = setTimeout(() => setPrompting(true), IDLE_PROMPT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [prompting]);

  useEffect(() => {
    if (!prompting) return;
    const t = setTimeout(() => {
      setPrompting(false);
      onReset();
    }, IDLE_GRACE_MS);
    return () => clearTimeout(t);
  }, [prompting, onReset]);

  if (!prompting) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-zinc-950/95 px-6 text-center backdrop-blur">
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Still there?</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This will start over in a moment.
        </p>
      </div>
      <button
        onClick={() => setPrompting(false)}
        className="rounded-xl bg-emerald-500 px-8 py-4 text-base font-semibold text-zinc-950 transition hover:bg-emerald-400"
      >
        I&rsquo;m still here
      </button>
    </div>
  );
}

// ── Staff exit ──────────────────────────────────────────────

/**
 * Small, low-contrast corner target — reachable by staff who know it's there,
 * unremarkable to a customer. Five taps guards against a curious thumb.
 */
function StaffExit({ onUnlock }: { onUnlock: () => void }) {
  const [taps, setTaps] = useState(0);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = taps >= 5;

  function close() {
    setTaps(0);
    setPin("");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kiosk/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Incorrect PIN");
      }
      onUnlock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect PIN");
      setPin("");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setTaps((t) => t + 1)}
        aria-label="Staff exit"
        className="fixed bottom-0 right-0 z-20 h-14 w-14 opacity-0"
      />
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-zinc-950/90 px-6 backdrop-blur">
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-zinc-100">Staff exit</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Enter the PIN to unlock this tablet.
        </p>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
          autoFocus
          className="mt-4 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-center text-lg tracking-[0.4em] text-zinc-50 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
        />

        {error && (
          <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "…" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
