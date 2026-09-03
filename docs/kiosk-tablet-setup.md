# Kiosk tablet setup — Register Member

The `/members` page wraps the iCafeCloud member portal in Gaming Dojo chrome and
locks the tablet to it. Three layers keep a customer on that screen; only the
third is an actual boundary.

| Layer | What it does | Escapable? |
|---|---|---|
| Fullscreen API | Hides Chrome's URL bar on "Hand to customer" | Yes — swipe down |
| PWA (Add to Home Screen) | Launches with no browser UI at all | Yes — back / app switcher |
| Fully Kiosk Browser | Blocks system UI, Home, and app switching | No, without the PIN |

Run all three. Fully Kiosk is not optional — see "Why Fully Kiosk is required".

## 1. Vercel environment

Set before deploying:

    KIOSK_EXIT_PIN=<pick your own>

This releases the customer lock. It is compared server-side, so it never reaches
the browser. Do not reuse the local dev value (`1234`).

## 2. Install as a home-screen app

1. Open `https://gdhub.vercel.app` in Android Chrome, sign in as staff.
2. Menu (⋮) → **Add to Home Screen** → Install.
3. The icon opens straight to `/members` (`start_url` in `src/app/manifest.ts`).

The session cookie lasts 30 days, so staff sign in rarely. When it lapses the
app opens on the login screen instead — sign in and it returns to normal.

## 3. Fully Kiosk Browser

Free tier is sufficient. Install from Play Store, then:

**Web Content Settings**
- Start URL: `https://gdhub.vercel.app/members`

**Kiosk Mode**
- Enable Kiosk Mode: ON
- Disable Status Bar / Navigation Bar: ON
- Set as Home App (launcher): ON — otherwise the Home button escapes
- Kiosk Exit PIN: set one (this is Fully Kiosk's own PIN, separate from
  `KIOSK_EXIT_PIN`)

**Device Settings**
- Keep Screen On: ON
- Screensaver / Motion Detection: OFF

**Advanced Web Settings — REQUIRED**
- Clear Cache on Restart: ON
- **Clear Cookies and Web Storage on Restart: ON**
- Restart interval: nightly, or per session

### Why Fully Kiosk is required

When a customer finishes registering, the iCafeCloud portal logs them in and
stores a session token in `sessionStorage` on `cp.icafecloud.com`.

That frame is cross-origin. Our page cannot read it, cannot clear it, and
cannot detect that registration happened at all — reloading the iframe resets
the *form* but leaves that session intact. **Without Fully Kiosk clearing web
storage, one customer's logged-in account can carry over to the next.**

The "Done" button and the idle prompt reset the form. Only Fully Kiosk clears
the session.

## 4. Daily operation

1. Tablet boots into Fully Kiosk at `/members` (staff view).
2. Staff taps **Hand to customer** — locks, goes fullscreen, holds a wake lock.
3. Customer fills in the registration form, which opens automatically
   (`?request_type=register`).
4. Staff taps **Done** to reset for the next person.
5. To take the tablet back: tap the bottom-right corner **5 times**, enter
   `KIOSK_EXIT_PIN`.

Signups are tagged `dName=Front Desk Tablet`, which lands in the member's
`pc_name` field — useful for telling kiosk signups from PC-side ones.

## Known limits

These follow from wrapping a page we don't control, and none are fixable from
our side:

- The portal renders iCafeCloud's artwork, not ours. Only the top bar is ours.
- Its sign-in form cannot be hidden. `?request_type=register` opens the
  registration modal over it, and that modal ignores tap-outside and Escape,
  but **Cancel** and **X** still reveal the login screen behind it.
- Registration success is undetectable, so resets are manual or idle-based.
- The portal's session cannot be cleared by us — see above.

All four disappear if registration moves to the documented iCafeCloud API
(`api.icafecloud.com`), where the form would be ours. That path needs an admin
API key bound to a static IP, which Vercel does not provide.
