/** Data for the number cards (playground, showcase and the parity reference use the same). */
import { NAV_ITEMS } from "./sear-demo";

/** The Design System's stat-card example (StyleGuide section `data`), verbatim. */
export const DS_STATS = [["Components", "128", "+12%", true], ["Tokens", "342", "+4%", true], ["Deprecated", "7", "-2%", false]] as const;

/** Sear's brand palette for the icon squares (sear_studio/components/overview/overviewShared.tsx BRAND). */
export const PALETTE = ["#512195", "#11bf9d", "#fe4e18", "#25d0fe"] as const;

/** Sear Studio's overview grid: one card per module in nav order (Overview itself excluded), coloured by grid position
 *  (row + column) over 4 columns, as SearStudioOverviewPage.tsx does. Totals are fixed demo numbers. */
const TOTALS: Record<string, number> = {
  field_library: 1280, calendars: 4, channels: 7, connectors: 5, message_templates: 12, assignment_profile: 3,
  workflow_components: 9, playbooks: 8, service_module: 4, sla_policy: 5, life_cycles: 6, routing: 0,
};
export const MODULE_CARDS = NAV_ITEMS.filter((i) => i.id in TOTALS).map((i, idx) => ({
  id: i.id,
  label: i.label as { en: string; ar: string },
  total: TOTALS[i.id],
  href: i.href!,
  icon: i.icon!,
  color: PALETTE[(Math.floor(idx / 4) + (idx % 4)) % 4],
}));
