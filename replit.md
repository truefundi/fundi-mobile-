# Fundi

Fundi connects customers with qualified technicians for repairs, maintenance, emergency service, payments, and service history.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

All paths below are under `artifacts/site-visit-logger/`.

- `app/sign-in.tsx` — the signed-out screen: welcome (full-bleed photo, no chrome), register, login and the code step
- `components/auth/` — those steps (WelcomeStep, RegisterStep, LoginStep, OtpStep) and the shared PhoneField
- `app/(tabs)/index.tsx` — customer home
- `app/(tabs)/services.tsx` — service marketplace
- `app/(tabs)/activity.tsx` — My services, split Active / Completed
- `app/request.tsx` — four-step request flow
- `app/job/[id].tsx` — stage router: picks the journey screen from the job's status
- `components/job/` — one component per journey stage (matching through settlement)
- `app/invoice/[id].tsx`, `app/rate/[id].tsx`, `app/payments.tsx` — invoice, rating, payment history
- `components/ui/` — shared primitives (Button, StageScreen, StatusBadge, Timeline, MapPanel)
- `constants/jobs.ts` — job model, the 19 statuses, and the money helpers
- `constants/simulation.ts` — stand-in technician behaviour and stage timings
- `context/AuthContext.tsx` — accounts, one-time codes, the session, sign-out and account deletion
- `context/FundiContext.tsx` — locally persisted jobs and the state machine
- `constants/auth.ts` — Rwandan phone validation, name rules and the one-time-code rules
- `constants/storage.ts` — every AsyncStorage key, including the per-account job key
- `constants/colors.ts` — mobile theme tokens
- `assets/images/icon.png` — app icon and splash artwork
- `assets/images/onboarding.jpg` — the welcome screen's full-bleed technician portrait

## Architecture decisions

- The app is offline-first and stores jobs in AsyncStorage so customers can use the whole journey without a backend dependency.
- An account is a phone number, with a full name attached at registration. Registering asks for both and confirms the number with a code; logging back in asks only for the number and starts the session on the spot, so a customer who changes phones registers the new one and keeps that number's records. There is no password.
- Only registration is verified. Login trusts the number against the accounts on this device, which means anyone who knows a registered number can open that account — acceptable while accounts never leave the device that created them, but the code step has to come back on the login path once accounts live on a server.
- Phone numbers are Rwandan only: the +250 country code is fixed in the field and the nine national digits must start with 7, so `7XX XXX XXX` is the only shape that can be submitted (`constants/auth.ts`).
- `app/_layout.tsx` wraps the routes in `Stack.Protected` guards, so a signed-out customer has no job screens to reach and signing out drops straight back to the welcome screen. Welcome, register, login and verify are steps inside `app/sign-in.tsx` rather than routes, so an abandoned form cannot be reopened from the back stack.
- No SMS gateway is connected, so the 4-digit registration code is created on the device when the number is submitted and shown on the verify screen behind a "Demo mode" note. Moving to a real backend means replacing `register`/`login`/`verifyCode` in `context/AuthContext.tsx`; nothing else knows how the code is checked.
- Every account on the device lives in `@fundi/accounts` keyed by phone, and its jobs under `@fundi/jobs/<phone>`, so each number keeps its own records: logging out and back in restores that history while a different number starts clean. Deleting the account removes both.
- The customer journey (REQUEST -> MATCH -> ... -> RATE) is a 19-status state machine in `context/FundiContext.tsx`. Screens are chosen from `job.status`, not from the navigation stack, so a job always reopens at the stage it is really at.
- The technician side does not exist yet. Stages that would wait on a technician advance on timers defined in `constants/simulation.ts`. Deleting that file and pointing the same transitions at an API is the intended path to a real backend.
- There is no map library: `react-native-maps` needs a custom dev build on SDK 54, so `components/ui/MapPanel.tsx` is a flat schematic stand-in. Swapping that one component swaps every map in the app.
- The Fundi brand uses solid orange surfaces only; gradients are intentionally excluded from the interface. The one exception is the dark wash over the welcome screen's photo, which exists so white text stays readable over the image rather than as a brand surface.
- The customer experience uses five focused tabs matching the product brief: Home, Services, Activity, Alerts, and Profile.

## Product

- Customers can browse service categories and start a request with a problem description, photo, location, and urgency.
- The request then runs the full journey: matching, technician offer, visit fee and payment, live tracking, arrival, diagnosis, quote approval, repair, extra-work approval, completion, settlement, invoice and rating.
- Only the visit fee is treated as running through Fundi. The repair balance can be settled as Cash, Mobile Money or Other, which is recorded but not processed.
- Notifications are generated from real job events, so the feed matches whatever stage the job is at.
- New customers register with their full name and Rwandan mobile number, confirm a 4-digit code, and the account is created. Returning customers sign in with the number and confirm the same code, so knowing a registered number is not enough to open the account behind it.
- Registration creates either a customer or technician account. Technician accounts submit profile details, a profile picture, a national ID and trade certificates to the backend; only backend-approved technicians can go online.
- The session persists across restarts, and Profile can log out or delete the account and everything stored for it on the device.
- OTP delivery and session creation use the backend. Technician verification status and document review are read from the backend; no local seed or timed auto-approval grants worker access.
- Not built yet: technician job dispatch/lifecycle APIs, the §12 matching algorithm, technician-rates-customer, i18n, tests, and the Saved locations / Help / Settings areas of Profile (shown as "Soon").

## User preferences

No additional preferences recorded.

## Gotchas

- Camera and location permissions are requested at the moment they are needed, with inline recovery guidance when access is unavailable.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
