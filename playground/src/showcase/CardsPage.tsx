/** The number cards on @solvfast/ui — compared with the Design System's markup and Sear's real DefinitionsGrid
 *  (tools/parity ?view=cards). Playground only. */
import { IconStatCard, StatCard } from "@ui";
import { DS_STATS, MODULE_CARDS } from "../demo/cards-demo";

export function CardsPage() {
  return (
    <div className="space-y-8 p-6">
      <div data-testid="ds-stats" className="grid gap-4 sm:grid-cols-3">
        {DS_STATS.map(([label, value, delta, up]) => (
          <StatCard key={label} label={label} value={value} trend={{ value: delta, direction: up ? "up" : "down" }} />
        ))}
      </div>
      <div data-testid="icon-cards" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {MODULE_CARDS.map((c) => (
          <IconStatCard key={c.id} href={c.href} onClick={(e) => e.preventDefault()} label={c.label} value={c.total} icon={c.icon} color={c.color} />
        ))}
      </div>
    </div>
  );
}
