# Luma design system: UX improvement backlog

Created 2026-11-14. Scope: reusable components and interaction rules, not dashboard rearrangement. Preserve the current Luma identity and runtime configuration compatibility. This is a heuristic review, not a user study or a completed accessibility audit.

Evidence: live Otthon/overview mobile and desktop renders; src/styles.ts, src/localize.ts and Metric implementation. Screenshot-engine language may differ from the user's profile. Do not call mixed-language screenshots proof of missing translations. Source findings below are distinguished from verification tasks.

## Delivery rules

- Implement small coherent slices; update this file with evidence and remaining work.
- Keep home-specific entities, names, thresholds and routes outside the library.
- Do not automatically change dashboard structure or release/install a new version as part of this backlog.
- Validate real components at 390/768/1280 px and narrow nested widths; light/dark, Hungarian/English, long text, missing data, keyboard and reduced motion as applicable.
- Test operational actions only against mocks. Never trigger real gates, alarms, charging, irrigation or service operations.
- Required checks: npm run check, npm run build, npm run build:docs. Record screenshots separately; compilation does not establish visual correctness.
- An item is done only when acceptance criteria and applicable visual/interaction checks pass. Avoid a global CSS sweep before representative components prove the pattern.

## P0 — Meaning and interaction

### UX-01 Distinguish status, action and navigation
- [ ] Inventory pill/chip usage in Gate, Comfort, Room, Active, Hero and Navbar; record whether each element reads state, performs a command or navigates.
- [ ] Define shared visual roles: neutral status text/icon; bounded action button with pressed/busy feedback; navigable item with consistent affordance.
- [x] Pilot on Room and Gate before migrating the rest. Keep commands separate from innocent card navigation.
- [x] Use native buttons for actions in Metric and Room; no nested buttons. Broader card migration remains open.
- Acceptance: a first-time user can identify interactive elements without relying on color or “tap” instructions; keyboard activation matches pointer behavior; child actions do not trigger parent actions.

### UX-02 Unknown, unavailable and pending are distinct states
- [ ] Audit numeric coercion, fallback values and active-state calculations across Metric, Comfort, Room, Hero and control cards.
- [ ] Define consistent localized loading, missing, unavailable, stale and empty-history treatments. Preserve explicit zero as real data.
- [ ] Distinguish command submission from confirmed device state, with timeout/failure recovery and protection against repeat submissions.
- [ ] Verify high-impact controls retain local confirmation and clear cancellation.
- Acceptance: unavailable never appears healthy/off/zero; rejected commands leave controls usable; a submitted gate command is not presented as confirmed opening.

### UX-03 Keyboard, focus and touch
- [ ] Audit tab order and Enter/Space behavior, beginning with Metric and card-wide navigation. Shared focus currently targets .interactive only: inventory controls outside that class.
- [ ] Establish visible focus treatment across light/dark themes and ensure overflow clipping does not hide it.
- [ ] Check accessible names, button state attributes and 44 × 44 CSS px touch targets for primary controls; document compact exceptions and spacing.
- [ ] Audit sheets for initial focus, focus containment/restoration, Escape and background inertness.
- Acceptance: all main tasks work without a pointer; focus is always visible; opening/closing sheets returns users to the initiating control.

## P1 — Readability and semantic consistency

### UX-04 Long values and narrow cards — FIRST IMPLEMENTATION SLICE
- [x] Remove Metric's forced single-line primary value; wrap operational states and supporting explanations.
- [x] Replace Metric's 9px label/10px supporting text with existing shared xs/sm tokens.
- [x] Add a narrow two-column Storybook fixture with Hungarian state and English unavailable copy.
- [ ] Verify screenshots and geometry at mobile/tablet/desktop widths, both themes; verify numeric metrics remain legible.
- [ ] Extend the inventory to Room, Gate, Comfort, camera labels and action groups; avoid indiscriminate wrapping of compact controls.
- Acceptance: “Téli üzemmód” and its explanation remain fully visible in a half-width mobile Metric; no horizontal overflow; cards grow with content. Numeric units remain understandable.

### UX-05 Semantic color contracts
- [ ] Document distinct tokens/roles for brand/navigation, active operation, normal/neutral, warning, error and unavailable.
- [ ] Keep room identity color independent of health; preserve custom accent overrides.
- [ ] Audit green “normal” surfaces and cyan “active” pills. Define domain-specific meaning: open blinds are not an alarm; a disarmed alarm is not automatically “safe”.
- [ ] Pair semantic color with text/icon. Pilot shared roles before whole-library migration.
- Acceptance: equivalent states share meaning across components; color-blind users retain information; normal idle states do not compete with warnings.

### UX-06 Typography and contrast
- [ ] Inventory hardcoded sizes/weights and actual token usage, not just token definitions.
- [ ] Define title/value/body/supporting typography roles; keep operational information out of decorative microtext.
- [ ] Measure text contrast against actual rendered gradient surfaces: target WCAG AA 4.5:1 for normal text, 3:1 for qualifying large text, and 3:1 for essential control boundaries/focus indicators.
- [ ] Check 200% zoom/text enlargement and long names in both themes.
- Acceptance: measured results and theme variables are recorded; no information is lost at zoom; exceptions have an explicit rationale, not an assumed pass.

### UX-07 Localization and formatting
- [ ] Audit hardcoded built-in text; use shared localization while preserving explicit dashboard labels.
- [ ] Verify locale changes update already mounted cards even when entity objects stay unchanged (Metric shouldUpdate currently checks entity identity only).
- [ ] Define number/unit/date/time formatting via HA locale preferences; preserve decimals, configured suffixes and explicit time_locale behavior.
- [ ] Distinguish “Open” as a command from “Open” as navigation; use domain-specific state labels.
- Acceptance: English/Hungarian fixtures are internally consistent; Hungarian decimals and units are correct; live locale switching works; custom text remains untouched.

### UX-08 Surface and elevation system
- [ ] Inventory local gradients, borders, shadows and radii against shared tokens.
- [ ] Define base card, interactive surface, selected state and overlay elevation; reduce redundant effects.
- [ ] Prototype in Metric, Room and Comfort before migrating all cards; retain recognizable Luma shape and restrained tint.
- Acceptance: light/dark renders show a clear hierarchy; interactive cues survive reduced motion and keyboard use; no reliance on hover for essential meaning.

## P2 — Context and feedback

### UX-09 Data provenance and freshness
- [ ] Define optional reusable source/freshness presentation for conflicting measurements and stale values.
- [ ] Verify no component silently treats restored/stale data as live; do not guess a universal freshness threshold.
- [ ] Keep source entity reachable via More Info when useful.
- Acceptance: local temperature versus forecast-provider temperature can be distinguished without baking installation choices into Luma. The observed 7°C vs 14.4°C difference also needs a separate dashboard data-source decision.

### UX-10 Hero attention hierarchy
- [ ] Audit duplicated update summaries, chips and banners; define one primary presentation per signal.
- [ ] Separate routine maintenance from actionable household incidents; preserve explicit runtime policy.
- [ ] Verify acknowledged/snoozed incidents and coverage gaps remain discoverable.
- Acceptance: important issues remain visible; a routine update does not repeat or dominate; “no alerts” does not imply full data coverage.

### UX-11 Navigation, media and overlays
- [ ] Test navbar plus media dock using actual viewport captures and scrolling; full-page screenshot overlap alone is not proof of inaccessible content.
- [ ] Verify bottom-space reservation, safe areas, software keyboard and final-card reachability.
- [ ] Evaluate optional compact/collapsible media presentation; preserve immediate pause and clear reopen affordance.
- [ ] Standardize sheet headers, close controls, scroll bounds and motion through the existing shared shell.
- Acceptance: all content and controls remain reachable at every viewport; sheets neither leak background scroll nor hide focus; reduced motion is honored.

## P3 — Prevent regression

### UX-12 Reference gallery and documentation
- [ ] Add a design-system Storybook page showing status/action/navigation, semantic colors, typography, surfaces and all state variants together.
- [ ] Add component author guidance and review checklist; document public API changes in README only when introduced.
- [ ] Add focused browser checks for real failure modes: overflow, nested-action propagation, locale updates, missing data and focus restoration.
- [ ] Record screenshot baseline locations, viewport/theme/locale and validation commands for each completed slice.
- Acceptance: a new component can adopt existing rules without copying arbitrary CSS; checks assert behavior rather than implementation strings.

## Proposed implementation sequence

1. UX-04 Metric readability pilot and visual evidence.
2. UX-03 + UX-01 Metric/Gate/Room interaction semantics and focus.
3. UX-02 + UX-07 state and localization correctness.
4. UX-05 + UX-06 + UX-08 shared visual roles, measured contrast, representative pilots.
5. UX-09–11 contextual feedback and overlays, then UX-12 catalogue consolidation.

## Session record

2026-11-14: clean repository at start, version 0.61.0. First slice changes only Metric presentation and adds a Storybook fixture. Dashboard layout and deployment are separate tasks. Validation pending below.

First-slice validation: npm run check, npm run build and npm run build:docs passed after the final change. Local mocked Storybook captures at 390/768/1280 viewport widths with light/dark surface overrides passed primary-value overflow checks. Screenshots: /private/tmp/luma-ux-metric/. Browser runner: /private/tmp/luma-ux-metric-check.mjs (temporary evidence, not CI). Visually inspected the narrow mobile fixture: the initial wrap-only version was too cramped, so Metric now moves the icon above text when its own container is at most 200px wide. Full theme contrast measurement and numeric fixture comparison remain open; this is not a claim of WCAG conformance. No release, live dashboard write or operational action was performed.


## Release 0.61.1 — interaction pilot

- Metric: separate native primary/secondary buttons, no parent click handler, visible action cues and inset keyboard focus. action:none has no control affordance. Includes the long-state readability slice above.
- Room: native header action, separate bordered quick controls (44px minimum height), plain noninteractive status for action:none, toggle pressed state, no parent-click propagation. Locale changes invalidate the render.
- Gate: neutral unknown/unavailable tone, native control focus treatment, Escape dismissal and focus return; close button gets initial focus. Both display modes require inline second-tap confirmation. Pending requests disable repeat commands, rejection displays an error and supports retry. Popover remains nonmodal; full modal focus containment/inertness audit remains open.
- Opt-in shared lumaInteractionStyles keeps changes scoped to the three pilot cards.
- Storybook: Design system / Interactions contains Metric, Room and Gate fixtures.
- Browser regression: scripts/check-interactions-ui.mjs covers keyboard activation, primary/secondary isolation, status-only controls, touch heights, confirmation, pending/failure, focus return and unavailable states. Captures at 390/768/1280 in light/dark surfaces under /private/tmp/luma-interactions-ui. HA icons in the Storybook mock may appear as placeholders; these captures validate geometry and interaction, not icon artwork or complete theme conformance.
- Remaining: whole-library inventory/migration, comprehensive focus trap review, measured contrast, localization/number formatting, and remaining UX-04 numeric comparison. Partial pilot completion is not completion of the entire UX backlog.

Final 0.61.1 verification: all required checks/builds passed; the browser suite passed again against the built static Storybook (not only the dev server). Inspected mobile light Metric, dark Room and dark Gate confirmation captures. Confirmation uses warning tint. The previous server stopped before the last rerun; restarting a localhost-only static server resolved the harness connection failure. No real HA actions were invoked.
