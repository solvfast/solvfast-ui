/** SIMULATED backend for development and tests — request/response shapes only, never evidence of Frappe behaviour. */
export { createFixtureTransport, fixtureFields, BUILTIN_FIXTURE_META } from "./fixtureTransport";
export type { FixtureOptions, FixtureStore, FixtureTransport, FixtureHandler, FixtureCall, FixtureContext } from "./fixtureTransport";
/** Opt-in SIMULATED server-side permission evaluation (`createFixtureTransport(backend, { permissions })`). */
export { simScenario, SIM_SCENARIO_NAMES, SIM_RIGHTS, AUTOMATIC_ROLES, BUILTIN_PERMISSION_HOOKS, COMMENT_PERMISSIONS, createPermissionEngine, permissionError } from "./permissions";
export type { SimulatedPermissions, SimUserPermission, SimDocShare, SimControllerHook, SimPermissionContext, SimUser, SimScenarioName, SimDocPermissions, PermissionEngine } from "./permissions";
/** P35: the SIMULATED Kanban Board fixture meta and the views demo site (Product, Project Task, boards). */
export { KANBAN_BOARD_FIXTURE_META, VIEWS_DEMO_META, viewsDemoBackend } from "./handlers/views";
/** P36b: SIMULATED Form Sidebar pieces (docinfo attachments / tags, uploads) and bulk / social demo backends. */
export { withSimulatedSidebar } from "./handlers/sidebar";
export { bulkUpdateHandler, bulkDemoBackend } from "./handlers/list";
