/**
 * Real-site harness page (P36; PREPARED, NOT RUN). Served by `vite preview` on 127.0.0.1:4821 with /api, /app and file
 * paths proxied to the owner-approved STAGING site only (vite.config.ts refuses anything else), so it is same-origin
 * with the site. Reads the CSRF token and the boot (user, roles, sysdefaults, lang) from Desk's /app page
 * (www/app.html:54-56), as Desk does — the accounts have Desk access.
 *
 * Query parameters:
 *   view=list|form|views   the P36 views on the seeded DocTypes (default: the legacy ToDo list of validate.mjs)
 *   doctype=<DocType>      default "SFUI Test Parent"
 *   name=<docname>         form only; omit for a new document
 *   selection=header|bar   list only; P36 mounts "header" (Desk's layout) — the package default is still "bar"
 *   lang=en|ar             UI language
 *   due=YYYY-MM-DD&created=YYYY-MM-DD   legacy ToDo saved filters (validate.mjs)
 */
import { createRoot } from "react-dom/client";
import "../../../playground/src/index.css";
import "../../../styles/glass.css";
import { ThemeProvider, type SavedFilter } from "@ui";
import { FrappeForm, FrappeListView, FrappeProvider, FrappeViews, readFrappeBoot, type FrappeBootPayload } from "@ui/frappe";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "todo";
const doctype = params.get("doctype") ?? "SFUI Test Parent";
const name = params.get("name") ?? undefined;
const selection = params.get("selection") === "bar" ? "bar" : "header";
const lang = params.get("lang") === "ar" ? "ar" : "en";
const due = params.get("due") ?? "";
const created = params.get("created") ?? "";

const SAVED: SavedFilter[] = [
  { id: "due", label: "Due on the date", query: { conjunction: "and", conditions: [{ id: "d", field: "date", operator: "equals", value: due }] } },
  { id: "created", label: "Created on the date", query: { conjunction: "and", conditions: [{ id: "c", field: "creation", operator: "equals", value: created }] } },
  // an old saved filter whose first field no longer exists on the DocType
  { id: "old", label: "Old view", query: { conjunction: "and", conditions: [{ id: "o1", field: "old_priority_field", operator: "equals", value: "x" }, { id: "o2", field: "status", operator: "equals", value: "Open" }] } },
];

type DeskBoot = {
  user?: { name?: string; roles?: string[]; full_name?: string; defaults?: Record<string, unknown> };
  sysdefaults?: Record<string, unknown>;
  lang?: string;
  time_zone?: { system?: string; user?: string };
  user_permissions?: FrappeBootPayload["user_permissions"];
};

/** Desk's boot (`frappe.boot = {...};` in /app) → the package's boot payload. Never logged. */
function bootFromDesk(html: string, token: string): FrappeBootPayload | undefined {
  const raw = html.match(/frappe\.boot\s*=\s*([\s\S]*?);\s*frappe\._messages/)?.[1];
  if (!raw) return undefined;
  const b = JSON.parse(raw) as DeskBoot;
  if (!b.user?.name) return undefined;
  return {
    user: b.user.name, full_name: b.user.full_name, roles: b.user.roles, lang: b.lang, csrf_token: token,
    sysdefaults: b.sysdefaults, time_zone: b.time_zone, defaults: b.user.defaults, user_permissions: b.user_permissions,
  };
}

function Page() {
  if (view === "form") return <FrappeForm doctype={doctype} name={name} />;
  if (view === "views") return <FrappeViews doctype={doctype} showUnavailable list={{ selectionMode: selection, create: {} }} />;
  if (view === "list") return <FrappeListView doctype={doctype} viewKey="sfui-p36" selectionMode={selection} create={{}} sidebar />;
  return (
    <FrappeListView
      doctype="ToDo"
      viewKey="sfui-live"
      storage={{ prefs: null, saved: { list: () => SAVED, save: () => SAVED, remove: () => SAVED } }}
      columns={[{ key: "description", label: { en: "Task", ar: "المهمة" }, type: "text", fieldtype: "Text Editor", className: "max-w-[26rem]" }]}
    />
  );
}

async function start() {
  const root = createRoot(document.getElementById("root")!);
  let boot: ReturnType<typeof readFrappeBoot>;
  try {
    const html = await (await fetch("/app", { credentials: "same-origin" })).text();
    const token = html.match(/frappe\.csrf_token\s*=\s*"([^"]+)"/)?.[1];
    if (!token) throw new Error("No CSRF token on /app — not logged in?");
    (window as unknown as { csrf_token: string }).csrf_token = token;
    boot = readFrappeBoot(bootFromDesk(html, token));
  } catch (e) {
    root.render(<p role="alert">{String(e)}</p>);
    return;
  }
  root.render(
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <FrappeProvider boot={boot}>
        <div className="sf-app min-h-screen">
          <div className="px-6 md:px-8 py-6" data-sfui-harness={view}>
            <Page />
          </div>
        </div>
      </FrappeProvider>
    </ThemeProvider>,
  );
}
void start();
