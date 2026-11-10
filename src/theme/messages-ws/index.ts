/** P35: per-workstream message blocks merged into the package's en / ar messages. */
import { formEn, formAr } from "./form";
import { recordEn, recordAr } from "./record";
import { listEn, listAr } from "./list";
import { viewsEn, viewsAr } from "./views";
import { coreEn, coreAr } from "./core";
import { searchEn, searchAr } from "./search";
import { sidebarEn, sidebarAr } from "./sidebar";
import { socialEn, socialAr } from "./social";
import { fieldsEn, fieldsAr } from "./fields";
// P36d history
import { historyEn, historyAr } from "./history";
// P36e ftypes
import { ftypesEn, ftypesAr } from "./ftypes";
// P36e print
import { printEn, printAr } from "./print";
// P36e submit
import { submitEn, submitAr } from "./submit";
// Lifecycle (LifecycleRail / LifecycleDiagramDialog)
import { lifecycleEn, lifecycleAr } from "./lifecycle";

export const wsEn = { ...formEn, ...recordEn, ...listEn, ...viewsEn, ...coreEn, ...searchEn, ...sidebarEn, ...socialEn, ...fieldsEn, ...historyEn, ...ftypesEn, ...printEn, ...submitEn, ...lifecycleEn };
export const wsAr: { [K in keyof typeof wsEn]: string } = { ...formAr, ...recordAr, ...listAr, ...viewsAr, ...coreAr, ...searchAr, ...sidebarAr, ...socialAr, ...fieldsAr, ...historyAr, ...ftypesAr, ...printAr, ...submitAr, ...lifecycleAr };
