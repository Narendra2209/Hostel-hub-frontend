# Hostel Hub — frontend

The React single-page app for Hostel Hub: a hostel management system covering
resident fees, staff salaries and running costs.

It talks to the API in
[Hostel-hub-backend](https://github.com/Narendra2209/Hostel-hub-backend) over
HTTPS and holds no database of its own. Every figure on every screen — balances,
arrears, profit and loss — is calculated by the backend and rendered here. The
browser never does the arithmetic.

---

## Stack

| Piece | Choice |
| --- | --- |
| Framework | React 19 |
| Build | Vite 6 |
| Routing | React Router 7 |
| Server state | TanStack Query 5 |
| Forms | React Hook Form + Zod |
| HTTP | Axios |
| Tests | Vitest + React Testing Library |
| Styling | Plain CSS — the original design system, no framework |

---

## Running it

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

You need the backend running too — see its README. By default this app expects
it at `http://localhost:4000/api`.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm test` | Vitest |
| `npm run check:shared` | Confirm `shared/` matches the backend's copy |

---

## Configuration

One variable, and it is public by definition — Vite compiles `VITE_*` values
into the JavaScript bundle, so anyone who opens the site can read them.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | yes | Base URL for every API request. Local: `http://localhost:4000/api`. Deployed: the API Gateway stage URL. |

**Never put a connection string, a signing key or an AWS credential here.**
Secrets live only on the server.

---

## The `shared/` directory

`shared/` holds the API contract — every DTO, every Zod schema, and the date and
money helpers. It is a **copy of the same directory in the backend repository**,
which is the source of truth.

That duplication is deliberate and worth understanding. The contract has to exist
on both sides: the backend produces these shapes, this app consumes them, and the
same Zod schemas validate a form here and the request there. When the code lived
in one repository, npm workspaces resolved it once. Split across two, the honest
options were to publish it to a registry, use a submodule, or copy it. Copying
was chosen for being the one that needs no extra infrastructure — at the cost of
drift, which is why `npm run check:shared` exists:

```bash
# Clone both repos side by side
git clone https://github.com/Narendra2209/Hostel-hub-frontend.git
git clone https://github.com/Narendra2209/Hostel-hub-backend.git

cd Hostel-hub-frontend
npm run check:shared              # hashes every file, reports any difference
node scripts/check-shared-sync.mjs --update   # pull the backend's version in
```

CI runs the check on every push. It skips with a warning rather than failing when
the backend is not checked out, since a frontend-only run cannot fix that.

**When you change a DTO, change it in the backend first**, then sync it here.

---

## Structure

```
src/
  api/           one HTTP client, typed wrappers per resource, cache keys
  auth/          session token handling, auth provider, route guard
  components/
    common/      Button, Card, Modal, ConfirmDialog, Pagination, states…
    layout/      AppShell, Sidebar, TopBar
    dashboard/   the Overview screen's panels
    residents/   list, profile, photo and document handling
    fees/        ledger, payment forms, overdue table
    staff/  expenses/  settings/  activity/
  hooks/         one per domain, wrapping TanStack Query
  pages/         one per route
  styles/        app.css (the original design system) + components.css
  utils/         presentation helpers only
shared/          the API contract — a copy of the backend's, see above
```

### Screens

Overview · Residents (and profile) · Fee ledger · Overdue · Staff & salaries ·
Bills & expenses · Profit & loss · Settings · Activity · Diagnostics

The last two appear only for roles permitted to see them.

---

## Conventions worth knowing

**No business arithmetic in React.** The API returns `expected`, `paid`,
`balance`, `status`, `dueDate` and `daysOverdue` already computed. Components
render those. Summing an array the API already totalled is a bug, not a
shortcut — it is how two screens end up disagreeing.

**Never render a zero while loading.** A hostel manager reading "₹0 collected"
cannot tell "nothing came in" from "still fetching". Every data-driven panel
shows a skeleton until real numbers arrive.

**Filters live in the URL.** Month, building, search, page and sort are query
parameters, so any view can be shared or reloaded and come back the same.

**Permissions only hide UI.** `usePermissions()` decides what to render, but the
API authorises every request again. Hiding a button is a courtesy; it is not a
control.

**Money and dates are formatted, never computed.** `useMoney()` for currency,
and the date helpers from `@hostel/shared`.

---

## Authentication

Email and password, against the backend's own accounts — there is no third-party
identity provider.

On first run against an empty database the app shows a setup screen that creates
the first OWNER. After that, owners invite colleagues from Settings; each invitee
gets a one-time password and must choose their own on first sign-in.

The session token is kept in `localStorage` and sent as a Bearer header. The
backend also sets an HttpOnly cookie, which is the safer of the two but only
travels when the app and API share a site — and in the deployed layout they do
not (CloudFront and API Gateway are different domains). The trade-off, and why
cookie-only was not viable, is documented in `src/auth/session.ts`.

Roles: **OWNER**, **ADMIN**, **DEVELOPER**, **MANAGER**, **VIEWER**.

---

## Deployment

`npm run build` produces a static bundle in `dist/`. Anything that serves static
files will do; the backend repository's CDK stack provisions S3 + CloudFront and
its `docs/DEPLOYMENT.md` covers uploading and invalidating.

`VITE_API_BASE_URL` is baked in at build time, so build once per environment.
