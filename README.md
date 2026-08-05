# Luma

A vibrant, context-aware dashboard suite for Home Assistant.

![Luma Home Hero preview](docs/luma-home-hero.svg)

Luma turns deeply nested dashboard configurations into focused, reusable
Lovelace components. It provides a shared visual language for responsive
heroes, status cards, contextual actions, and live system feedback.

## Current components

- `custom:luma-home-hero-card` — weather-aware home hero with a dynamic
  greeting, lightweight weather effects, configurable incident aggregation,
  per-incident acknowledgement, alarm status, and contextual banners.
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

## Home hero example

```yaml
type: custom:luma-home-hero-card
name: David
weather_entity: weather.home
alarm_entity: alarm_control_panel.home
active_action:
  action: navigate
  navigation_path: "#frequent"
active_exclude:
  - light.all_lights
  - media_player.*_cast
acknowledgements_entity: input_text.acknowledged_home_warnings
wind_threshold: 8
tap_action:
  action: navigate
  navigation_path: /lovelace/weather
incidents:
  - entity: binary_sensor.irrigation_controller
    state_not: "on"
    message: Irrigation controller offline
    tone: error
    dismissible: false
    navigation_path: /dashboard-irrigation/overview
  - entity_pattern: sensor.*_monitored_url
    related_suffix:
      from: _monitored_url
      to: _status
    state_not: Up
    message: "{count} monitored services unavailable"
    tone: error
    aggregate: true
    navigation_path: /dashboard-homelab/overview
  - device_classes:
      - smoke
      - moisture
      - gas
      - carbon_monoxide
    state: "on"
    message: "{name} requires attention"
    tone: error
irrigation_entity: sensor.active_irrigation_program
irrigation_path: /dashboard-irrigation/overview
waste_entity: sensor.waste_days
waste_ack_entity: input_boolean.waste_taken_out
waste_path: /lovelace/waste
waste_days: 2
```

Incident rules support an exact `entity`, an `entity_pattern` glob, or a list
of `device_classes`. Rules can use `state`, `state_not`, `above`, `below`, and
`for_minutes`. Use `{name}` for per-entity messages and `{count}` with
`aggregate: true`. Non-critical incidents can be hidden for 7 or 30 days when
an `acknowledgements_entity` input text helper is configured; error incidents
remain visible.

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
- `custom:luma-control-card` — responsive entity control with mapped states,
  contextual active styling, and configurable tap/hold actions.
- `custom:luma-control-group-card` — compact one-row control group for mobile
  layouts and dense dashboard sections.
