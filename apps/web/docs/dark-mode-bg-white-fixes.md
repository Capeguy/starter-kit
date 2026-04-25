# Dark Mode — `bg-white` Follow-up

This document lists every place `bg-white` appears in the codebase and the recommended action for Phase C polish.

## Search results

A recursive grep over `apps/web/src/` for `bg-white` (all `.tsx`, `.ts`, and `.css` files) returned **zero results**.

A recursive grep over `packages/ui/src/` likewise returned **zero results**.

There are no bare `bg-white` usages anywhere in the application source code.

## OUI internal hardcoded `bg-white` (upstream — cannot be fixed by token override)

The following OUI component variant definitions in `node_modules/@opengovsg/oui-theme/dist` use the literal Tailwind class `bg-white` rather than a semantic token. These are compiled into the design system itself and **cannot** be overridden by remapping CSS custom properties:

| Component              | Usage                      | Effect in dark mode | Recommended fix                                                                                                                                   |
| ---------------------- | -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input` / `text-field` | Input element background   | Stays `#ffffff`     | Override at each usage site with `classNames={{ input: 'dark:bg-zinc-800' }}` (or equivalent OUI classNames API), or await an OUI upstream patch. |
| `checkbox`             | Unchecked box background   | Stays `#ffffff`     | Same — per-usage `classNames` override or upstream patch.                                                                                         |
| `radio`                | Circle background          | Stays `#ffffff`     | Same.                                                                                                                                             |
| `toggle` / `switch`    | Thumb background           | Stays `#ffffff`     | Same.                                                                                                                                             |
| `file-dropzone`        | Image container background | Stays `#ffffff`     | Same.                                                                                                                                             |

Additionally, `--color-utility-ui: #ffffff` is used as `border-utility-ui` for Avatar group rings. The token **is** remapped in `dark.css` (to `#3f3f46`), so Avatar rings will darken correctly.

## Recommendation for Phase C

1. **No action needed in app source** — zero `bg-white` instances to migrate.
2. **OUI component dark gaps** — decide per-usage whether the white-on-dark is acceptable or warrants a `classNames` prop override. Priority order:
   - Form inputs on sign-in / admin pages are the most visible (user sees them directly). Worth a targeted `classNames` fix per input usage site.
   - Checkboxes in user pickers and role editors — moderate visibility.
   - File-dropzone — lower priority (feature is less used).
3. **No SVG illustrations** were found in the OUI package; any SVG assets in `apps/web/public/` that appear on public pages should be verified manually in dark mode to check if a CSS `filter: invert(1)` or dedicated dark variant is needed (low risk for this boilerplate).
