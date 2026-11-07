/** P35: per-workstream message blocks merged into the package's en / ar messages. */
import { formEn, formAr } from "./form";
import { recordEn, recordAr } from "./record";
import { listEn, listAr } from "./list";
import { viewsEn, viewsAr } from "./views";
import { coreEn, coreAr } from "./core";

export const wsEn = { ...formEn, ...recordEn, ...listEn, ...viewsEn, ...coreEn };
export const wsAr: { [K in keyof typeof wsEn]: string } = { ...formAr, ...recordAr, ...listAr, ...viewsAr, ...coreAr };
