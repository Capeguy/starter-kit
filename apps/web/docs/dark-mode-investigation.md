# Dark Mode Investigation — OUI Design System (v0.0.52)

## Does OUI ship dark mode tokens?

**No.** OUI v0.0.52 ships a single light-only token set. All semantic color variables are defined once in `:root` with no `@media (prefers-color-scheme: dark)` block, no `[data-theme="dark"]` selector, and no `.dark {}` override block anywhere in the published `dist/`.

Evidence:

- `@opengovsg/oui-theme/src/variants/base.css` — 498-line single `:root` block, zero dark-mode selectors.
- `@opengovsg/oui-theme/src/tailwind.css` — registers a `.dark` Tailwind variant (`@custom-variant dark (&:where(.dark, .dark *))`) but never uses it to remap any token.
- `grep -rE "data-theme|prefers-color-scheme|\.dark\s*\{|--.*dark" node_modules/.pnpm/@opengovsg/oui-theme/dist` — no matches.

## What attribute/class strategy does OUI expect?

OUI registers `@custom-variant dark (&:where(.dark, .dark *))` — meaning it is built to respond to a `.dark` class on an ancestor element. There is no `data-theme` support in the OUI CSS itself. Phase B must therefore either:

1. Configure `next-themes` to use `attribute="class"` (sets `class="dark"` on `<html>`), which is what the OUI variant targets directly; **or**
2. Keep `attribute="data-theme"` (current Phase A setup) and add a CSS bridge like `[data-theme="dark"] { @apply dark; }` — but that is non-standard and fragile.

**Recommendation**: Phase B should change `ThemeProvider`'s `attribute` from `"data-theme"` to `"class"`. This is a one-word change in `apps/web/src/app/layout.tsx` (already owned by Phase A, no other agent conflict). Alternatively Phase B can do it as part of their token work.

## What semantic token families exist?

All tokens defined in `src/variants/base.css` under `@theme {}`:

| Family                    | Examples                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base-canvas-*`           | `default`, `alt`, `backdrop`, `brand-subtle`, `inverse`, `overlay`                                                                                          |
| `base-content-*`          | `default`, `strong`, `medium`, `brand`, `inverse`                                                                                                           |
| `base-divider-*`          | `subtle`, `medium`, `strong`, `inverse`, `brand`                                                                                                            |
| `interaction-main-*`      | `default`, `hover`, `active`, `subtle-{default,hover,active}`                                                                                               |
| `interaction-sub-*`       | same pattern                                                                                                                                                |
| `interaction-critical-*`  | same                                                                                                                                                        |
| `interaction-warning-*`   | same                                                                                                                                                        |
| `interaction-success-*`   | same                                                                                                                                                        |
| `interaction-neutral-*`   | same                                                                                                                                                        |
| `interaction-muted-*`     | `main`, `sub`, `critical`, `neutral` hover/active pairs                                                                                                     |
| `interaction-tinted-*`    | rgba-based hover/active pairs                                                                                                                               |
| `interaction-support-*`   | `unselected`, `selected`, `disabled`, `disabled-content`, `placeholder`                                                                                     |
| `interaction-links-*`     | `default`, `hover`, `neutral-{default,hover}`, `inverse-{default,hover}`                                                                                    |
| `utility-feedback-*`      | `info`, `warning`, `warning-strong`, `success`, `critical` + `*-subtle`                                                                                     |
| `utility-focus-*`         | `default`, `inverse`                                                                                                                                        |
| `utility-ui`              | single token (`#ffffff`)                                                                                                                                    |
| `utility-ui-clear`        | transparent white                                                                                                                                           |
| `utility-input-prefilled` | yellow tint                                                                                                                                                 |
| Primitives                | `blue-*`, `red-*`, `green-*`, `yellow-*`, `slate-*`, `grey-*`, `standard-white/black`, `brand-primary-*`, `brand-secondary-*`, `skin-*` (all 50–900 scales) |

## Phase B recommendation: author full dark token overrides

**Scope: "author full dark token overrides ourselves"** — not a simple flip of a flag.

There is no existing dark palette to enable. Phase B must:

1. Change `ThemeProvider attribute` to `"class"` so the `.dark` CSS variant activates correctly.
2. Author a `.dark { }` block (or `[data-theme="dark"]` + bridge) in `apps/web/src/app/globals.css` or `tooling/tailwind/theme.css` remapping each semantic token family to dark-appropriate values.
3. Because OUI components use Tailwind utility classes generated from the design tokens (`bg-interaction-main-default`, `text-base-content-strong`, etc.), remapping the CSS custom properties at the `.dark` ancestor is sufficient — no component source changes are needed for the semantic tokens.

## Gotchas

**Hardcoded `bg-white` in OUI component themes (critical):** Multiple OUI component variant definitions in `@opengovsg/oui-theme/dist` use the literal Tailwind class `bg-white` rather than a semantic token — confirmed in these components:

- `input` / `text-field` — `bg-white` on the input element itself
- `checkbox` — `bg-white` on the unchecked box
- `radio` — `bg-white` on the circle
- `toggle` / `switch` — `bg-white` on the thumb
- `file-dropzone` — `bg-white` on the image container

These will stay white in dark mode regardless of token overrides, because `bg-white` resolves directly to `#ffffff` and is not overridable via CSS variable. Phase B must document this limitation clearly. The only fix is an OUI upstream patch or local `classNames` overrides per usage site.

**`--color-utility-ui: #ffffff` token** — used as `border-utility-ui` for Avatar group rings; this will also not darken without an override.

**No SVG illustrations** were found in the OUI package itself; SVG risk is limited to app-specific assets.
