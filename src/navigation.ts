export interface NavigationRoute {
  url: string;
  label: string;
  icon?: string;
  icon_selected?: string;
  match_paths?: string[];
}

const pathname = (url: string): string => url.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";

/** Explicit patterns keep page families in runtime config, without prefix collisions. */
export const routeIsActive = (route: NavigationRoute, path: string): boolean => {
  const current = pathname(path);
  return (route.match_paths || [route.url]).some(pattern => {
    const escaped = pathname(pattern).split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp(`^${escaped}$`).test(current);
  });
};

/** Preserve real links, modifier-clicks and Home Assistant's SPA navigation. */
export const navigateRoute = (event: MouseEvent, url: string, replace = false): void => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = new URL(url, window.location.href);
  if (target.origin !== window.location.origin) return;
  event.preventDefault();
  const oldURL = window.location.href;
  history[replace ? "replaceState" : "pushState"](null, "", target);
  window.dispatchEvent(new Event("location-changed"));
  if (new URL(oldURL).hash !== target.hash) {
    window.dispatchEvent(new HashChangeEvent("hashchange", {oldURL, newURL: target.href}));
  }
};
