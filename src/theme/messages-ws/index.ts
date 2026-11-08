/** P35: per-workstream message blocks merged into the package's en / ar messages. */
import { formEn, formAr } from "./form";
import { recordEn, recordAr } from "./record";
import { listEn, listAr } from "./list";
import { viewsEn, viewsAr } from "./views";
import { coreEn, coreAr } from "./core";
import { searchEn, searchAr } from "./search";
import { sidebarEn, sidebarAr } from "./sidebar";
import { socialEn, socialAr } from "./social";
// P36d history
import { historyEn, historyAr } from "./history";

export const wsEn = { ...formEn, ...recordEn, ...listEn, ...viewsEn, ...coreEn, ...searchEn, ...sidebarEn, ...socialEn, ...historyEn };
export const wsAr: { [K in keyof typeof wsEn]: string } = { ...formAr, ...recordAr, ...listAr, ...viewsAr, ...coreAr, ...searchAr, ...sidebarAr, ...socialAr, ...historyAr };
