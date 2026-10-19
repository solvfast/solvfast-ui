import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Consistent page header used across the whole app. Layout (start → end):
 *   [ back ] [ title / subtitle / meta ] …………… [ actions ]
 * Pass `backTo` (a route) or `onBack` (a handler) to show a left-aligned back button (RTL-aware arrow).
 * `meta` renders a details row under the title — used to surface record details (health, dates, owner…).
 */
export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  backTo,
  onBack,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  backTo?: string;
  onBack?: () => void;
  className?: string;
}) {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const showBack = backTo !== undefined || onBack !== undefined;
  const Back = language === "ar" ? ArrowRight : ArrowLeft;

  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo !== undefined) navigate(backTo);
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-4 md:px-6", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleBack}
            aria-label={t("back")}
            title={t("back")}
          >
            <Back className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
          {meta && <div className="mt-1.5">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
