import { AlertTriangle, FolderOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Centered empty state with an icon, message and optional action (e.g. a "New Project" CTA). */
export function EmptyState({
  icon: Icon = FolderOpen,
  message,
  action,
}: {
  icon?: LucideIcon;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </Card>
  );
}

/** Error state with a retry button — used for failed React Query reads. */
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useApp();
  return (
    <Card className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-sm text-muted-foreground">{t("something_went_wrong")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>
      )}
    </Card>
  );
}

/** A simple stack of skeleton rows for list/table loading. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="hidden h-5 w-24 md:block" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="ms-auto h-5 w-28" />
        </div>
      ))}
    </Card>
  );
}
