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
