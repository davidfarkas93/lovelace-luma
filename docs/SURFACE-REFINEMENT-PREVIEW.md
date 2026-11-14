# Luma surface refinement — accepted for 0.61.5

The user found 0.61.4 too neutral and outlined. The proposal restores Luma's color
and depth without rolling back native controls, confirmation, missing-data handling,
localization or keyboard focus. The user accepted the comparison. Version 0.61.5 adopts it in the shared runtime styles.

## References and their application

- [Radix Colors: scale use cases](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale): distinguish subtle backgrounds, normal/hover/selected component surfaces, borders and text. Adopt that role separation, not the entire palette or framework. Luma's proposed control backgrounds use restrained tonal steps instead of permanent bright outlines.
- [Material 3: color roles](https://m3.material.io/styles/color/the-color-system/): use related surface/container tones to create hierarchy. Apply a small room-color tint to the card and a stronger tint to the icon, while preserving runtime-provided accents.
- [Atlassian: elevation](https://atlassian.design/foundations/elevation/): pair surfaces and shadows intentionally; dark-mode depth also comes from surface color. Keep base cards quiet, reserve stronger elevation for overlays, and avoid piling hover motion on top of color changes.
- [W3C: non-text contrast, Boundaries](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html#boundaries): an identifiable text/icon control does not always require a high-contrast perimeter. The previous blanket 3:1-border target was an unnecessarily restrictive design choice. Text, meaningful state cues and focus still need adequate contrast.

These are design principles, not a claim that a mixture of arbitrary theme colors
inherits any source system's contrast guarantees.

## Proposed visual rules

- Room card: soft identity-color gradient (approximately 11% to 3% tint); distinct room icons.
- Other cards: restrained 7% accent at one end, fading into the normal surface.
- Controls: 5% neutral fill, 9% on hover, 16% semantic fill for selected/on controls; subtle or transparent border.
- Keep 44px interaction targets; reduce visual weight through typography and decoration rather than shrinking targets.
- Remove the redundant tapping-hand icon from toggle controls; retain state text, a small state dot and native aria-pressed. Keep navigation chevrons.
- Supporting copy uses a calmer hierarchy; headings remain dominant.
- Closed-gate success tint returns as a small contextual cue, without turning every card into a large green panel. No live entity/rule changes.
- Strong focus remains keyboard-triggered, rather than an always-visible outline around every action.
- Keep dangerous-action confirmation and unavailable states intact.

## Review surfaces

Storybook: Design review / Surface refinement.
- Compare: current 0.61.4 versus proposed, identical components and mock data.
- Proposed: individual proposal for mobile and tablet inspection.
- Light: comparison in light mode.

`theme` and `variant` controls allow interactive review. The proposed panel now uses the real runtime styles without overrides. The current
panel applies frozen 0.61.4 styles from storybook/legacy-surfaces.ts for comparison.
The historical styles are not imported by src/index.ts.
The comparison uses the same small vector icon substitutes in both panels; real HA
icons are unchanged. Mock actions do not reach physical devices.

Implementation: storybook/refinement-preview.ts, stories/Refinement.stories.ts.
Verification: scripts/check-refinement-preview-ui.mjs.
Screenshots: docs/previews/surface-refinement/ (390/768/1280, light/dark).

Runtime styles live in src/styles.ts with the room identity gradient in its component.
Only an explicitly closed gate receives the success tint; other states retain their
existing semantics. Contrast checks evaluate both gradient endpoints and translucent
control backgrounds, with 4.5:1 text and 3:1 keyboard-focus thresholds. Labelled
controls do not require a permanently contrasting perimeter.

## Validation

- `npm run check`, `npm run build`, and `npm run build:docs` passed.
- Browser check passed at 390, 768 and 1280px in both themes: gradients applied, no card overflow, keyboard focus and one mocked keyboard action verified.
- Desktop dark/light and mobile dark captures visually reviewed. The narrow two-column mobile view wraps room metadata and control labels; production adoption should review these alongside real dashboard widths.
- Runtime surface checks passed: 696 text samples, minimum 4.86:1; focus minimum 11.81:1 in the tested themes.
- Interaction checks passed: separate actions, 44px targets, confirmation, Escape/focus, pending/failure and unavailable states. All service calls were mocked.
