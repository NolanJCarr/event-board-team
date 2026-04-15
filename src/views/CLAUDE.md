# src/views — Template Conventions

## Engine
- **EJS** via `express-ejs-layouts` (`app.use(Layouts)`)
- Default layout: `layouts/base.ejs` (set via `app.set("layout", "layouts/base")`)
- Views root: `src/views/` (resolved from `process.cwd()`)

## Directory Structure
```
src/views/
  layouts/
    base.ejs          # Single shared layout — head, nav, <%- body %>
  partials/
    error.ejs         # Generic error partial (expects: message)
  auth/
    login.ejs         # Public login page
    users.ejs         # Admin user management page
    partials/
      error.ejs       # Auth-specific error partial (same shape, different heading)
  home.ejs            # Authenticated landing page
```

New features add their own subdirectories (e.g., `events/`, `rsvp/`) and a `partials/` folder within them for HTMX fragments.

## Layout Conventions
- `layouts/base.ejs` renders the full HTML shell. Page content is injected at `<%- body %>`.
- Page views do **not** include `<html>`/`<body>` — they are body fragments only.
- To suppress the layout for a partial render, pass `{ layout: false }` to `res.render()`.

## Partial Conventions
- Partials are included with `<%- include("partials/error", { message }) %>` (unescaped output).
- Auth sub-views have their own `auth/partials/` scope; use relative include paths.
- Partials render standalone (no layout) when returned as HTMX responses.

## Variables Passed to Views

| Variable | Type | Source | Notes |
|---|---|---|---|
| `session` | `AppSessionStore` | every render | Contains `authenticatedUser` (`{ userId, displayName, email, role }`) or null |
| `pageError` | `string \| undefined` | most page renders | Human-readable error message; check before including error partial |
| `users` | `User[]` | `auth/users.ejs` | List of all users for admin management view |
| `message` | `string` | partials/error | Passed explicitly when including error partial |

Access pattern: `session?.authenticatedUser` (optional-chain; unauthenticated pages have no user).

Roles: `"admin" | "staff" | "user"` — check `session.authenticatedUser.role` for role-gated UI.

## HTMX Partial Rendering Pattern

Any interaction described as "without a full page reload" **must** return an HTML fragment, not a full page. This is a graded requirement.

Detect HTMX in the controller:
```ts
if (req.get("HX-Request") === "true") {
  return res.render("feature/partials/my-partial", { data, layout: false });
}
res.render("feature/my-full-page", { data });
```

HTMX swap targets point at a wrapper element; the partial returns only the inner HTML.

## Frontend Libraries (loaded in `layouts/base.ejs`)
- **Tailwind CSS v4** — utility-first, browser CDN build
- **Alpine.js v3** — `x-data`, `x-show`, `@click`, etc. for lightweight client-side interactivity (Sprint 4)
- **HTMX 2.0** — `hx-get/post`, `hx-target`, `hx-swap` for server-driven partials (Sprint 2+)

## Sprint-by-Sprint View Requirements

| Sprint | View Requirement |
|---|---|
| 1 | Full-page renders only. Server-side validation errors re-render the form. |
| 2 | Any interaction marked "without a full page reload" must use HTMX + a partial. |
| 3 | No view changes required — data layer only. |
| 4 | Polish with Tailwind. Add Alpine.js for transitions, confirmations, counters, etc. |
