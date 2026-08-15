# Luma

A polished, context-aware Lovelace card suite for Home Assistant.

![Luma home hero](docs/luma-home-hero.svg)

Luma replaces deeply nested `button-card` and `card-mod` configurations with
small, reusable web components. It shares one responsive visual language across
heroes, room summaries, controls, live status, tabs, and Material-inspired
bottom sheets while keeping actions and entity selection configurable at runtime.

## Cards

| Card | Purpose |
| --- | --- |
| `custom:luma-home-hero-card` | Weather-aware home hero, dynamic greeting, incidents, acknowledgements, alarm, waste and irrigation context |
| `custom:luma-hero-card` | General-purpose responsive hero with chips, badge and banners |
| `custom:luma-heading-card` | Compact, consistently weighted section heading |
| `custom:luma-control-card` | Entity action with mapped state and contextual styling |
| `custom:luma-control-group-card` | Dense, responsive row of controls |
| `custom:luma-metric-card` | Primary and secondary live metrics |
| `custom:luma-room-card` | Room summary with environment and quick actions |
| `custom:luma-comfort-card` | Indoor comfort and air-quality summary |
| `custom:luma-climate-card` | Compact climate controller |
| `custom:luma-tab-card` | Responsive tab container for any Lovelace cards |
| `custom:luma-active-card` | Runtime-filtered list of active entities |
| `custom:luma-popup-card` | Hash-driven, draggable Material-style bottom sheet |
| `custom:luma-alarm-card` | Alarm status and arming controls |
| `custom:luma-status-card` | Small entity or attribute status card |
| `custom:luma-sensor-grid-card` | Responsive, grouped sensor values without `entities` or `card-mod` |
| `custom:luma-remote-card` | Compact Android TV remote with navigation, playback and app shortcuts |
| `custom:luma-gate-card` | Gate and garage controls with an inline second-tap confirmation |
| `custom:luma-cover-card` | Cover position, motion state, progress bar and open/stop/close controls |
| `custom:luma-disclosure-card` | Compact expandable container for related controls |
| `custom:luma-temperature-card` | Comfort-colored temperature hero and comparable room scale |
| `custom:luma-energy-flow-card` | Animated live solar, home and grid power flow |
| `custom:luma-history-card` | Recorder-backed canvas history chart with signed ranges, gradients and touch inspection |
| `custom:luma-navigation-card` | Contextual navigation card with shared Luma styling |
| `custom:luma-homelab-hero-card` | Dynamic Kuma, Komodo and infrastructure health summary |
| `custom:luma-rack-cooling-card` | Rack thermal delta, fan speed and PWM visualization |
| `custom:luma-irrigation-hero-card` | Context-aware irrigation system status hero |
| `custom:luma-irrigation-schedule-card` | Schedule controller with equal-width weekday buttons |
| `custom:luma-irrigation-zone-card` | Confirmed zone start/stop with live progress |
| `custom:luma-irrigation-program-card` | Confirmed program launch with live progress |
| `custom:luma-logbook-card` | Recorder-backed event history grouped by day |

`luma-control-card` automatically recognizes active lights and media players,
and actions with `confirmation` use an inline second-tap confirmation state.
Lights receive a warm accent and brightness subtitle; media players receive a
distinct media accent and show the current title or application when available.

`luma-cover-card` supports `master`, `group`, and `compact` variants, allowing
the same behavior and visual language to cover whole-house, room, and individual
shutter controls. Destructive group actions can use inline second-tap confirmation.

## Installation

Add this repository to HACS as a custom **Dashboard** repository and install
Luma. HACS registers `/hacsfiles/lovelace-luma/lovelace-luma.js` as a module;
refresh the browser after an update.

For local development:

```bash
npm install
npm run check
npm run build
```

The HACS-compatible bundle is written to `dist/lovelace-luma.js`.

## Active entity filtering

The home hero and active card use the same runtime filter language. Rules are
evaluated against the current Home Assistant state and entity registry, so no
rebuild is needed when the dashboard configuration changes.

```yaml
active:
  # Both default to true. Hidden or disabled registry entries are ignored.
  exclude_hidden: true
  exclude_disabled: true
  include:
    # Keep useful light groups as one item.
    - entity: light.sofa_lights
      state: "on"
      tap_action:
        action: toggle

    # Then add individual lights, without duplicating groups.
    - domain: light
      state: "on"
      exclude_groups: true

    - domain: media_player
      state_not: ["off", "idle", "standby", "unknown", "unavailable"]

    - domain: climate
      attribute: hvac_action
      state: ["heating", "cooling", "drying", "fan"]

    - entity_pattern: sensor.*_power
      above: 10
  exclude:
    - light.all_lights
    - light.*_bulb_*
```

An include rule accepts `entity`, `entity_pattern`, or `domain`, plus `state`,
`state_not`, `above`, `below`, `attribute`, `exclude_groups`, and an optional
`tap_action`. `exclude` accepts entity-id globs. Earlier matching rules win the
display order and duplicate entity IDs are collapsed.

Use the same block under `custom:luma-active-card`:

```yaml
type: custom:luma-active-card
name: Active now
active:
  exclude_hidden: true
  include:
    - domain: light
      state: "on"
      exclude_groups: true
```

## Popup example

```yaml
type: custom:luma-popup-card
hash: "#active"
title: Active devices
icon: mdi:lightning-bolt-outline
max_width: 720
cards:
  - type: custom:luma-active-card
```

The popup has a scrim, a draggable dismiss handle, and an edit-mode preview so
it remains selectable in the Lovelace editor.

## Home hero example

```yaml
type: custom:luma-home-hero-card
weather_entity: weather.home
alarm_entity: alarm_control_panel.home
tap_action:
  action: navigate
  navigation_path: /lovelace/weather
active_action:
  action: navigate
  navigation_path: "#active"
alarm_action:
  action: navigate
  navigation_path: "#alarm"
waste_items:
  - entity: sensor.general_waste
    name: General
  - entity: sensor.plastic_waste
    name: Plastic
incidents:
  - entity_pattern: sensor.*_monitored_url
    state_not: Up
    message: "{count} monitored services unavailable"
    tone: error
    aggregate: true
    navigation_path: /dashboard-homelab/overview
```

Incident rules accept an exact `entity`, an `entity_pattern` glob, or
`device_classes`, together with `state`, `state_not`, `above`, `below`, and
`for_minutes`. `{name}` expands per entity and `{count}` works with
`aggregate: true`. Configuring an input-text acknowledgement entity enables
per-incident 7- or 30-day dismissal; error incidents remain visible.

## Actions

Cards support `none`, `navigate`, `more-info`, `toggle`, `perform-action`, and
the legacy `call-service` action spelling.

## License

[MIT](LICENSE)
