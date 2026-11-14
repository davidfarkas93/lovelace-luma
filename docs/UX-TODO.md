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
- [x] Verify locale changes update already mounted Metric, Comfort, Room and Home Hero cards even when entity objects stay unchanged. Other cards remain to audit.
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


## State presentation slice — 0.61.2

- Added a shared presentation module: rejects blank/null/nonfinite measurements and restored entity values, preserves real zero, formats numbers by frontend language, and distinguishes unavailable/unknown/awaiting-fresh-data text. Explicit state maps and HA-native translations take precedence.
- Metric: localized numeric values, no units on missing measurements, neutral unavailable accent, separate primary time/duration/absolute/sign formatting from secondary values, and frontend time-format preference support with explicit time_locale preserved.
- Comfort: required temperature/humidity and configured PM2.5 must be available before “Comfortable”; partial data is neutral. Known warning/error conditions still win, with missing sources named alongside them. Optional outdoor data does not gate indoor comfort. Displayed units come from source entities where available; configured temperature thresholds remain in the source measurement's units.
- Room: missing environmental measurements remain visible, unavailable/restored command controls are disabled, More Info stays accessible, unknown toggle state does not falsely announce aria-pressed=false. State labels have native translation/localized fallback and real units.
- Home Hero: unavailable/restored weather attributes are suppressed, genuine zero wind remains visible, unavailable/missing alarm is neutral and visible, core missing sources join the attention summary. Quiet unmonitored state says “no active alerts” rather than claiming all systems operational.
- Locale changes refresh all four components without an entity change. This slice follows language for numeric formatting; full independent HA number-format preferences and whole-library migration remain open.
- Validation: pure model regression added to npm run check; 24 light/dark responsive browser captures plus mounted-component locale switching, zero/blank/restored/partial states, severity preservation and independent secondary formatting pass. Files: scripts/check-presentation.mjs, scripts/check-state-presentation-ui.mjs. Evidence: /private/tmp/luma-state-ui. Main check, bundle and docs build passed. No physical device actions were used.

## Surface/contrast pilot — 0.61.3

UX-05/06/08: Metric, Room, Gate and Comfort now opt into shared lumaSurfaceStyles.
Room identity color is restricted to its icon. Active light/fan/media controls use
the informational role rather than warning/success colors; a stationary open cover
is neutral. Closed gates and normal comfort are neutral; open gate attention and
Comfort warning/error remain visibly labeled. Explicit accent overrides remain.
Text uses primary or stronger supporting theme colors; semantic hues are
supplemental icon/badge accents. Control borders/focus are distinct. Card surfaces,
radii and low elevation are shared. PM2.5 particle animation is removed; actual
measurements and threshold evaluation are unchanged. Theme background transitions
were removed from Metric/Comfort to avoid a transient mismatch with new text color.

Added Storybook State Gallery plus scripts/check-surfaces-ui.mjs. Reference light
and dark themes at 390/768/1280: 348 text samples (including Gate confirmation),
minimum text contrast 7.68:1, control boundary 3.07:1, focus 13.13:1. 12 captures and
raw measured pairs are in /private/tmp/luma-surfaces-ui/contrast.json. Solid computed
backgrounds are alpha-composited through ancestor/shadow boundaries; unexpected
gradients fail the harness. Decorative icons and disabled controls are excluded.
Targets: normal text >=4.5:1, boundaries/focus >=3:1, using W3C guidance:
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

Scope remains a pilot: arbitrary custom themes, complete-library migration,
200% text/zoom audit, and full accessibility conformance are still open. Existing
state and interaction browser suites must pass before release. Live screenshots
verify adoption separately; no operational action is used for testing.


0.61.4 live-verification follow-up: 0.61.3 installed successfully and all three
responsive captures showed the new surfaces. The larger Gate hint was ellipsized
in half-width mobile cards; it now wraps. The correction is a new patch release,
not a replaced tag. A two-column narrow Gate fixture covers this real layout.

## User feedback after 0.61.4 — refinement preview

The neutral/outlined pilot was judged too visually heavy and lost Luma's character.
Do not treat UX-05/06/08 as accepted merely because numeric contrast targets passed.
A preview-only alternative draws on Radix tonal scales, Material surface roles and
Atlassian elevation. See docs/SURFACE-REFINEMENT-PREVIEW.md and Storybook Design
review / Surface refinement. Strong focus, native actions and data correctness are
retained; always-visible high-contrast borders are not a universal requirement.
The user accepted the concrete comparison. 0.61.5 adopts the refined shared surfaces,
room gradients, subdued control fills, lighter typography and closed-gate success
tint. Gradient-aware text/focus checks and responsive mock interaction checks pass.

0.61.6 correction: garage contacts report `off`, while cover entities report
`closed`. Both now use the same closed/success tone; the configured state_entity
remains authoritative over the actuator relay. A browser regression covers off,
on, unknown, unavailable and unexpected contact states.

## Comfort consolidation — 0.62.0

- [x] Align Room/Comfort icon cells, headings, radii, surfaces and tonal controls.
- [x] Separate overall status, source-labelled measurements, causes and activity.
- [x] Give fully known comfortable conditions a subtle success tint; retain neutral missing data.
- [x] Add optional climate controls, shown only while enabled (or a data-status row when unavailable).
- [x] Keep initial AC activation in the details sheet; header opens details, individual readings open their source.
- [x] Preserve thresholds, state semantics, supported HVAC modes and mocked service verification.
- [x] Installed 0.62.0 and moved the main view's standalone Climate card into its existing environment sheet; verified live mobile/tablet/desktop captures.

Validation: required checks/builds and all three release workflows passed; 30 new
responsive Comfort/Room captures, 24 state-presentation captures and 1,560 text
contrast samples passed. The migrated view was re-read to verify one integrated
Comfort card and the standalone Climate card only inside the details sheet.
The live screenshot API cannot open URL fragments; sheet interaction is verified
locally with mocked data and commands. No real HVAC action was used for testing.

## Compact Comfort — 0.62.1

Reduce numeric emphasis (23/21px to 16px, medium weight), section gaps (16/14px
to 8px), and context-chip padding. Keep 44px targets and the Room header pattern.
Replace the standalone cause row with per-reading severity tint and a directional
marker, with an explicit tooltip/accessibility label. Other normal measurements
keep their normal styling even when a different measurement is severe.
