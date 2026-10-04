# InduSense Frontend

Angular 21 frontend for InduSense: the **Device Summary** dashboard (7 widgets) with dark and light themes, sign-in, the application shell (top bar, sidebar, dashboard toolbar) and management pages for devices, assets (machines, meters, gateways), locations (plants, areas), reports and settings (users, roles, companies).

**Status:** Everything talks to InduSense-BE: sign-in, permission-based navigation and route guards, live dashboard data (`ApiDashboardDataSource`) and the management pages. Mock data remains only for the development review scenarios below. Maps, Alarms, More, Quick Start and Help are "coming soon" placeholders.

## Quick start

Requires Node.js 24+ and npm 11+.

```bash
npm install
npm start            # dev server on http://localhost:4200 (opens /dashboard)
```

To reach a local InduSense backend (InduSense-BE, `uvicorn app.main:app`), the dev server proxies `/api` to it; see [Backend proxy](#backend-proxy-development).

| Command | What it does |
|---|---|
| `npm start` | Development server with live reload (development config). |
| `npm run build` | Production build with server-side rendering into `dist/InduSense` (prerenders `/login`). |
| `npm run serve:ssr:InduSense` | Serves the production build with Node/Express on port 4000 (`PORT` overrides). |
| `npm test` | Unit tests (Vitest). Add `-- --watch=false` for a single run. |
| `npx prettier --check "src/**/*.{ts,html,scss}"` | Formatting check (Prettier config in `.prettierrc`). |

### Trying the UI

- **Login:** `/login`, with an InduSense-BE account (a running backend is required; see [Backend proxy](#backend-proxy-development)). For demo data and users, run `python scripts/seed_demo_data.py` in InduSense-BE. **Log out** is in the avatar menu.
- **Dashboard:** `/dashboard` refreshes every 30 s (while the tab is visible). Use the refresh button to reload now.
- **Review scenarios (development builds only):** add `?scenario=` to the dashboard URL, or use the "Preview data" links under the toolbar:

  | Scenario | Behaviour |
  |---|---|
  | `normal` | All widgets load; the gauge and one machine change on every refresh. |
  | `loading` | Loads never finish (skeletons). |
  | `empty` | A plant with no devices or machines (empty states). |
  | `error` | Every widget fails (error states with Retry). |
  | `partial` | Two widgets fail, the rest load. |
  | `flaky` | Every other load fails, so widgets keep their data and show a "refresh failed" marker. |

  Production builds ignore `?scenario=` and hide the links.

## Configuration

Runtime settings live in `src/environments/` and are injected through the `APP_CONFIG` token (`src/app/core/config/app-config.ts`). Development builds replace `environment.ts` with `environment.development.ts`.

| Setting | Default | Purpose |
|---|---|---|
| `refreshIntervalMs` | `30000` | Dashboard polling interval. |
| `gauge` | `{ label: 'watts', unit: 'W', min: 34, max: 45 }` | Title and scale of the radial gauge (W7). |
| `apiBaseUrl` | `/api/v1` | Base of every API request. Root-relative: same origin as the app (dev proxy, or a reverse proxy in production). Use an absolute URL only for a cross-origin API; the backend must then list the app's origin in `CORS_ORIGINS`. |

### Backend proxy (development)

`ng serve` forwards `/api/*` to the backend (`proxy.conf.mjs`), so the browser only talks to the Angular origin. That means no CORS setup, and auth cookies stay first-party. The target defaults to `http://127.0.0.1:8000` (matching `PORT=8000` in `InduSense-BE/.env`). Override it with `INDUSENSE_API_URL` or `PORT`:

```bash
INDUSENSE_API_URL=http://127.0.0.1:8000 npm start          # bash
$env:INDUSENSE_API_URL="http://127.0.0.1:8000"; npm start   # PowerShell
```
Or create a `.env` in `InduSense-FE/InduSense` based on [.env.example](.env.example).

> On the development machine used so far, port 8000 was taken by an unrelated application ("Finance Management App"). Run InduSense-BE on a free port (e.g. `uvicorn app.main:app --port 8001`) and point the proxy at it.

### Server-side rendering and allowed hosts

- `/login` is **prerendered** at build time. All other routes render in the browser (`src/app/app.routes.server.ts`); they rely on browser-only APIs (charts, polling, fullscreen).
- Angular's SSR server only renders for known host names (SSRF protection). `angular.json` allows `localhost` and `127.0.0.1`. **For a deployment, add its host names** through the environment variable when starting the server:

  ```bash
  NG_ALLOWED_HOSTS=dashboard.example.com,www.dashboard.example.com PORT=4000 node dist/InduSense/server/server.mjs
  ```

  Requests for other hosts are rejected with 400.

## Architecture

```
src/
  environments/                 environment.ts (production), environment.development.ts
  styles/                       design tokens, reset, typography, utilities, print, mixins
  app/
    core/
      api/                      ApiService (URLs, envelopes, paging, errors), ApiError,
                                apiCredentialsInterceptor, resources/ (DevicesApi, MachinesApi,
                                MetersApi, GatewaysApi, LocationsApi, TagsApi, TelemetryApi,
                                DashboardsApi, ReportsApi, UsersApi, RolesApi, CompaniesApi, …)
      models/                   backend response models (field-for-field with InduSense-BE schemas)
      auth/                     AuthService (sign-in, session restore, refresh on 401), auth and
                                CSRF interceptors, route guards, permission codes
      browser/                  FullscreenService
      config/                   APP_CONFIG token
    layout/                     MainLayout (shell), AppHeader, AppSidebar, DashboardToolbar, navigation
    shared/
      ui/                       Card, Button, Icon (inline SVG set), StatusPill, Skeleton,
                                EmptyState, ErrorState, DropdownMenu
      charts/                   EchartDirective, ChartThemeService, chart helpers
      utils/                    status colors, formatters, injectNow()
    features/
      auth/login/               LoginPage
      dashboard/
        models/                 widget view models (dashboard.vm.ts)
        data/                   DashboardDataSource contract, ApiDashboardDataSource (live),
                                aggregate helpers, MockDashboardDataSource, DashboardStore,
                                dev scenarios, mock dataset
        widgets/                WidgetCard frame + the 7 widgets (each chart's options are
                                built by a pure *.options.ts function)
        device-summary-page/    the dashboard page (grid + toolbar)
      devices/, assets/,        management pages (list, create, edit, deactivate)
      locations/, settings/
      reports/                  energy, production and device-health reports
      placeholder/              "coming soon" page for sections not built yet
```

### Data flow

```
DashboardDataSource ──► DashboardStore ──► DeviceSummaryPage ──► widgets
 (API; mock for dev        (signals, polling,     (grid, toolbar)      (presentational: view
  review scenarios)        paging, stale data)                          model + loading + error)
```

- **`DashboardDataSource`** (`features/dashboard/data/dashboard-data-source.ts`) returns a result per widget, so one failed widget never blanks the others. The `DASHBOARD_DATA_SOURCE` token defaults to `ApiDashboardDataSource`, which reads the device, machine, gateway, plant, area, tag and telemetry endpoints and builds the view models with the pure functions in `aggregate.ts`. In development builds, a non-`normal` `?scenario=` delegates to `MockDashboardDataSource`.

- **`DashboardStore`** (provided per page):
  - Loads on start, then every `refreshIntervalMs` while the tab is visible.
  - Never overlaps loads, and restarts the interval on manual refresh.
  - Keeps the last data when a refresh fails (the widget shows a warning icon).
  - Pages the machine table on its own, and ignores a page result the user has already paged away from.
- **Widgets** depend only on view models (`features/dashboard/models/dashboard.vm.ts`). `WidgetCardComponent` renders exactly one of skeleton, error with Retry, empty, or content. Content (and its chart) is created only when shown.
- **Charts** use a tree-shaken ECharts build (`shared/charts/echarts-setup.ts`, SVG renderer), which loads only with the dashboard. `EchartDirective` initialises after the first browser render, resizes with its container and is disposed with the view.

### API layer

Everything under `src/app/core/api/`:

- **`ApiService`**:
  - `get<T>()` and `post<T>()` unwrap `{ success, data }`; `post` resolves to `undefined` on `204`.
  - `getPage<T>()` returns `{ items, pagination }`.
  - `getAllPages<T>()` walks a paginated list: first page, then the rest in parallel (default concurrency 4, 100 per page, the backend maximum). It returns items in server order and refuses lists above `maxPages` instead of truncating them.
  - Query values that are `null`/`undefined` are dropped, and arrays repeat the key (`?tag_id=1&tag_id=2`).
- **`ApiError`** is the only error type API calls produce:
  - `status` and `code` (the backend's own code, e.g. `DEVICE_NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_CREDENTIALS`; `NETWORK_ERROR` when the server is unreachable).
  - A user-safe `message`.
  - Field `details` with `fieldMessage('email')`.
  - `retryAfterSeconds` (429) and `requestId` (`X-Request-ID`).
  - FastAPI's default `{ detail }` shapes and non-JSON gateway pages are normalised too.
- **`apiCredentialsInterceptor`** sends cookies (`withCredentials`) on API requests only.
- **Resource services** provide typed access per endpoint group: `DevicesApi` (`list`, `listAll`, `count`, `get`), `MachinesApi` and `GatewaysApi` (`list`, `listAll`, `get`), `LocationsApi` (plants and areas), `TagsApi` (`findByName` prefers an exact `tag_name`, then `display_name`), and `TelemetryApi` (`latest`, `history`, with ISO time ranges).
- **Toasts** (`shared/ui/toast`):
  - **Errors** of changes are handled in one place. `errorToastInterceptor` toasts every failed POST/PUT/PATCH/DELETE with the backend's message: the first rejected field for validation errors, and a reference id for unexpected server errors. Screens only reset their own state.
  - Not toasted by the interceptor: failed page loads (GET), which show in the page as an error state with Retry; `/auth/*`, where the login form shows errors inline; and 401, where the auth interceptor ends the session with its own message.
  - **Successes** are toasted by the screen (`ToastService.success`) with the record's name. The backend's success envelope (`{ success, data }`) carries no message.

### Authentication

Sign-in uses the backend's browser session (`POST /api/v1/auth/session`). The access and refresh tokens are HttpOnly cookies, so no script, including this app, can read them. The app stores nothing about the session.

- **`AuthService`** only knows who is signed in, from `GET /auth/me`: user, company, roles and permissions. The server decides the company and plant scope from the session; the app never sends `company_id` as an authority.
- **`authInterceptor`**: on a 401 it refreshes the session once (single-flight, because refresh tokens are single-use) and replays the request. If that fails, a toast says the session ended and the user goes to `/login?returnUrl=…`.
- **`csrfInterceptor`** copies the readable `indusense_csrf` cookie into `X-CSRF-Token` on POST/PUT/PATCH/DELETE (double-submit). Other sites can make the browser send the cookies but cannot read this value. The cookies' `SameSite` settings (Lax for access, Strict for refresh and CSRF) add a second layer of protection.
- **Guards**: `authGuard` for the app, `guestGuard` for `/login`. Sidebar entries are hidden without the matching permission. The backend enforces the same permissions on every request.
- Cookies are `Secure`, so use `http://localhost` (or HTTPS) in development; see InduSense-BE's `AUTH_COOKIE_SECURE`.

## Design system

- **Tokens:** `src/styles/_tokens.scss` holds surfaces, text, accents, status colors, type scale, spacing and layout sizes. Components use tokens, never raw colors. Charts read the same tokens through `ChartThemeService`.
- **Dark / light theme:** the sun/moon button in the header toggles it. `ThemeService` sets `data-theme` on `<html>`, and `:root[data-theme='light']` in `_tokens.scss` overrides the color tokens. The choice is saved in `localStorage` (`indusense-theme`, a display preference only), and an inline script in `index.html` applies it before the first paint. Charts re-read the tokens when the theme changes.
- **Status colors** (`shared/utils/status-colors.ts`) are the single mapping for pills and charts:

  | Status | Color |
  |---|---|
  | `RUNNING`, `ONLINE` | green |
  | `IDLE`, `MAINTENANCE`, `OFFLINE` | amber |
  | `FAULT` | red |
  | `STOPPED`, `NEVER_SEEN`, `UNKNOWN` | gray |

  Status colors always come with a text label.
- **Chart palette:** eight categorical colors in a fixed order, validated on the card surface for color-vision deficiency (worst adjacent ΔE 8.4) and contrast. More than eight categories fold into "Other". Text in and around charts uses text tokens, never series colors.

## Accessibility

- **Contrast:** text meets WCAG AA contrast (≥ 4.5:1) on every surface. `--text-muted` is `#8190a6` for this reason. Pie labels pick the higher-contrast ink per slice.
- **Automated audit:** axe-core (WCAG 2.2 AA plus best practices) reports no violations on the dashboard (normal, loading, empty and error states, user menu open), login (with validation errors), the placeholder pages and the mobile drawer.
- **Keyboard:**
  - A skip link comes first, and the focus order is logical: header, sidebar, toolbar, then content.
  - Every stop has a visible focus ring.
  - Menus follow the WAI-ARIA menu-button pattern (arrow keys, Home/End, Escape).
  - The table's sort headers are buttons with `aria-sort`.
- **Charts:** each chart has a text summary as its accessible name. The gauge exposes its reading, scale and out-of-range state.
- **Reduced motion:** `prefers-reduced-motion` disables CSS animation and chart animation.

## Testing

`npm test` runs the Vitest unit tests (jsdom).

- **Pure functions:** chart options, sorting, formatting, status mapping and mock data consistency.
- **Components:** widgets, layout, login, dropdown keyboard behaviour.
- **Store:** polling, visibility pause, overlap protection, stale data and paging races, tested with fake timers.
- **API layer** (`HttpTestingController`): URL and query building, envelope unwrapping, `getAllPages` (ordering, concurrency, caps, failures), `204` handling, the credentials interceptor, every resource endpoint, and error normalisation using error bodies captured from the real backend.

## Next steps

- The dashboard aggregates raw lists in the browser. InduSense-BE's `/dashboards/*` endpoints (wrapped by `DashboardsApi`, not used yet) compute KPIs, trends and machine status on the server from tag mappings, and scale better.
- The management pages (`devices`, `assets`, `locations`, `settings`, `reports`) have no unit tests yet.
