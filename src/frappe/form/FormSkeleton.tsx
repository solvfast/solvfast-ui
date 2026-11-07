import * as React from "react";
import { Skeleton } from "../../primitives/skeleton";
import { useLocale } from "../../theme/ThemeProvider";

/** Loading: skeleton blocks (with a foreground tint so they read in dark themes too) and, after 300 ms, a text
 *  status (CONTRACT §3: never a loader without text for more than 300 ms). */
export function FormSkeleton() {
  const { t } = useLocale();
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => { const id = setTimeout(() => setSlow(true), 300); return () => clearTimeout(id); }, []);
  const block = "bg-foreground/10";
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className={`h-7 w-1/3 ${block}`} />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className={`h-9 w-full ${block}`} />)}
      </div>
      <p role="status" className="text-sm text-muted-foreground">{slow ? t("loading") : ""}</p>
    </div>
  );
}
