# NoWaste 🥬

A camera beside the fridge sees what goes in and out, AI identifies it, and everyone in the household shares a live inventory with expiry warnings, so food gets eaten instead of thrown away.

**Stack:** Expo (React Native + web) · Expo Router · Supabase (auth, Postgres, realtime, Edge Functions) · Claude vision API

---

## First-time setup (each teammate, ~15 min)

1. Install **Node.js LTS**, **Git**, **VS Code**, and **Expo Go** on your phone.
2. Clone and install:
   ```bash
   git clone https://github.com/OthmaneHarraq/NoWaste.git
   cd NoWaste
   npm install
   ```
3. Copy `.env.example` to `.env` and paste in the Supabase URL and anon key (ask in the group chat).
4. Run it:
   ```bash
   npx expo start
   ```
   Scan the QR code with Expo Go (Android) or the Camera app (iPhone). Press `w` to open it in the browser instead.
5. Sign up, create a fridge (or join with a teammate's code from their Settings tab), and use **Camera → Simulate a detection** to get test data.

> Changed `.env`? Restart with `npx expo start --clear`.

## Supabase setup (one person, once)

1. Create a project at supabase.com.
2. **SQL Editor** → paste all of `supabase/migrations/20260926000000_nowaste_schema.sql` → Run.
3. **Authentication → Sign In / Providers → Email**: for the hackathon you can turn off "Confirm email" so sign-ups work instantly.
4. **Organization settings → Team**: invite the rest of the group.
5. Share the Project URL and anon key in the group chat (not in git).
6. When the AI function is ready: **Edge Functions → Secrets** → add `ANTHROPIC_API_KEY`, then deploy with `npx supabase functions deploy detect-items`.

## Who owns what

| Area | Files | Owner |
|---|---|---|
| Camera device (motion detection, frame capture) | `src/app/(tabs)/camera.tsx`, `src/camera/` | _name_ |
| AI backend (vision model, rate limits) | `supabase/functions/detect-items/` | _name_ |
| Phone app (inventory, expiring, activity/fix UI) | `src/app/(tabs)/index.tsx`, `activity.tsx`, `src/data/` | _name_ |
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
Mounted phone camera ── motion → 3-4 frames ──▶ Edge Function detect-items
                                                   │ Claude vision: "milk, in, 0.93"
                                                   ▼
                                           record_event()  (SQL)
                                                   │ updates inventory + logs event
                                                   ▼
               Phone app ◀── Supabase Realtime ── inventory / events tables
               (Fridge tab, Activity tab: Undo / Fix → correct_event() learns aliases)
```

Database functions (all check you're a household member):

| Function | Used for |
|---|---|
| `record_event(household, label, 'in'/'out', confidence)` | Camera or manual add/remove |
| `undo_event(event_id)` | Undo button |
| `correct_event(event_id, name, action)` | Fix button; renames are remembered as aliases |
| `join_household(code)` | Join a housemate's fridge |

In the app, call them through `src/data/fridge.ts` (`recordEvent`, `undoEvent`, `correctEvent`) and read live data with `useInventory()` / `useEvents()`.

## Project layout

```
src/
  app/                 screens (Expo Router: every file is a route)
    _layout.tsx        providers
    (tabs)/_layout.tsx sign-in gate → fridge gate → tab bar
    (tabs)/index.tsx   Fridge (inventory)
    (tabs)/activity.tsx
    (tabs)/camera.tsx
    (tabs)/settings.tsx
  auth/                login system (see src/auth/README.md)
  household/           create / join fridge, useHousehold()
  data/fridge.ts       database calls + live hooks
  lib/supabase.ts      Supabase client
  types/db.ts          table row types
  ui/theme.ts          shared colors
supabase/
  migrations/          SQL schema
  functions/detect-items/  AI Edge Function (Deno)
```

## Privacy

It's a camera in someone's kitchen. Frames are only captured during motion, sent to the Edge Function, and never stored. Keep it that way.
