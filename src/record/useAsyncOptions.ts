import * as React from "react";

export interface AsyncOptions<T> { options: T[]; loading: boolean; error: string }

/** Debounced search through a callback; late answers of superseded queries are dropped. */
export function useAsyncOptions<T>(search: ((q: string) => Promise<T[]>) | undefined, query: string, enabled: boolean, debounceMs = 250): AsyncOptions<T> {
  const [state, setState] = React.useState<AsyncOptions<T>>({ options: [], loading: false, error: "" });
  const seq = React.useRef(0);
  React.useEffect(() => {
    if (!enabled || !search) { setState({ options: [], loading: false, error: "" }); return; }
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const timer = setTimeout(() => {
      search(query).then(
        (options) => { if (id === seq.current) setState({ options, loading: false, error: "" }); },
        (e) => { if (id === seq.current) setState({ options: [], loading: false, error: e instanceof Error ? e.message : String(e) }); },
      );
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [search, query, enabled, debounceMs]);
  return state;
}
