# Project Status

## Current state

Sattuma is functional: bilingual (FI/EN) landing, shared multiplayer rooms with host
controls, a six-deck table, a mobile observer view, and production mode with
debug/version chrome hidden. `npm run check` passes (lint, format, module/deck/smoke
checks, multiplayer tests, and Playwright e2e).

## App readiness

`index.html` renders the landing (and hides the board) before any JavaScript runs, but
the controls only work once `initGame` in `public/js/gameA.js` has loaded the app config
and translations and attached its handlers. Until then the interactive regions carry
`inert` and `data-inert-until-ready`, and the body has `aria-busy="true"` and
`data-app-state="loading"`. `markAppReady()` is the single place that releases them and
sets `data-app-state="ready"`, after both the landing and the auto-start (`?create=1`,
`?room=`) paths are wired. Early clicks, typing and Tab presses therefore cannot reach a
control that would ignore them. A failed or malformed `/app-config` still falls back to
defaults and reaches ready.

Translation loading cannot block readiness. `public/js/i18n.js` uses the requested
dictionary if it loads, otherwise Finnish, otherwise the text served in `index.html`.
Finnish is only a per-key fallback, never a prerequisite. Every translatable element
keeps its served text as the last fallback, so a missing dictionary never writes a raw
key into the page. A startup fallback does not overwrite the saved language
preference. A failed language switch leaves the current language, selector and URL
untouched, and a failed dictionary is retried on the next switch. Missing modal pages
are logged and skipped. With no dictionary at all, strings generated only in code
(phase labels, notices) show their keys, because they have no served text.

The e2e tests wait for `data-app-state="ready"`. Regression tests cover:

- held `/app-config` or translation requests: clicks, typing, Enter and Tab reach no
  control until release, then the first real Create/Join works (also for `?create=1`)
- a malformed `/app-config`
- a failed requested dictionary, a failed Finnish dictionary, both failing, a failed
  switch after startup, and a missing modal page, each checking readiness, language,
  selector, URL, served text and that no page errors occur

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

## Remaining manual visual checks

1. Real projector at 1280x720 and 1920x1080 with host and guest windows.
2. Drag and drop and card flips at 1000–1199px on real laptop hardware.
3. Each table theme on the actual projector, including the dark-ink board wordmark.
4. Screen-reader pass over the room panel. The phase is announced with a hidden
   "Round" label, and the current player is marked with `aria-current`.

## Known risks

- Both wordmark exports come from the current source asset. The dark variant keeps the
  yellow file's alpha and maps its tone onto `#1e272e` ink. Regenerate both if the
  original changes.
- Multiplayer room state stays in memory unless optional persistence is enabled.
