// Frozen 0.61.4 styles for the design review comparison only.
export const legacySurfaceCSS = `
  :host {
    --luma-state-active: var(--info-color, var(--primary-color));
    --luma-state-warning: var(--warning-color);
    --luma-state-error: var(--error-color);
    --luma-state-neutral: var(--secondary-text-color);
    --luma-muted: color-mix(in srgb, var(--primary-text-color) 78%, var(--luma-surface));
    --luma-border: color-mix(in srgb, var(--primary-text-color) 14%, var(--luma-surface));
    --luma-control-border: color-mix(in srgb, var(--primary-text-color) 55%, var(--luma-surface));
    --luma-control-surface: color-mix(in srgb, var(--primary-text-color) 4%, var(--luma-surface));
    --luma-hover-surface: color-mix(in srgb, var(--primary-text-color) 7%, var(--luma-surface));
    --luma-shadow: 0 3px 12px rgb(0 0 0 / 6%);
  }
  ha-card {
    border: 1px solid var(--luma-border);
    border-radius: var(--luma-radius-card);
    background: var(--luma-surface);
    box-shadow: var(--luma-shadow);
  }
  .card.interactive:hover, .card:hover, .card:has(.top.interactive:hover), ha-card.compact:hover {
    transform: none;
    box-shadow: var(--luma-shadow);
    border-color: var(--luma-border);
  }
  .label, .env, .metrics, .hint, .popover-state, .details, .empty {
    font-size: var(--luma-text-sm);
    line-height: 1.45;
    color: var(--luma-muted);
  }
  .arrow, .action-cue { color: var(--luma-muted); }
  button:focus-visible, .interactive:focus-visible {
    outline: 2px solid var(--primary-text-color);
    outline-offset: -3px;
  }
  .secondary.secondary-action, .pill-control {
    color: var(--primary-text-color);
    background: var(--luma-control-surface);
    border: 1px solid var(--luma-control-border);
  }
  .secondary.secondary-action:hover, .pill-control:hover {
    background: var(--luma-hover-surface);
    border-color: var(--luma-control-border);
  }
  .pill { font-size: var(--luma-text-sm); line-height: 1.35; }
  .pill-status { color: var(--luma-muted); }
  .pill > ha-icon:first-child { color: var(--pill-color); }
  .pill-control[aria-pressed="true"] {
    background: color-mix(in srgb, var(--pill-color) 12%, var(--luma-surface));
  }
  /* Readable text carries meaning; theme accents are supplemental, never the text color. */
  .badge, .operation, .status { color: var(--primary-text-color); }
  .status .dot { background: var(--tone); }
  .operation ha-icon { color: var(--activity-color); }
  .badge { background: color-mix(in srgb, var(--tone) 12%, var(--luma-surface)); }
  .operation { background: color-mix(in srgb, var(--activity-color) 10%, var(--luma-surface)); }
  .popover {
    background: var(--luma-surface);
    border-color: var(--luma-border);
    box-shadow: 0 12px 32px rgb(0 0 0 / 18%);
    backdrop-filter: none;
  }
  .action, .action.primary, .popover .primary, .action.confirm, .popover .primary.confirm {
    color: var(--primary-text-color);
    background: var(--luma-control-surface);
    border: 1px solid var(--luma-control-border);
  }
  .action:hover, .popover .primary:hover { background: var(--luma-hover-surface); transform: none; }
  .action.confirm, .popover .primary.confirm {
    background: color-mix(in srgb, var(--luma-state-warning) 18%, var(--luma-surface));
  }
  .action.confirm:hover, .popover .primary.confirm:hover {
    background: color-mix(in srgb, var(--luma-state-warning) 23%, var(--luma-surface));
  }
  .error { color: var(--primary-text-color); border-left: 3px solid var(--luma-state-error); padding-left: 8px; }
  .pill[aria-pressed] .action-cue {display:inline-flex;}
  .pill[aria-pressed]::after {display:none;}
  .name, .title {font-weight:700;}
  .label {font-weight:760;letter-spacing:.05em;}
  .pill {font-weight:700;}
  .badge {font-weight:700;}
  .arrow, .primary-action > .action-cue {opacity:1;}
`;
