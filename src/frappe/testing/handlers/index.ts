/** P35: per-workstream SIMULATED handler modules, spread into createFixtureTransport before `options.handlers`. */
import type { FixtureHandler } from "../fixtureTransport";
import { formHandlers } from "./form";
import { recordHandlers } from "./record";
import { listHandlers } from "./list";
import { viewsHandlers } from "./views";
import { coreHandlers } from "./core";

export const workstreamHandlers: Record<string, FixtureHandler> = { ...formHandlers, ...recordHandlers, ...listHandlers, ...viewsHandlers, ...coreHandlers };
