# Home hero refinement — local review

Storybook: Design review / Home hero (quiet, advice, windy, windy-clear, busy, warning, missing and waste).

Weather decoration and animation are retained. Main changes are shared subtle surfaces, smaller greeting, a distinct weather button, nonduplicated notification status, descriptive activity count, neutral routine alarm states, 44px action targets, and the shared alarm sheet with confirmation, pending and retry handling. Missing optional advice is hidden only in the hero; detailed weather views retain their unavailable message.

Existing activity aggregation remains: at least three visible banners collapse behind one summary. Verify expanding and navigating these independently of the weather button. Two-day waste reminders remain visible with neutral tone; today/tomorrow remain amber.

## Live adoption delta (not applied)

The current overview explicitly sets `wind_threshold: 8`, so a bundle update alone will not change that. Apply these two fields to its home-hero config using a fresh dashboard hash:

```json
{"wind_threshold":20,"active_label":"aktív világítás"}
```

The label is appropriate for this dashboard's lighting-only active list. It is not hard-coded into the reusable component. Preserve all existing source entities, active exclusions, attention policy, alarm modes/actions, appliance configuration and banner routes. Do not exercise live alarm commands during verification.

Wind is shown as three softly drawing and fading curled strokes beside the existing cloud, sun or moon. The staggered loop is shared by clear and cloudy weather. Reduced-motion preferences show static strokes.
