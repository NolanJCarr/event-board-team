# RSVP Cancel Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline Alpine.js confirmation prompt before a "Cancel RSVP" request is sent, on both the RSVP dashboard and the event detail page.

**Architecture:** Each Cancel RSVP button is wrapped in a small `x-data="{ confirming: false }"` Alpine scope. Clicking the button sets `confirming = true`, replacing it with an inline "Are you sure? / Yes, cancel / Never mind" prompt. The `hx-post` attributes move to the "Yes, cancel" button so the HTMX request only fires on explicit confirmation.

**Tech Stack:** EJS templates, Alpine.js v3 (`x-data`, `x-show`, `@click`), HTMX 2.0 (`hx-post`, `hx-target`, `hx-swap`), Tailwind CSS v4

---

## File Map

| File | Change |
|---|---|
| `src/views/rsvp/partials/dashboard-sections.ejs` | Wrap Cancel RSVP button with Alpine confirmation scope |
| `src/views/event/partials/rsvp-section.ejs` | Add `confirming` to existing `x-data`, apply confirmation pattern to "going" and "waitlisted" states |

No backend changes. No new files. No new tests (pure EJS/Alpine template changes with no server-side logic).

---

### Task 1: Add inline confirmation to the RSVP dashboard

**Files:**
- Modify: `src/views/rsvp/partials/dashboard-sections.ejs:29-34`

- [ ] **Step 1: Replace the Cancel RSVP button with the confirmation wrapper**

Open `src/views/rsvp/partials/dashboard-sections.ejs`. Replace lines 29–34:

```html
          <button
            hx-post="/events/<%= entry.event.id %>/rsvp"
            hx-target="#rsvp-sections"
            hx-swap="innerHTML"
            class="mt-4 text-sm text-red-600 hover:text-red-800 underline"
          >Cancel RSVP</button>
```

With:

```html
          <div x-data="{ confirming: false }" class="mt-4">
            <button
              x-show="!confirming"
              @click="confirming = true"
              class="text-sm text-red-600 hover:text-red-800 underline"
            >Cancel RSVP</button>
            <div x-show="confirming" class="flex items-center gap-3 text-sm">
              <span class="text-gray-600">Are you sure?</span>
              <button
                hx-post="/events/<%= entry.event.id %>/rsvp"
                hx-target="#rsvp-sections"
                hx-swap="innerHTML"
                class="text-red-600 hover:text-red-800 underline"
              >Yes, cancel</button>
              <button
                @click="confirming = false"
                class="text-gray-500 hover:text-gray-700 underline"
              >Never mind</button>
            </div>
          </div>
```

- [ ] **Step 2: Manually verify the change looks correct**

Start the server (`npm run dev`) and navigate to `/rsvp/dashboard` while logged in with at least one upcoming RSVP. Verify:
- "Cancel RSVP" link is visible
- Clicking it shows "Are you sure? / Yes, cancel / Never mind" inline (no page scroll, no modal)
- "Never mind" restores the original link
- "Yes, cancel" fires the request and the card moves to Past & Cancelled

- [ ] **Step 3: Commit**

```bash
git add src/views/rsvp/partials/dashboard-sections.ejs
git commit -m "feat: add inline cancel confirmation to RSVP dashboard"
```

---

### Task 2: Add inline confirmation to the event detail page

**Files:**
- Modify: `src/views/event/partials/rsvp-section.ejs:1-15`

- [ ] **Step 1: Add `confirming` to the existing `x-data` scope**

Open `src/views/event/partials/rsvp-section.ejs`. On line 2, change:

```html
     x-data
```

To:

```html
     x-data="{ confirming: false }"
```

- [ ] **Step 2: Replace the Cancel RSVP button in the "going" state**

Lines 7–14 currently read:

```html
      <button
        hx-post="/events/<%= eventId %>/rsvp"
        hx-target="#rsvp-section-<%= eventId %>"
        hx-swap="outerHTML"
        class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
      >
        Cancel RSVP
      </button>
```

Replace with:

```html
      <button
        x-show="!confirming"
        @click="confirming = true"
        class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
      >
        Cancel RSVP
      </button>
      <div x-show="confirming" class="flex items-center gap-3">
        <span class="text-sm text-gray-600">Are you sure?</span>
        <button
          hx-post="/events/<%= eventId %>/rsvp"
          hx-target="#rsvp-section-<%= eventId %>"
          hx-swap="outerHTML"
          class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
        >
          Yes, cancel
        </button>
        <button
          @click="confirming = false"
          class="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
        >
          Never mind
        </button>
      </div>
```

- [ ] **Step 3: Apply the same replacement to the "waitlisted" state**

Lines 19–26 currently read:

```html
      <button
        hx-post="/events/<%= eventId %>/rsvp"
        hx-target="#rsvp-section-<%= eventId %>"
        hx-swap="outerHTML"
        class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
      >
        Cancel RSVP
      </button>
```

Replace with the same block as Step 2 (identical — the `hx-post` URL and `x-data` scope are the same for both states):

```html
      <button
        x-show="!confirming"
        @click="confirming = true"
        class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
      >
        Cancel RSVP
      </button>
      <div x-show="confirming" class="flex items-center gap-3">
        <span class="text-sm text-gray-600">Are you sure?</span>
        <button
          hx-post="/events/<%= eventId %>/rsvp"
          hx-target="#rsvp-section-<%= eventId %>"
          hx-swap="outerHTML"
          class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
        >
          Yes, cancel
        </button>
        <button
          @click="confirming = false"
          class="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
        >
          Never mind
        </button>
      </div>
```

- [ ] **Step 4: Manually verify the event detail page**

Navigate to an event detail page for an event you have RSVP'd to. Verify:
- "Cancel RSVP" button is visible
- Clicking it reveals "Are you sure? / Yes, cancel / Never mind" inline, same row as the status text
- "Never mind" restores the original button (no full page reload)
- "Yes, cancel" fires the HTMX request and the section updates to show the RSVP button

- [ ] **Step 5: Commit**

```bash
git add src/views/event/partials/rsvp-section.ejs
git commit -m "feat: add inline cancel confirmation to event detail RSVP section"
```
