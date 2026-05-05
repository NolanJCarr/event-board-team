# RSVP Cancel Confirmation — Design Spec

**Date:** 2026-04-30  
**Feature:** Inline confirmation prompt before canceling an RSVP  
**Scope:** Dashboard (`rsvp/partials/dashboard-sections.ejs`) + Event detail (`event/partials/rsvp-section.ejs`)

---

## Overview

When a user clicks "Cancel RSVP", an inline confirmation prompt replaces the button in-place. The user must explicitly confirm before the cancellation is sent to the server. Declining resets the UI back to the original button.

No backend changes, no new routes, no new tests.

---

## Architecture

A small Alpine.js `x-data` scope wraps each Cancel RSVP button with `{ confirming: false }`. Clicking the button sets `confirming = true`, revealing an inline "Are you sure?" prompt. The prompt has two actions:

- **"Yes, cancel"** — carries the existing `hx-post` attributes; fires the HTMX request on click
- **"Never mind"** — sets `confirming = false`, restoring the original button

Each button has its own isolated Alpine scope so confirming one card does not affect others. No global state, no modal overlay, no new files.

---

## Components

### `src/views/rsvp/partials/dashboard-sections.ejs`

The Cancel RSVP button in the upcoming events section is replaced with a wrapper `<div x-data="{ confirming: false }">` containing:

1. The original Cancel RSVP button (`x-show="!confirming"`, `@click="confirming = true"`, no `hx-*` attributes)
2. The inline confirmation (`x-show="confirming"`):
   - Label: "Are you sure?"
   - "Yes, cancel" button with the original `hx-post`, `hx-target`, `hx-swap` attributes
   - "Never mind" button (`@click="confirming = false"`)

### `src/views/event/partials/rsvp-section.ejs`

Same pattern applied to the Cancel RSVP button in the `going` and `waitlisted` states. The outer `<div>` already has `x-data` — `confirming: false` is added to that existing data object. The button/prompt swap is added inline within the same `<div>`.

---

## Data Flow

```
User clicks "Cancel RSVP"
  → confirming = true
  → Original button hides (x-show="!confirming")
  → Inline prompt appears (x-show="confirming")

User clicks "Never mind"
  → confirming = false
  → Prompt hides, button reappears
  → No request sent

User clicks "Yes, cancel"
  → hx-post fires (identical to current cancel flow)
  → Server returns updated partial
  → HTMX swaps in new HTML (Alpine state reset naturally by re-render)
```

---

## Error Handling

No new error handling needed. The HTMX request and server-side error handling are unchanged. If the request fails, HTMX handles it the same as today.

---

## Out of Scope

- No backend changes
- No new routes
- No new tests (purely frontend UX layer)
- No modal overlay or global Alpine store
