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
