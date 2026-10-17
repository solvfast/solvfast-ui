import * as React from "react";

/** `#/<page>` routing — no router dependency; works from any static host. */
export function useHashRoute(fallback: string) {
  const read = () => location.hash.replace(/^#\/?/, "").split("?")[0] || fallback;
  const [route, setRoute] = React.useState(read);
  React.useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [route, (to: string) => { location.hash = `/${to}`; }] as const;
}
