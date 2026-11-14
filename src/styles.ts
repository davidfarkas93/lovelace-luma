import { css } from "lit";

export const lumaTokens = css`
  :host {
    --luma-radius-hero: 24px;
    --luma-radius-card: 20px;
    --luma-radius-control: 14px;
    --luma-accent: var(--primary-color);
    --luma-surface: var(--ha-card-background, var(--card-background-color));
    --luma-border: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
    --luma-shadow: 0 14px 38px rgba(0, 0, 0, 0.06);
    --luma-muted: var(--secondary-text-color);
    --luma-text-xs: 10px;
    --luma-text-sm: 12px;
    --luma-text-md: 14px;
    --luma-text-lg: 18px;
    --luma-weight-medium: 560;
    --luma-weight-strong: 680;
    --luma-weight-title: 720;
    display: block;
  }

  * {
    box-sizing: border-box;
  }

  ha-card {
    color: var(--primary-text-color);
    overflow: hidden;
  }

  button,
  [role="button"] {
    -webkit-tap-highlight-color: transparent;
  }

  .interactive {
    cursor: pointer;
  }

  .interactive:focus-visible {
    outline: 2px solid var(--luma-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// Opt-in interaction contract for cards migrated to explicit native controls.
// Inset focus remains visible inside ha-card's clipped rounded surface.
export const lumaInteractionStyles = css`
  button { font: inherit; color: inherit; }
  button:not(:disabled) { cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -3px; }
  button:disabled { cursor: not-allowed; opacity: .55; }
  button:not(:disabled):active { filter: brightness(.94); }
  .action-cue { --mdc-icon-size: 16px; color: var(--luma-muted); flex-shrink: 0; }
`;

/** Opt-in surface/contrast contract; migrate and validate cards before opting in. */
export const lumaSurfaceStyles = css`
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
`;
