/** P35: per-workstream SIMULATED handler modules, spread into createFixtureTransport before `options.handlers`. */
import type { FixtureContextHandler } from "../fixtureTransport";
import { formHandlers } from "./form";
import { recordHandlers } from "./record";
import { listHandlers } from "./list";
import { viewsHandlers } from "./views";
import { coreHandlers } from "./core";
import { searchHandlers } from "./search";
import { sidebarHandlers } from "./sidebar";
import { socialHandlers } from "./social";
import { fieldsHandlers } from "./fields";

export const workstreamHandlers: Record<string, FixtureContextHandler> = { ...formHandlers, ...recordHandlers, ...listHandlers, ...viewsHandlers, ...coreHandlers, ...searchHandlers, ...sidebarHandlers, ...socialHandlers, ...fieldsHandlers };
