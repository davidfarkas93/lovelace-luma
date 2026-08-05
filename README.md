# Luma

A vibrant, context-aware dashboard suite for Home Assistant.

Luma turns deeply nested dashboard configurations into focused, reusable
Lovelace components. It provides a shared visual language for responsive
heroes, status cards, contextual actions, and live system feedback.

## Current components

- `custom:luma-hero-card` — responsive hero with an optional entity, badge,
  chips, conditional banners, and native Home Assistant actions.
- `custom:luma-status-card` — compact entity or attribute status card.

This is an early development release. More components and graphical editors
will follow.

## Development

```bash
npm install
npm run check
npm run build
```

The HACS-compatible bundle is written to `dist/lovelace-luma.js`.

## Installation during development

1. Build the project.
2. Copy `dist/lovelace-luma.js` to Home Assistant's `config/www` directory.
3. Add `/local/lovelace-luma.js` as a JavaScript module under
   **Settings → Dashboards → Resources**.
4. Hard-refresh the Home Assistant frontend.

Once the repository has a GitHub release, it can be installed as a custom HACS
Dashboard repository.

## Hero example

```yaml
type: custom:luma-hero-card
entity: weather.home
name: Home
icon: mdi:home-heart
accent_color: var(--primary-color)
tap_action:
  action: navigate
  navigation_path: /lovelace/weather
badge:
  entity: alarm_control_panel.home
  name: Security
  icon: mdi:shield-home
  color: var(--success-color)
  show_state: true
chips:
  - entity: light.all_lights
    name: Lights
    icon: mdi:lightbulb-group
    state: "on"
    tap_action:
      action: more-info
banners:
  - entity: sensor.active_irrigation_program
    label: Irrigation running
    name: OPEN
    icon: mdi:sprinkler-variant
    color: var(--info-color)
    state_not:
      - None
      - unavailable
      - unknown
    tap_action:
      action: navigate
      navigation_path: /dashboard-irrigation/overview
```

## Status example

```yaml
type: custom:luma-status-card
entity: sensor.living_room_temperature
name: Living room
icon: mdi:sofa
accent_color: var(--warning-color)
tap_action:
  action: more-info
```

## Actions

Luma supports `none`, `navigate`, `more-info`, `toggle`, `perform-action`, and
the legacy `call-service` action name.

## License

[MIT](LICENSE)
