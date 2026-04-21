# src/views — Template Conventions

## Engine
- **EJS** via `express-ejs-layouts` (`app.use(Layouts)`)
- Default layout: `layouts/base.ejs` (set via `app.set("layout", "layouts/base")`)
- Views root: `src/views/` (resolved from `process.cwd()`)

## Directory Structure
```
src/views/
  layouts/
    base.ejs              # Single shared layout — head, nav, <%- body %>
  partials/
    error.ejs             # Generic error partial (expects: message)
  auth/
    login.ejs             # Public login page
    users.ejs             # Admin user management page
    partials/
      error.ejs           # Auth-specific error partial
  events/
    index.ejs             # Event list with filter bar + search
    new.ejs               # Event creation form
    edit.ejs              # Event edit form
    attendees.ejs         # Attendee list partial target page
    _results.ejs          # HTMX partial: filtered/searched event list
  event/
    detail.ejs            # Event detail page
    partials/
      edit-form.ejs       # HTMX partial: inline edit form
      event-detail.ejs    # HTMX partial: event detail section
  rsvp/
    dashboard.ejs         # My RSVPs dashboard (Feature 7)
  home.ejs                # Authenticated landing page
```

New features add their own subdirectories (e.g., `comments/`, `saved/`) and a `partials/` folder within them for HTMX fragments.

## Layout Conventions
- `layouts/base.ejs` renders the full HTML shell. Page content is injected at `<%- body %>`.
- Page views do **not** include `<html>`/`<body>` — they are body fragments only.
- To suppress the layout for a partial render, pass `{ layout: false }` to `res.render()`.

## Partial Conventions
- Partials are included with `<%- include("partials/error", { message }) %>` (unescaped output).
- Partials render standalone (no layout) when returned as HTMX responses.

## Variables Passed to Views

| Variable | Type | Source | Notes |
|---|---|---|---|
| `session` | `AppSessionStore` | every render | Contains `authenticatedUser` (`{ userId, displayName, email, role }`) or null |
| `pageError` | `string \| undefined` | most page renders | Human-readable error message |
| `event` | `Event \| undefined` | detail/edit pages | The event being viewed or edited |
| `events` | `Event[]` | list pages | Array of events for the list view |
| `users` | `User[]` | `auth/users.ejs` | Admin user management |

Access pattern: `session?.authenticatedUser` (optional-chain; unauthenticated pages have no user).

Roles: `"admin" | "staff" | "user"` — check `session.authenticatedUser.role` for role-gated UI.

## HTMX Partial Rendering Pattern

Any interaction described as "without a full page reload" **must** return an HTML fragment. This is a graded requirement (Sprint 2+).

Detect HTMX in the controller:
```ts
if (req.get("HX-Request") === "true") {
  return res.render("feature/partials/my-partial", { data, layout: false });
}
res.render("feature/my-full-page", { data });
```

## Frontend Libraries (loaded in `layouts/base.ejs`)
- **Tailwind CSS v4** — utility-first, browser CDN build
- **Alpine.js v3** — `x-data`, `x-show`, `@click`, etc. for client-side interactivity (Sprint 4)
- **HTMX 2.0** — `hx-get/post`, `hx-target`, `hx-swap` for server-driven partials (Sprint 2+)

## Sprint-by-Sprint View Requirements

| Sprint | View Requirement |
|---|---|
| 1 | Full-page renders only. Server-side validation errors re-render the form. |
| 2 | Any interaction marked "without a full page reload" must use HTMX + a partial. |
| 3 | No view changes required — data layer only. |
| 4 | Polish with Tailwind. Add Alpine.js for transitions, confirmations, counters, etc. |
