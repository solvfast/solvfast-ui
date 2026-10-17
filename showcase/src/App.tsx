import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Skeleton } from "@ui";
import { PAGES } from "./routes";
import { useHashRoute } from "./useHashRoute";
import { useTr } from "./i18n";
import { Layout } from "./layout/Layout";
import { PageHeader } from "./doc/Doc";

const AppShellDemo = React.lazy(() => import("./demos/AppShellDemo"));

export function App() {
  const [route] = useHashRoute("overview");
  const tr = useTr();
  if (route === "demo/app-shell") return <React.Suspense fallback={null}><AppShellDemo /></React.Suspense>;
  const i = Math.max(0, PAGES.findIndex((p) => p.id === route));
  const page = PAGES[i];
  const prev = PAGES[i - 1], next = PAGES[i + 1];
  return (
    <Layout current={page.id}>
      <div className="space-y-12">
        <PageHeader group={page.group.title} title={page.title} description={page.description} />
        <React.Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>}>
          <page.Component />
        </React.Suspense>
        <nav className="flex items-center justify-between gap-4 border-t border-border pt-6 text-sm" aria-label={tr({ en: "Pages", ar: "الصفحات" })}>
          {prev ? <a href={`#/${prev.id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{tr(prev.title)}</a> : <span />}
          {next ? <a href={`#/${next.id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">{tr(next.title)}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></a> : <span />}
        </nav>
      </div>
    </Layout>
  );
}
