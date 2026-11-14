# Agenda refinement — v0.64.3

The Luma tab shell uses the shared surface, a thin active underline, a 48px tab target and content-driven height. Arrow keys, Home and End select and focus tabs; Tab enters the labelled panel. Child cards are cached so switching tabs preserves their local state. Failed child creation produces a localized message rather than leaving the previous tab's content under a different label.

Storybook: **Design review / Agenda**. The shell is production code. The calendar and shopping list are explicitly labelled visual fixtures, not the real third-party calendar or Home Assistant todo-list. Their item changes are local only. Do not treat these fixtures as proof of native card appearance or service behavior.

## Calendar configuration delta

Apply only to the calendar-card-pro child, preserving its entities, weather, actions and other options. Verified against the installed Calendar Card Pro v5.2.0 reference.

```json
{
  "show_week_numbers": null,
  "vertical_line_width": "2px",
  "event_spacing": "6px",
  "day_spacing": "8px",
  "day_font_size": "20px",
  "weekday_font_size": "10px",
  "month_font_size": "10px",
  "event_font_size": "14px",
  "time_font_size": "11px",
  "location_font_size": "11px",
  "additional_card_spacing": "0px"
}
```

These are Calendar Card Pro styling options, documented in its [configuration reference](https://calendar-card-pro.alexpfau.com/reference/configuration). In v5.2.0, hiding week numbers requires null rather than false. Keep the 5-day range, two-event collapsed view, expand action and event weather. Use muted 11px weather copy; preserve weather sources and forecast semantics.

The native todo-list retains its entity, sorting and add/complete controls. The shell supplies shared margins and inherited body typography tokens; exact native spacing must be assessed in HA. No shadow-DOM patches or custom replacement todo API are introduced.
