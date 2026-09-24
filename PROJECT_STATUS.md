# Project Status

## Current state

Sattuma is functional: bilingual (FI/EN) landing, shared multiplayer rooms with host
controls, a six-deck table, a mobile observer view, and production mode with
debug/version chrome hidden. `npm run check` passes (lint, format, module/deck/smoke
checks, multiplayer tests, and Playwright e2e).

This checkout is an experimental design pass for comparison against production. It is
local only and has not been committed or pushed.

## Interface principles

- One obvious action per view. Filled yellow is reserved for the single primary action:
  `Create room` on the landing, and the round-advance button in the room panel.
- Yellow means action, focus, or live state (running timer, current turn). Structure
  uses neutral hairlines instead of yellow borders.
- No shadows on static chrome. Overlays (menu, modals, notices) keep one soft shadow.
- One type family (system UI stack), one spacing scale, and two radii (controls 8px,
  surfaces 12px). Drop zones are 10px to match the card faces. Tokens live at the top of
  `public/gameA.css`.
- One `:focus-visible` ring for every control. Tab order follows the visual order:
  menu, language, page content, then leave and host-only close room.
- The board wordmark is the yellow asset on the default table. The five light tables
  use `sattuma-wordmark-dark.png`, a dark-ink export with identical alpha (about
  7.6–8.8:1 contrast, up from 1.1–1.25:1). `applyTheme` in `public/js/themes.js` swaps
  it. The landing wordmark is always yellow on its dark surface.
- Card faces, deck backs, the table themes, and the game mechanics are unchanged.

## Layout

| Viewport width | Room panel          | Card size |
| -------------- | ------------------- | --------- |
| 901–999px      | stacked below table | medium    |
| 1000–1199px    | beside table, 320px | medium    |
| 1200px and up  | beside table, 320px | full      |

Heights of 760px or less also use medium cards. Checked from 980 to 1920px: no
horizontal overflow, no overlap between the panel and the table, and no clipped controls.

## Follow-up issues (not addressed in this pass)

1. **First-click startup race.** The landing and menu handlers attach only after the
   app config and translations load (`initGame` in `public/js/gameA.js`). That can
   finish after the page `load` event, so a very early click or key press does nothing.
   The e2e tests wait for `body.is-landing`, which masks the race in tests but does not
   fix it for users. Possible fix: attach handlers before the awaits, or disable the
   controls until the app is ready.

## Remaining manual visual checks

1. Compare this checkout and production side by side on a real projector (1280x720 and
   1920x1080) with host and guest windows.
2. Drag and drop and card flips at 1000–1199px with medium cards beside the panel.
3. Each table theme on the actual projector, including the dark-ink board wordmark.
4. Screen-reader pass over the room panel. The phase is announced with a hidden
   "Round" label, and the current player is marked with `aria-current`.

## Known risks

- Both wordmark exports come from the current source asset. The dark variant keeps the
  yellow file's alpha and maps its tone onto `#1e272e` ink. Regenerate both if the
  original changes.
- Multiplayer room state stays in memory unless optional persistence is enabled.
