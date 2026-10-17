/**
 * Live-validation page: FrappeListView on the ISOLATED test site's ToDo (sfui-test.localhost), served through a local
 * proxy so it is same-origin with the site (e2e/frappe-site/vite.config.ts). Sear's and PMO's Frappe-served pages
 * inject the CSRF token with Jinja; this page reads it where Desk exposes it (/app) — the validation account has Desk
 * access. `?due=YYYY-MM-DD&created=YYYY-MM-DD&lang=en|ar` set the saved filters the validation applies.
 */
import { createRoot } from "react-dom/client";
import "../../../playground/src/index.css";
import "../../../styles/glass.css";
import { ThemeProvider, type SavedFilter } from "@ui";
import { FrappeListView } from "@ui/frappe";

const params = new URLSearchParams(location.search);
const due = params.get("due") ?? "";
const created = params.get("created") ?? "";
const lang = params.get("lang") === "ar" ? "ar" : "en";

const SAVED: SavedFilter[] = [
  { id: "due", label: "Due on the date", query: { conjunction: "and", conditions: [{ id: "d", field: "date", operator: "equals", value: due }] } },
  { id: "created", label: "Created on the date", query: { conjunction: "and", conditions: [{ id: "c", field: "creation", operator: "equals", value: created }] } },
  // an old saved filter whose first field no longer exists on the DocType
  { id: "old", label: "Old view", query: { conjunction: "and", conditions: [{ id: "o1", field: "old_priority_field", operator: "equals", value: "x" }, { id: "o2", field: "status", operator: "equals", value: "Open" }] } },
];

async function start() {
  const root = createRoot(document.getElementById("root")!);
  try {
    const html = await (await fetch("/app", { credentials: "same-origin" })).text();
    const token = html.match(/frappe\.csrf_token\s*=\s*"([^"]+)"/)?.[1];
    if (!token) throw new Error("No CSRF token on /app — not logged in?");
    (window as unknown as { csrf_token: string }).csrf_token = token;
  } catch (e) {
    root.render(<p role="alert">{String(e)}</p>);
    return;
  }
  root.render(
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <div className="sf-app min-h-screen">
        <div className="px-6 md:px-8 py-6">
          <FrappeListView
            doctype="ToDo"
            viewKey="sfui-live"
            storage={{ prefs: null, saved: { list: () => SAVED, save: () => SAVED, remove: () => SAVED } }}
            columns={[{ key: "description", label: { en: "Task", ar: "المهمة" }, type: "text", fieldtype: "Text Editor", className: "max-w-[26rem]" }]}
          />
        </div>
      </div>
    </ThemeProvider>,
  );
}
void start();
