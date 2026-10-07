# Mobile Backend Integration

## Current status

The mobile authentication flow calls the NestJS API at `/api/v1/auth`. Technician registration, profile verification, profile picture/KYC document uploads, and availability use the technician API. Job creation and job lifecycle remain local mock data in `FundiContext`; technician screens no longer consume those same-device mock jobs.

The generated API transport is configured in `artifacts/site-visit-logger/lib/api.ts`. It reads `EXPO_PUBLIC_API_URL` and calls `setBaseUrl()` from `@workspace/api-client-react`. The startup path performs a non-blocking health probe.

## Configure the API

Set the backend origin before starting Expo:

```text
EXPO_PUBLIC_API_URL=https://api.example.com
```

The value must be the server origin, without `/api`, because generated paths already include it:

```text
https://api.example.com + /api/v1/auth/register
```

For a physical device on a local network, use the development machine's LAN address rather than `localhost`.

The current smoke endpoint is:

```text
GET /api/v1/health
```

The app's startup probe calls the Fundi API health route. Start the NestJS server and verify that endpoint before testing mobile requests.

### Expo Go on iPhone

1. From the `fundi-api` repository root, start the Fundi backend. It defaults to port `3000`; PostgreSQL and Redis must be reachable, and development SMS mode must be `console`.
2. Find the computer's Wi-Fi IPv4 address with `ipconfig`. The iPhone and computer must be on the same network.
3. Set `EXPO_PUBLIC_API_URL` to the computer's LAN origin, for example `http://192.168.1.20:3000`. Do not use `localhost` from the phone. If iOS or the network blocks local HTTP, use an HTTPS development tunnel.
4. Confirm `http://192.168.1.20:3000/api/v1/health` opens from Safari on the phone.
5. Start Expo with the same environment variable and scan its QR code in Expo Go. Restart Metro whenever the API URL changes.
6. Register/login in the app. Read the six-digit `Development OTP for <phone>: <code>` line in the backend terminal and enter that code in the app.

Start the backend in one terminal:

```powershell
pnpm start:dev
```

Then launch Expo from the `fundi-mobile-` monorepo root in another terminal:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:3000"
pnpm dev:app
```

After OTP verification, the app stores JWTs in SecureStore on iPhone. Signing out revokes the server refresh session and clears the local tokens. Job and technician screens continue using their current mock data.

## API generation

`lib/api-spec/openapi.yaml` is the source contract for both generated clients. Once the backend team supplies endpoint examples or an OpenAPI document, update that contract and run:

```bash
pnpm --filter @workspace/api-spec codegen
pnpm run typecheck:libs
```

Do not hand-edit files under:

- `lib/api-client-react/src/generated`
- `lib/api-zod/src/generated`

## Authentication integration

The mobile uses these implemented backend routes. All paths are relative to the configured origin and include `/api/v1`:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/resend-otp
POST   /api/v1/auth/verify-otp
GET    /api/v1/auth/me
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
DELETE /api/v1/users/me
```

Payloads match the Nest DTOs:

```json
{ "fullName": "Jean Paul Uwase", "phoneNumber": "+250788123456" }
{ "phoneNumber": "+250788123456" }
{ "phoneNumber": "+250788123456", "otp": "123456" }
{ "phoneNumber": "+250788123456" }
{ "refreshToken": "<refresh-jwt>" }
```

These correspond to registration, login, OTP verification, OTP resend, and refresh respectively. Registration/login/resend return a message; OTP verification and refresh return `{ "user": { "id", "fullName", "phoneNumber", "role" }, "accessToken", "refreshToken" }`. `GET /auth/me` returns the current user directly. Logout requires `Authorization: Bearer <accessToken>` and `{ "refreshToken": "<refresh-jwt>" }` in the body. Account deletion uses the authenticated `DELETE /api/v1/users/me` route.

OTP values are six digits. The server owns OTP generation, delivery, expiry, resend limits, and failed-attempt handling; the client stores only the pending phone, intent, and local resend countdown. It never generates or persists OTP values.

The backend rotates refresh tokens. On app startup the mobile calls `/auth/me`; if the access token returns `401`, it posts the refresh token to `/auth/refresh`, stores the returned token pair, and retries `/auth/me`.

In the provided development SMS service (`sms.mode: "console"`), the OTP is printed in the Fundi API server terminal as `Development OTP for <phone>: <code>`. Watch that terminal after registering or requesting login, then enter the six-digit code in Expo Go. This is development-only behavior; production requires a configured SMS provider.

JWTs are stored in Expo SecureStore on iOS/Android (including Expo Go). Web uses browser `sessionStorage`. The API client bearer-token getter reads the access token from that store. Logout calls the backend when possible and always clears local tokens; job and worker mock data are not changed by logout.

## Fundi APIs required by the current UI

### Account and authentication

- Register an account
- Start login verification
- Verify an OTP
- Resend an OTP
- Restore the current session
- Sign out
- Delete an account
- Read and update the current profile

### Customer jobs

- Create a service request
- List active and completed jobs
- Read a job by ID
- Read job events/timeline
- Accept a technician offer
- Cancel a job
- Pay the visit fee
- Approve or decline a repair quote
- Approve or decline additional work
- Start or report settlement
- Submit or update a rating
- Read invoice and payment history

### Technician/work mode

- Read worker profile and verification status
- Submit identity and certificate documents
- Read and update work settings and trade filters
- Set availability
- List nearby/open job offers
- Accept or decline an offer
- Mark arrival
- Submit diagnosis and quote
- Mark repair progress/completion
- Read worker earnings

### Notifications and tracking

- List job status events and notifications
- Mark notifications read if supported
- Read technician location/ETA while en route
- Provide a server-owned job status source for polling or realtime updates

### Media and locations

- Upload job photos
- Upload identity and certificate documents
- Return stable media URLs or upload tokens
- Store service coordinates and address data

## Proposed API payload contract

The payloads below are the mobile-facing contract proposed from the current UI and context types. They are not implemented in the current health-only OpenAPI file yet. The backend team should confirm the names, validation rules, status codes, and authentication behavior before these shapes are added to `openapi.yaml`.

### Shared conventions

- Base path: `/api`
- IDs: opaque strings; the client must not generate server IDs
- Dates: ISO-8601 UTC strings
- Phone numbers: normalized E.164 strings, for example `+250788123456`
- Money: integer minor units is preferred; if the backend uses decimal major units, document the currency and precision consistently
- Auth: pending backend decision; bearer requests use `Authorization: Bearer <accessToken>`
- Mutating requests should accept an `Idempotency-Key` where retries could duplicate payments or actions
- Successful mutations should return the updated resource, not only `204`, so the mobile cache can update immediately

### Standard error body

All non-2xx responses should use one predictable JSON shape:

```json
{
	"type": "https://api.example.com/problems/validation-error",
	"title": "Validation failed",
	"status": 422,
	"detail": "One or more fields are invalid.",
	"code": "VALIDATION_ERROR",
	"fieldErrors": {
		"phone": "Use a valid Rwanda mobile number."
	},
	"requestId": "req_123"
}
```

The mobile should display `detail`, use `fieldErrors` for form fields, and log `requestId` for support. Suggested status usage: `401` unauthenticated, `403` unauthorized, `404` missing resource, `409` state conflict, `422` validation failure, and `429` rate limited.

### Account and worker profile

#### `PATCH /me`

Request body:

```json
{
	"name": "Jean Paul Uwase",
	"location": "Kigali, Rwanda"
}
```

Response: updated `Account`.

#### `GET /worker/profile`

Response:

```json
{
	"status": "verified",
	"trade": "Electrical",
	"yearsExperience": 6,
	"idDocumentUrl": "https://cdn.example.com/id/123",
	"certificateUrls": ["https://cdn.example.com/cert/456"],
	"submittedAt": "2026-09-30T11:55:00Z",
	"verifiedAt": "2026-09-30T12:10:00Z"
}
```

#### `POST /worker/application`

Request body after documents have been uploaded:

```json
{
	"trade": "Electrical",
	"yearsExperience": 6,
	"idDocumentUrl": "https://cdn.example.com/id/123",
	"certificateUrls": ["https://cdn.example.com/cert/456"]
}
```

Response: worker profile with `status: "pending"`.

#### `GET /worker/settings` and `PATCH /worker/settings`

Request body for `PATCH`:

```json
{
	"trades": ["Electrical", "Home Repair"],
	"radiusKm": 10,
	"maxJobsPerDay": 4,
	"hours": "days",
	"isAvailable": true
}
```

Response: updated worker settings.

### Jobs

#### `POST /jobs`

Request body from `request.tsx`:

```json
{
	"service": "Electrical",
	"problem": "The kitchen outlet is sparking.",
	"urgency": "Today",
	"location": {
		"label": "KN 5 Rd, Kigali",
		"latitude": -1.9441,
		"longitude": 30.0619
	},
	"photoUrls": ["https://cdn.example.com/jobs/photo-123.jpg"]
}
```

Response `201`: a complete `Job` resource.

#### `GET /jobs`

Suggested query parameters:

```text
GET /jobs?status=active&cursor=next-page&limit=25
```

Response:

```json
{
	"items": [/* Job */],
	"nextCursor": "next-page-or-null"
}
```

#### `GET /jobs/{jobId}`

Response: complete `Job` resource, including current technician, quote, additional work, payments, rating, and status events when available.

Canonical job response shape:

```json
{
	"id": "job_123",
	"reference": "FND-4821",
	"service": "Electrical",
	"problem": "The kitchen outlet is sparking.",
	"urgency": "Today",
	"location": {
		"label": "KN 5 Rd, Kigali",
		"latitude": -1.9441,
		"longitude": 30.0619
	},
	"status": "QUOTE_PENDING",
	"statusSince": "2026-09-30T12:30:00Z",
	"createdAt": "2026-09-30T11:55:00Z",
	"visitFee": { "amount": 7500, "currency": "RWF" },
	"technician": {
		"id": "tech_123",
		"name": "John Smith",
		"skill": "Electrician",
		"rating": 4.8,
		"jobsCompleted": 1250,
		"distanceKm": 5,
		"etaMinutes": 14,
		"phone": "+250788111222",
		"yearsExperience": 9
	},
	"quote": {
		"diagnosis": "Burnt outlet terminal and damaged wiring.",
		"parts": [{ "label": "Double socket outlet", "quantity": 1, "unitPrice": 2400 }],
		"labour": 15000,
		"currency": "RWF"
	},
	"additionalWork": null,
	"payments": [],
	"rating": null,
	"events": []
}
```

The backend must use the exact status vocabulary agreed with the mobile. The current UI recognizes: `REQUESTED`, `MATCHING`, `OFFERED`, `ACCEPTED`, `VISIT_PAID`, `EN_ROUTE`, `ARRIVED`, `DIAGNOSING`, `DIAGNOSIS_COMPLETE`, `QUOTE_PENDING`, `QUOTE_APPROVED`, `REPAIR_IN_PROGRESS`, `ADDITIONAL_APPROVAL_REQUIRED`, `REPAIR_COMPLETED`, `PAYMENT_PENDING`, `PAYMENT_REPORTED`, `COMPLETED`, `CANCELLED`, and `DISPUTED`.

### Job actions

Each action should validate the current server status and return the updated `Job`.

```text
POST /jobs/{jobId}/accept
POST /jobs/{jobId}/cancel       { "reason": "Changed my mind" }
POST /jobs/{jobId}/visit-fee   { "paymentMethod": "Card", "paymentReference": "pay_123" }
POST /jobs/{jobId}/quote/approve
POST /jobs/{jobId}/quote/decline { "reason": "Too expensive" }
POST /jobs/{jobId}/additional-work/approve
POST /jobs/{jobId}/additional-work/decline { "reason": "Not required" }
POST /jobs/{jobId}/settlement/start
POST /jobs/{jobId}/settlement/report { "method": "Cash", "amount": 45000, "reference": null }
POST /jobs/{jobId}/rating {
	"overall": 5,
	"quality": 5,
	"professionalism": 5,
	"arrival": 4,
	"communication": 5,
	"value": 4,
	"comment": "Excellent work."
}
```

### Worker job actions

```text
GET  /worker/jobs/offers?cursor=...
GET  /worker/jobs?status=active
POST /worker/jobs/{jobId}/accept
POST /worker/jobs/{jobId}/decline { "reason": "Outside my hours" }
POST /worker/jobs/{jobId}/arrived
POST /worker/jobs/{jobId}/diagnosis {
	"diagnosis": "Burnt outlet terminal.",
	"parts": [{ "label": "Socket", "quantity": 1, "unitPrice": 2400 }],
	"labour": 15000,
	"currency": "RWF"
}
POST /worker/jobs/{jobId}/completed
GET  /worker/earnings?from=2026-09-01&to=2026-09-30
```

### Notifications, events, and tracking

```text
GET /notifications?cursor=...&limit=25
POST /notifications/{notificationId}/read
GET /jobs/{jobId}/events?cursor=...
GET /jobs/{jobId}/tracking
```

Suggested tracking response:

```json
{
	"jobId": "job_123",
	"technicianId": "tech_123",
	"latitude": -1.9441,
	"longitude": 30.0619,
	"distanceKm": 1.2,
	"etaMinutes": 5,
	"updatedAt": "2026-09-30T12:40:00Z"
}
```

The backend should specify whether the mobile uses polling, server-sent events, or WebSockets for status and tracking updates. Polling is the minimum fallback the current UI can support.

### Payments, invoices, and uploads

```text
GET /payments?cursor=...&limit=25
GET /jobs/{jobId}/invoice
POST /uploads/presign {
	"purpose": "job-photo",
	"fileName": "outlet.jpg",
	"contentType": "image/jpeg",
	"sizeBytes": 183420
}
POST /uploads/complete {
	"uploadId": "upload_123",
	"storageKey": "jobs/job_123/outlet.jpg"
}
```

The preferred upload flow is presigned storage upload followed by a backend completion call. The backend must return a stable `url` or `mediaId` that can be sent in job/application requests. Do not send local `file://` or device URI values to the API as permanent media references.

## Frontend/backend ownership checklist

The frontend provides validated user input, device location, selected payment method, captured media, and user decisions. The backend owns IDs, references, timestamps, matching, fees, status transitions, authorization, payment verification, worker verification, notification events, and persistence. The frontend must treat server responses as authoritative and must not recreate quotes, technicians, job transitions, or payment totals locally.

## Mobile architecture mapping

Keep screens calling context methods. Move the implementation below those contexts into typed API services:

| Mobile boundary | Backend responsibility |
| --- | --- |
| `AuthContext` | Identity, OTP, session, profile |
| `FundiContext` | Jobs, lifecycle actions, quotes, payments, ratings |
| `WorkContext` | Server-owned technician profile, verification, documents, availability |
| `constants/jobs.ts` | UI status labels and presentation calculations |
| `components/job` | Render server-provided job state |
| `components/work` | Render server-provided worker and offer state |
| `request.tsx` | Device permissions plus create-request API call |

The server owns identity, matching, job lifecycle, payment state, worker verification, and persistence. The device may continue to own camera/location permissions and presentation-only calculations.

New accounts can choose `TECHNICIAN` at registration. This role is required for the protected `/api/v1/technicians/profile*` endpoints. Technician application submission registers/updates the profile, uploads the profile picture and National ID/certificate files, and fetches the server's review state and document metadata. Failed/partial submissions retain a retryable local draft; the technician verification state itself is never auto-approved locally.

## Mock code still present

The following are intentionally retained until the backend contract is ready:

- `constants/simulation.ts`: fake technicians, quotes, additional work, and timers
- Customer job data in `FundiContext` and AsyncStorage
- Same-device customer job lifecycle simulation

Authentication no longer uses local accounts or demo OTPs. AsyncStorage retains only the non-secret pending OTP phone/intent/timestamp; JWTs use SecureStore on native and `sessionStorage` on web.

`VisitsContext.tsx` is also retained temporarily, although it currently has no active Fundi route consumer.

## Verification checklist

- [ ] Set `EXPO_PUBLIC_API_URL`.
- [ ] Start the backend and verify `GET /api/healthz`.
- [ ] Run `pnpm --filter @workspace/api-spec codegen` after the contract changes.
- [ ] Run `pnpm run typecheck:libs`.
- [ ] Run `pnpm --filter @workspace/site-visit-logger run typecheck`.
- [ ] Start the mobile web target with `pnpm dev:app:web`.
- [ ] Verify real API registration/login, SMS OTP verification/resend, token restore/refresh, and logout on Expo Go.
- [ ] Verify technician registration, profile submission, profile picture and KYC uploads, retry behavior, and server review status.
- [ ] Verify job creation, job detail, lifecycle actions, payments, and ratings still use mock data; technician job dispatch remains unavailable until server endpoints are provided.
- [ ] Remove simulation only after all production paths are server-backed.
