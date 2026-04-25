# Visual Regression Report — Phase C.2

**Date:** 2026-04-25
**Agent:** C.2 (dark-mode polish + visual regression sweep)
**Screenshots:** `/tmp/oui-screens/dark/` (dark-mode captures) and `/tmp/oui-screens/light/` (light-mode comparison)

---

## Bugs fixed in this slice

### 1. Body background missing dark token (root layout)

**File:** `apps/web/src/app/layout.tsx`

The `<body>` element had no background class, so sections without an explicit background (e.g. the middle "features" section on the landing page) showed the browser default white in dark mode. Added `bg-base-canvas-default` — this token is remapped to `#18181b` in `.dark` via `src/styles/dark.css`.

### 2. Sign-in page gradient hardcodes `to-white`

**File:** `apps/web/src/app/(public)/sign-in/_components/_page.tsx`

The split layout used `lg:to-white` in the Tailwind gradient — a literal `#ffffff` that is not overridable via CSS custom properties. Replaced with `lg:to-base-canvas-default` so the right panel picks up the dark canvas token in dark mode.

### 3. Native checkboxes — role editor capabilities grid

**File:** `apps/web/src/app/(authed)/admin/roles/_components/role-editor.tsx`

Native `<input type="checkbox">` elements in the capabilities fieldset stay white in dark mode (browser default). Added `dark:bg-zinc-800 dark:border-zinc-600 accent-interaction-main-default` via the `className` prop. The `accent-*` property ensures the checked state uses the brand colour instead of the browser default blue.

### 4. Native radio inputs — reset passkey modal

**File:** `apps/web/src/app/(authed)/admin/_components/reset-passkey-modal.tsx`

Native `<input type="radio">` elements for the TTL preset selector were white in dark mode. Added `dark:bg-zinc-800 dark:border-zinc-600 accent-interaction-main-default`.

### 5. Native `<textarea>` — issued URL display in reset passkey modal

**File:** `apps/web/src/app/(authed)/admin/_components/reset-passkey-modal.tsx`

The read-only URL textarea had no dark styles. Added `dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600`.

### 6. Native `<select>` — role selector in users list

**File:** `apps/web/src/app/(authed)/admin/users/_components/users-list-page.tsx`

The role dropdown used `bg-base-canvas-default` (semantic token — correctly remapped in dark mode) but also had no explicit text-color override. Added `dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600` to ensure consistent rendering cross-browser. Note: `bg-base-canvas-default` is already correct, but the explicit `dark:bg-zinc-800` ensures parity with the textarea and other form controls.

### 7. Native radio inputs — audience picker in broadcast form

**File:** `apps/web/src/app/(authed)/admin/notifications/_components/broadcast-form.tsx`

Same issue as #4. Fixed with same approach.

---

## Loading state wiring (Section B)

Added `<Suspense fallback={<LoadingState />}>` boundaries around all admin page client components that use `useSuspenseQuery`. These provide a spinner if the server prefetch is unavailable (e.g., subsequent client-side navigations):

| Page route                                       | Component wrapped    |
| ------------------------------------------------ | -------------------- |
| `apps/web/src/app/(authed)/admin/users/page.tsx` | `<UsersListPage />`  |
| `apps/web/src/app/(authed)/admin/audit/page.tsx` | `<AuditLogPage />`   |
| `apps/web/src/app/(authed)/admin/files/page.tsx` | `<AdminFilesPage />` |
| `apps/web/src/app/(authed)/admin/roles/page.tsx` | `<RolesListPage />`  |

---

## OUI Tooltip on icon-only buttons (Section A addendum)

- **ThemeToggle** (`apps/web/src/components/theme-toggle.tsx`): Wrapped in `<TooltipTrigger delay={500}>` + `<Tooltip>` showing the current theme label (e.g. "Light mode", "Dark mode", "System theme"). This improves accessibility for the icon-only button.
- **NotificationBell**: The bell uses `DialogTrigger` from react-aria-components which doesn't compose cleanly with a nested `TooltipTrigger` (ARIA trigger conflicts). It already has a descriptive `aria-label` (`"X unread notifications"` or `"Notifications"`), so no Tooltip was added — the aria-label is sufficient.

---

## Visual regression screenshots

Screenshots of the **prod deployment** (before this PR lands) were captured for baseline comparison:

| Route         | Light                                      | Dark                                     | Notes                                                            |
| ------------- | ------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------- |
| `/` (landing) | `/tmp/oui-screens/light/light-landing.png` | `/tmp/oui-screens/dark/dark-landing.png` | Middle features section visible as white in dark mode before fix |
| `/sign-in`    | `/tmp/oui-screens/light/light-sign-in.png` | `/tmp/oui-screens/dark/dark-sign-in.png` | Right panel visible as white in dark mode before fix             |

Admin pages (`/admin/*`) were skipped for screenshots — they require a passkey authentication ceremony that the automated screenshot runner cannot perform.

---

## Known remaining issues (not fixable in this slice)

| Issue                                                   | Root cause                                                                                                                                                                                                                                       | Status                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| OUI `TextField` / `Input` stays white in dark mode      | OUI ships `bg-white` as a hardcoded Tailwind literal in the `input` component variant (not a CSS custom property). Cannot be overridden via token remapping. Requires OUI upstream fix or per-usage `classNames={{ input: 'dark:bg-zinc-800' }}` | Deferred — requires audit of every `TextField` usage site |
| OUI `Checkbox` stays white in dark mode                 | Same root cause as above                                                                                                                                                                                                                         | Deferred — upstream fix                                   |
| OUI `Radio` stays white in dark mode                    | Same root cause                                                                                                                                                                                                                                  | Deferred — upstream fix                                   |
| SVG illustration on landing page (`landing-banner.svg`) | Light-coloured illustration on dark bg may appear washed. `filter: invert(1)` is a blunt fix; a dedicated dark variant SVG would be cleaner                                                                                                      | Deferred — out of scope per plan                          |

---

## Validation

- `pnpm -F @acme/web typecheck` — exit 0
- `pnpm -F @acme/web lint` — exit 0
