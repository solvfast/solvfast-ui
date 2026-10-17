/** Reference for the number cards: the Design System's stat-card markup (DS v0.3.0 `92fc1cd`, StyleGuide section
 *  `data`, copied verbatim — it is inline markup there, not a component) and Sear's REAL DefinitionsGrid (Sear
 *  `7abc895`), rendered in Sear's CSS. Read-only. */
import { TrendingDown, TrendingUp } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { DefinitionsGrid } from "@sear/components/overview/DefinitionsGrid";
import { useLocale } from "@ui";
import { DS_STATS, MODULE_CARDS } from "../../playground/src/demo/cards-demo";

export function SearCards() {
  const { isRTL } = useLocale();
  return (
    <MemoryRouter>
      <div className="sear-studio min-h-screen">
        <div className="space-y-8 p-6">
          <div data-testid="ds-stats" className="grid gap-4 sm:grid-cols-3">
            {DS_STATS.map(([label, value, delta, up]) => (
              /* Number/stat card → LIQUID glass (content tier), not a flat pane. */
              <div key={label} className="glass glass--lg rounded-[20px] p-5 text-card-foreground">
                <p className="text-sm text-muted-foreground">{label}</p>
                <div className="mt-1 flex items-end justify-between">
                  <span className="font-brand text-4xl font-bold leading-none">{value}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${up ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>
                    {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{delta}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div data-testid="icon-cards">
            <DefinitionsGrid lang={isRTL ? "ar" : "en"} items={MODULE_CARDS.map((c) => ({
              titleEn: c.label.en, titleAr: c.label.ar, total: c.total, to: c.href, icon: c.icon, color: c.color,
            }))} />
          </div>
        </div>
      </div>
    </MemoryRouter>
  );
}
