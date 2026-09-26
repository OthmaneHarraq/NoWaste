# NoWaste 🥬

A camera at the fridge sees what goes in and out, barcodes and AI identify it, and everyone in the household shares a live inventory with expiry warnings, so food gets eaten instead of thrown away.

**Stack:** Expo (React Native + web) · Expo Router · Tailwind (Uniwind) · Supabase (auth, Postgres, realtime, Edge Functions) · Google Gemini (free tier; Claude also supported) · Open Food Facts · ZXing / expo-camera barcode reading

---

## First-time setup (each teammate, ~15 min)

1. Install **Node.js LTS**, **Git**, **VS Code**, and **Expo Go** on your phone.
2. Clone and install:
   ```bash
   git clone https://github.com/OthmaneHarraq/NoWaste.git
   cd NoWaste
   npm install
   ```
3. Copy `.env.example` to `.env` (Windows: `copy .env.example .env`) and paste in the Supabase URL and anon key (ask in the group chat). The URL looks like `https://<project-id>.supabase.co`, not the dashboard link.
   Set `EXPO_PUBLIC_USE_MOCK_DATA=true` to skip all of that and run on demo data (see [Dashboard](#dashboard-web-tablet-phone)).
4. Run it:
   ```bash
   npx expo start
   ```
   Scan the QR code with Expo Go (Android) or the Camera app (iPhone). Press `w` to open it in the browser instead.
5. Sign up, create a fridge (or join with a teammate's code from their Settings tab), and use **Camera → Simulate a detection** to get test data.

> Changed `.env`? Restart with `npx expo start --clear`.
> **After every `git pull`, run `npm install`**: new features often add packages, and a missing one shows up as `Cannot find module …`.

## Supabase setup (one person, once)

1. Create a project at supabase.com.
2. **SQL Editor** → paste each file in `supabase/migrations/` → Run, **in name order**:
   1. `20260926000000_nowaste_schema.sql`: tables, security rules, `record_event` & co.
   2. `20260926120000_add_location_and_disposition.sql`: freezer/shelf location and eaten/binned/composted
   3. `20260926130000_ai_cache.sql`: cache for AI insights and recipes (optional)
   4. `20260926193000_smarter_expiry_matching.sql`: "oat milk" → milk, "cream cheese" beats "cheese". **Must run after #2.** Safe to re-run; re-run it if an older copy was run before #2 (symptom: every add/remove fails with *function record_event … is not unique*).
3. **Authentication → Sign In / Providers → Email**: for the hackathon you can turn off "Confirm email" so sign-ups work instantly.
4. **Organization settings → Team**: invite the rest of the group.
5. Share the Project URL and anon key in the group chat (not in git).
6. **AI (free with Gemini):** get a key at **aistudio.google.com → Get API key**, then in Supabase **Edge Functions → Secrets** add `GEMINI_API_KEY`. No redeploy is needed after changing a secret. (A paid `ANTHROPIC_API_KEY` also works for the camera functions; see `supabase/functions/_shared/vision.ts`.)
7. **Deploy the Edge Functions**, one command at a time (don't paste them together):
   ```bash
   npx supabase login
   npx supabase functions deploy detect-items      --project-ref <project-id>   # fridge camera
   npx supabase functions deploy read-expiry       --project-ref <project-id>   # Scan tab → Read date
   npx supabase functions deploy generate-insights --project-ref <project-id>   # To do tab insights
   npx supabase functions deploy suggest-recipes   --project-ref <project-id>   # To do tab recipes
   ```
   Redeploy a function after pulling changes to its folder (or `_shared/`); the app code and the functions update separately.

## Who owns what

| Area | Files | Owner |
|---|---|---|
| Camera device (motion detection, frame capture) | `src/app/(tabs)/camera.tsx`, `src/camera/` | _name_ |
| AI backend (vision model, rate limits) | `supabase/functions/detect-items/` | _name_ |
| Phone app / dashboard (inventory, expiring, activity/fix UI, impact) | `src/app/(tabs)/index.tsx`, `activity.tsx`, `impact.tsx`, `src/fridge/`, `src/data/` | _name_ |
| Accounts, households & demo | `src/auth/`, `src/household/`, `settings.tsx` | _name_ |
| Database schema | `supabase/migrations/` | whoever changes it, via PR |

## How we work

- **Never push straight to `main`.** Make a branch, push it, open a pull request, and get a quick look from one teammate:
  ```bash
  git checkout main && git pull
  git checkout -b camera-motion       # name it after what you're doing
  # ...work, then:
  git add -A && git commit -m "Detect motion and capture frames"
  git push -u origin camera-motion    # then open the PR on GitHub
  ```
- **Pull `main` often** (`git pull origin main` while on your branch) and keep PRs small.
- **Database changes go in a new file** in `supabase/migrations/` (e.g. `20260927120000_add_notes.sql`), run it in the SQL Editor, and update `src/types/db.ts` in the same PR. Don't edit tables silently in the dashboard.
- **Navigation lives in `src/app/(tabs)/_layout.tsx`.** Add a screen by creating a file in `src/app/(tabs)/` plus one `<Tabs.Screen>` line.
- Run `npm run typecheck` before opening a PR.

## How the pieces fit

```
Laptop Camera tab (browser)                         Phone Scan tab (Expo Go)
  ├─ motion → 6 photos ─▶ Edge Function detect-items    └─ barcode (native reader)
  │                        Gemini: "apple, in, 0.85"       │
  └─ barcode (ZXing) ──┐                                   │
                       ▼                                   ▼
          saved barcodes → Open Food Facts → "what is it?" (name once, remembered)
                                       │
                                       ▼
                              record_event()  (SQL)
                                       │ updates inventory + logs event
                                       ▼
   Every screen ◀── Supabase Realtime ── inventory / events tables
   (Fridge, To do, Activity: Undo / Fix → correct_event() learns aliases, Impact)
```

Database functions (all check you're a household member):

| Function | Used for |
|---|---|
| `record_event(household, label, 'in'/'out', confidence, source, quantity, location, disposition)` | Camera, barcode or manual add/remove (only the first three are required) |
| `undo_event(event_id)` | Undo button |
| `correct_event(event_id, name, action)` | Fix button; renames are remembered as aliases |
| `set_location(inventory_id, location)` | Move to the freezer / a shelf (records thaw time) |
| `update_disposition(event_id, disposition)` | Say whether something that left was eaten, binned or composted |
| `join_household(code)` | Join a housemate's fridge |

In the app, call them through `src/data/fridge.ts` (`recordEvent`, `undoEvent`, `correctEvent`, `setLocation`, `updateDisposition`, `setExpiry`) and read live data with `useInventory()` / `useEvents()`.

## Project layout

```
src/
  app/                 screens (Expo Router: every file is a route)
    _layout.tsx        providers
    (tabs)/_layout.tsx sign-in gate → fridge gate → tab bar
    (tabs)/index.tsx   Fridge dashboard (shelves + freezer, Action needed, camera feed)
    (tabs)/todo.tsx    Action needed, recipes, shopping insights
    (tabs)/activity.tsx
    (tabs)/impact.tsx  saved vs wasted stats
    (tabs)/scan.tsx    phone barcode scanner + Read date (hidden on web)
    (tabs)/camera.tsx  laptop fridge camera: motion, AI, barcodes
    (tabs)/settings.tsx
  auth/                login system (see src/auth/README.md)
  household/           create / join fridge, useHousehold()
  camera/              fridge camera + barcodes (see "Fridge camera and barcodes")
    CameraFeed.web.tsx   webcam preview, camera picker, green-screen fix
    motion.ts            motion detection logic (unit-testable, no browser code)
    useFrameRecorder.ts  picks 6 photos per movement for the AI
    detect.ts            calls detect-items
    barcode.ts           ZXing / built-in barcode reading
    productLookup.ts     saved barcodes → Open Food Facts → shelf life
    useBarcodeFlow.ts    look up → confirm → record_event (shared by laptop + phone)
    readExpiry.ts        calls read-expiry (printed best-by dates)
  data/fridge.ts       database calls + live hooks
  fridge/              dashboard data layer + components (see "Dashboard")
    types.ts           the dashboard's data contract
    expiration.ts      shelf life by category × fridge/freezer
    adapter.ts         real tables → contract (the one file to change if the schema moves)
    liveSource.ts      Supabase queries + Realtime
    mockSource.ts      demo data + simulated camera
    FridgeProvider.tsx useFridge(), expiry alerts
  lib/supabase.ts      Supabase client
  types/db.ts          table row types
  ui/theme.ts          shared colors (Tailwind tokens live in src/global.css)
  global.css           Tailwind (Uniwind) entry + color tokens
supabase/
  migrations/          SQL schema (run in name order)
  functions/
    _shared/vision.ts      photo → Gemini/Claude (used by detect-items, read-expiry)
    _shared/llm.ts         text → Gemini + cache (used by insights, recipes)
    detect-items/          camera photos → what went in/out
    read-expiry/           photo of a package → printed best-by date
    generate-insights/     To do tab shopping insights
    suggest-recipes/       To do tab recipe ideas
```

## Dashboard (web, tablet, phone)

One Expo app for every screen: on a laptop/monitor the tab bar becomes a sidebar above
900px wide and the Fridge screen goes two-column above ~1260px; on a phone (Expo Go) it's
a single column with a bottom tab bar. There is no separate mobile app to keep in sync.

| Screen | What it shows |
|---|---|
| **Fridge** | Items on "shelves" (top shelf, middle shelf, crisper drawer, door) and in the **freezer** compartment below, colour-coded fresh / use within 2 days / expired; filter by category and fridge/freezer, sort by shelf or expiry. ❄ on a card moves it to the freezer (and back). Items the camera saw leave sit as dashed "taken out" cards until they come back or the grace period ends. |
| **Fridge view** (web) | Toggle **Normal / Fridge** above the fridge. Fridge view draws an open top-freezer fridge; each item is a small illustration of that food in its own colours (~70 shapes matched by name, e.g. banana, kiwi, cheese wedge, drumstick, soy sauce; unknown names fall back to a shape for the category; see `src/fridge/components/FoodShape.tsx`). Freshness is the coloured line under each item, the same green / amber / red as the cards. Hover for name and expiry date. The choice is remembered per browser. |
| **Action needed** (on Fridge) | Only things expiring within 2 days or already expired, with **Mark as used** / **Thrown away**. |
| **Camera feed** (on Fridge) | Latest detections from the same realtime stream. |
| **Activity** | Timeline grouped by day, with Undo / Fix. |
| **Impact** | Waste avoided %, waste-free streak, saved vs wasted per day, most-wasted categories. |

On web the page itself stays put: only the fridge (and the side panel) scroll, so the header, filters and view toggle are always in reach. Phones keep one normal scrolling page.

Alerts: in-app toasts when something crosses "expiring soon" or "expired", on load and live.
The **Alerts** button in the header opts in to OS notifications too: browser notifications on
web, local notifications (expo-notifications) on phones. They're fired by the app's own check
of the data it already has, so no push server, tokens or FCM/APNs setup is involved.

### Freezer and expiry estimates

Expiry depends on the food category **and** where it is (`src/fridge/expiration.ts`,
rule-of-thumb numbers for the demo, not food-safety advice):

| Category | Fridge | Freezer |
|---|---|---|
| Meat & fish | 4 days | ~6 months |
| Dairy | 10 days | ~2 months |
| Produce | 6 days | ~9 months |
| Takeout | 3 days | ~2 months |
| Drinks | 14 days | ~4 months |
| Condiments | 30 days | ~4 months |
| Other | 7 days | ~3 months |

- Fridge items use the backend's `expires_on` when the food catalog knows the item, else the
  fridge estimate from `added_at`.
- **Moving to the freezer** re-dates the item from `added_at` with the freezer shelf life.
  **Moving back out** starts a fresh fridge clock from that moment (it's thawing).
- "Expiring soon" is the same 2-day rule everywhere: a freezer item 2 days from *its own*
  date is flagged in Action needed, even though it went in months ago.
- Fridge spots come from the category (dairy/other → top shelf, meat/takeout → middle,
  produce → crisper drawer, drinks/condiments → door). The camera can't tell fridge from
  freezer, so the freezer is always the user's choice.

### Setting expiry dates

- **Automatic:** when an item goes in, the catalog's shelf life for that food sets the date (exact name, else a whole-word match: "oat milk" → milk). No catalog match → the category estimate above.
- **By hand:** tap the date chip (✎) on any item card to pick a new date, or "Use estimate" to go back.
- **From the package:** on the phone Scan tab, after adding an item tap **Read date** and photograph the printed best-by date (needs `read-expiry` deployed).
- A date set by hand or read off the package wins over the "thawing" estimate after an item comes out of the freezer. Items **in** the freezer always use the freezer estimate (the editor says so).

### Run it

```bash
npm install
cp .env.example .env
npx expo start --web          # or press w in `npx expo start`
```

**Demo data (no Supabase, no sign-in):** in `.env` set `EXPO_PUBLIC_USE_MOCK_DATA=true`.
You get a seeded fridge (every category, several items expiring, 1 expired, 2 "taken out",
6 in the freezer incl. ice cream 1 day from its freezer date), three
weeks of history for the Impact page, and a fake camera that adds/removes something every
~25 s (Pause it on the camera card).

**Live:** set `EXPO_PUBLIC_USE_MOCK_DATA=false` plus the Supabase URL and key, restart with
`npx expo start --clear` (env vars are baked in at bundle time), sign in and create or join a fridge.
The dashboard subscribes to Realtime on `inventory` and `events`, so anything the camera logs
shows up within a second, with no refresh. Use **Camera → Simulate a detection** from a phone to test.

### Run it on your phone (Expo Go)

1. Install **Expo Go** from the App Store (iPhone) or Google Play (Android). It must support
   this project's SDK (57); update Expo Go if it complains about the SDK version.
2. On the laptop, from the repo root:
   ```bash
   npx expo start
   ```
   (Windows PowerShell error about `$MyInvocation.Statement`? Use `npx.cmd expo start`.)
3. Scan the QR code: **iPhone** with the Camera app, **Android** from inside Expo Go.
   The app opens in Expo Go and reloads live as you save files.

**The phone and laptop must be on the same Wi-Fi network.** Conference/hackathon Wi-Fi often
has client isolation (devices can't see each other), so the scan works but the app never
loads. Then use a tunnel instead:
```bash
npx expo start --tunnel
```
(The first time it may ask to install `@expo/ngrok`; say yes. Tunnels are a bit slower.)

The phone uses the same `.env` (demo data vs live Supabase) as the laptop. Tap **Alerts**
in the header and allow notifications to get a phone notification when food is about to go off.

`EXPO_PUBLIC_PENDING_GRACE_MINUTES` (default 10) sets how long a taken-out item waits
before counting as used.

Styling is Tailwind via [Uniwind](https://uniwind.dev) (`className` on React Native components,
works on web and native). `metro.config.js` has a one-line workaround for a Uniwind web bug.

### Data contract (backend team: tell us if this doesn't match)

Every screen reads one shape, `FridgeItem` in `src/fridge/types.ts`:

| Field | Type | Where it comes from today |
|---|---|---|
| `id` | uuid | `inventory.id` (or `out:<event id>` for items that left) |
| `name` | text | `inventory.name` / `events.item_name` |
| `category` | `meat \| dairy \| produce \| takeout \| beverage \| condiment \| other` | `foods.category` via `food_id` / name, mapped (seafood→meat, prepared→takeout, drinks→beverage); else guessed from the name |
| `source` | text, null | **not in schema**: restaurant for takeout, brand for packaged goods |
| `quantity` | int | `inventory.quantity` |
| `location` | `top_shelf | middle_shelf | drawer | door | freezer` | `inventory.location` (NULL = the category's usual spot); freezer moves via `set_location()`, synced across devices |
| `added_at` | timestamptz | `inventory.added_at` |
| `expires_at` | timestamptz, null | `inventory.expires_on` (date) for fridge items; freezer items and unknown foods use `src/fridge/expiration.ts` |
| `status` | `in_fridge \| pending_removal \| consumed \| expired \| thrown_away` | **derived**, see below |
| `removed_at` | timestamptz, null | time of the `out` event |
| `image_url` | text, null | **not in schema**: camera thumbnail |

How status is derived from `events` (all in `src/fridge/adapter.ts`):

- row in `inventory` → `in_fridge`
- camera `out` event younger than the grace period → `pending_removal`; if an `in` of the same
  item follows within the grace period it's treated as **put back**
- `out` older than that (or manual) → `consumed`, or `expired` if `events.expires_on` was before
  the day it left (that's what the Impact page counts as wasted)
- the user's explicit **Mark as used / Thrown away / Composted** choice is stored in
  `events.disposition` (via `update_disposition()`), so it syncs across devices

**Would make the dashboard more accurate if the backend adds them** (no changes made to the
schema from the frontend):
1. `source` and `image_url` on `inventory`/`events` (the AI already sees the takeout bag / brand).
2. ~~A way to record the outcome of an `out`~~ Done: `events.disposition`.
3. `record_event('in')` for something taken out a minute ago currently gives it a fresh expiry
   (`current_date + shelf_days`); restoring the old `expires_on` would keep "put back" honest.
4. ~~A `location` column on `inventory`~~ Done: `inventory.location` + `thawed_at`.

If a column is renamed, update `src/fridge/adapter.ts` (mapping) and the two queries in
`src/fridge/liveSource.ts`; nothing else touches table rows.

## Fridge camera and barcodes

### Laptop: Camera tab (web)

Open the web version (`npx expo start`, press `w`) → **Camera**. It only works on `localhost` or `https://` (browsers block the camera on plain `http://` addresses).

- **Camera picker** (bottom-left of the preview) appears when more than one camera is connected (e.g. a USB webcam); the choice is remembered.
- **Motion:** the meter shows how much of the picture changed; Low / Medium / High sensitivity. A movement ends after 1.5 s of stillness.
- **Send to AI:** each movement sends 6 photos (before, 4 during, after) to `detect-items`. Results show as **Added apple** (Fix / Undo), plus **AI saw: …** lines for guesses that weren't confident enough to log. Turn it off while you work, to save the free AI allowance.
- **Barcodes:** hold a package's barcode flat inside the dashed box, filling most of it. A read beeps, flashes green and shows a card (**Put in / Took out**, auto-confirms in 5 s). Direction is a guess: already in the fridge → "took out". A movement handled by a barcode isn't also sent to the AI.
- **Simulate a detection** buttons fake a camera event for testing without a camera or AI.

### Phone: Scan tab (Expo Go)

Phone cameras focus up close, so this is the reliable way to scan barcodes. Point at a barcode: the phone vibrates, the aim box turns green, same card as the laptop. After adding an item, **Read date** photographs the printed best-by date and sets its expiry (needs `read-expiry` deployed).

Barcode lookup order: barcodes your household already saw → [Open Food Facts](https://world.openfoodfacts.org) (free, ~15 lookups/min, so every result is saved) → "New barcode: what is it?" (name it once, remembered).

### Product vision

In the product, a small camera sits **inside the fridge by the door, facing out**: it wakes when the door opens (the fridge light), sees every item cross the doorway up close, and can't see anything while the door is shut. The laptop camera stands in for it in the demo.

## Troubleshooting

| Problem | Fix |
|---|---|
| White page in the browser | Press F12 → Console. Usually "Missing Supabase settings": check `.env`, then `npx expo start --clear`. |
| "Failed to fetch" on sign-up | `EXPO_PUBLIC_SUPABASE_URL` must be `https://<project-id>.supabase.co`, not the dashboard link. |
| `Cannot find module …` (e.g. `uniwind/metro`) | Run `npm install` (a pull added packages). |
| "Can't reach the AI function: probably not deployed yet" | Deploy `detect-items` (Supabase setup step 7). |
| "No AI key set" | Add `GEMINI_API_KEY` in Edge Functions → Secrets. |
| "Free AI limit reached" | Wait a minute; turn off Send to AI while not testing. |
| Every add/remove fails: *record_event … is not unique* | Re-run `20260926193000_smarter_expiry_matching.sql`. |
| Camera zooms / pans by itself, false motion events | Windows **Settings → Bluetooth & devices → Cameras → Windows Studio Effects → Automatic framing: off** (or the laptop maker's "auto framing" setting). |
| Green video from DroidCam / a virtual webcam | The app retries at the camera's own resolution. Still green in other sites too (webcamtests.com)? It's DroidCam + Chrome: set DroidCam's resolution to 640×480 and restart its client, try Firefox, or use Iriun Webcam. |
| Barcode won't read on the laptop | Laptop webcams can't focus close up. Hold it 30–50 cm away inside the dashed box, avoid glare, or use the phone Scan tab. |
| Food on the desk gets logged as "took out" | At a desk, keep food out of the camera's view; picking up something that was sitting there looks like "out". Undo fixes it. |
| Phone can't load the app on hackathon Wi-Fi | `npx expo start --tunnel` (Windows: if it asks for `@expo/ngrok`, run `npm install --no-save @expo/ngrok@^4.1.0` first). |

## Demo link (optional)

To give judges something to click without an account, deploy the **demo-data** build:
```bash
# .env: EXPO_PUBLIC_USE_MOCK_DATA=true
npm run build:web
```
Drag the `dist` folder onto **app.netlify.com/drop**. (`public/_redirects` makes page links work there.) A phone browser can also use the Camera tab from an `https://` link like this, with live data if the build is made with `EXPO_PUBLIC_USE_MOCK_DATA=false`.

## Privacy

It's a camera in someone's kitchen. Frames are only captured during motion, sent to the Edge Function, and never stored. Keep it that way.
Aim the camera at hands and food, not faces. On Gemini's **free** tier, Google may use what's sent to improve its products; the paid tier (or Claude) doesn't.
