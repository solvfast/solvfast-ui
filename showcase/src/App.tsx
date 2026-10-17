/** One long page, as on the Design System site: the overview as the hero, then every other section collapsed under its
 *  heading; the sidebar follows the section in view (scroll-spy). `#<section>` opens and scrolls to a section (`#/<section>`,
 *  the earlier per-page form, still works); `#/demo/app-shell` is the app-shell demo, full screen. */
import * as React from "react";
import { Skeleton } from "@ui";
import { PAGES } from "./routes";
import { Layout } from "./layout/Layout";
import { DocSection } from "./doc/Doc";

const AppShellDemo = React.lazy(() => import("./demos/AppShellDemo"));
const HERO = "overview";
const IDS = new Set(PAGES.map((p) => p.id));
const readHash = () => decodeURIComponent(location.hash.replace(/^#\/?/, "").split("?")[0]);

/** Scroll to a section and keep it in place while the content above it loads (sections render lazily), for up to
 *  2 s or until the reader scrolls or types. */
let unpin = () => {};
function pin(id: string) {
  unpin();
  const scroll = () => document.getElementById(id)?.scrollIntoView({ block: "start" });
  const ro = new ResizeObserver(scroll);
  const stop = () => {
    ro.disconnect(); clearTimeout(timer);
    for (const e of ["wheel", "touchstart", "keydown"]) window.removeEventListener(e, stop);
  };
  const timer = setTimeout(stop, 2000);
  for (const e of ["wheel", "touchstart", "keydown"]) window.addEventListener(e, stop, { passive: true });
  ro.observe(document.body);
  requestAnimationFrame(scroll);
  unpin = stop;
}

function Loading() {
  return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
}

export function App() {
  const [hash, setHash] = React.useState(readHash);
  React.useEffect(() => {
    const on = () => setHash(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  if (hash.startsWith("demo/app-shell")) return <React.Suspense fallback={null}><AppShellDemo /></React.Suspense>;
  return <DocPage hash={hash} />;
}

function DocPage({ hash }: { hash: string }) {
  const [open, setOpen] = React.useState<Set<string>>(() => new Set(IDS.has(hash) ? [hash] : []));
  const [active, setActive] = React.useState(IDS.has(hash) ? hash : HERO);
  const hero = PAGES.find((p) => p.id === HERO)!;

  const show = React.useCallback((id: string) => {
    if (!IDS.has(id)) return;
    setOpen((s) => (s.has(id) ? s : new Set(s).add(id)));
    setActive(id);
    if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
    pin(id);
  }, []);
  React.useEffect(() => { if (hash) show(hash); }, [hash, show]);

  // Scroll-spy: the section crossing a band a quarter of the way down the viewport (as on the DS site).
  React.useEffect(() => {
    const els = PAGES.map((p) => document.getElementById(p.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-25% 0px -65% 0px", threshold: 0 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Layout active={active} onNavigate={show}>
      <div className="space-y-8 pt-8">
        <section id={HERO} className="scroll-mt-32 lg:scroll-mt-24">
          <React.Suspense fallback={<Loading />}><hero.Component /></React.Suspense>
        </section>
        {PAGES.filter((p) => p.id !== HERO).map((p) => (
          <DocSection key={p.id} id={p.id} title={p.title} description={p.description} open={open.has(p.id)} onToggle={() => toggle(p.id)}>
            <React.Suspense fallback={<Loading />}><p.Component /></React.Suspense>
          </DocSection>
        ))}
      </div>
    </Layout>
  );
}
