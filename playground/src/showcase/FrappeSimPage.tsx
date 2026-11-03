/**
 * Stage B visual matrix page (A6): the 0.4.0 Frappe components over the SIMULATED backend (`createFixtureTransport`) with
 * the REAL 15.110 metadata (tests/fixtures/real-15.110). Everything on it is Simulated; nothing is evidence of Frappe behaviour.
 * `?view=frappe-sim&c=<scenario>`; direction override `&dir=ltr|rtl` (host direction different from the UI language).
 * The site itself (metas, demo documents, failure handlers) lives in `../demo/sim-site.ts`, shared with the showcase.
 * Playground only.
 */
import * as React from "react";
import { useLocale } from "@ui";
import { FrappeAssignTo, FrappeForm, FrappeListView, FrappeProvider, FrappeTimeline, FrappeWorkflowActions, type FrappeDoc } from "@ui/frappe";
import type { FixtureHandler } from "../../../src/frappe/testing";
import { createSimSite, SCENARIO_HANDLERS, T, todos } from "../demo/sim-site";

export function FrappeSimPage() {
  const params = new URLSearchParams(location.search);
  const c = params.get("c") ?? "form-contact";
  const dir = params.get("dir");
  const { isRTL } = useLocale();
  React.useEffect(() => { if (dir) document.documentElement.dir = dir; }, [dir]);
  const [ready, setReady] = React.useState(false);
  const env = React.useMemo(() => createSimSite({
    handlers: (SCENARIO_HANDLERS as Record<string, Record<string, FixtureHandler> | undefined>)[c],
    latency: c === "form-loading" || c === "list-loading" ? 3_600_000 : 0,
    todoCount: c === "list-empty" ? 0 : 45,
  }), [c]);

  // history for the timeline: comments, an assignment and two saves (Version rows)
  React.useEffect(() => {
    if (c !== "timeline" && c !== "workflow") { setReady(true); return; }
    void (async () => {
      if (c === "timeline") await env.seedHistory("ToDo", "TD-0001", { status: "Closed", priority: "Low" });
      else await env.seedHistory("Approval Memo", "AM-1", { title: "Annual travel budget 2027", amount: 14000 });
      setReady(true);
    })();
  }, [env, c]);
  if (!ready) return <p className="p-6">…</p>;

  const wrap = (node: React.ReactNode) => (
    <FrappeProvider client={env.client} queryClient={env.qc} session={{ user: "Administrator", fullName: "Administrator", roles: ["System Manager", "All"] }}>
      <div className="p-6 md:p-8" data-scenario={c} data-isrtl={String(isRTL)}>{node}</div>
    </FrappeProvider>
  );
  switch (c) {
    case "form-contact": case "form-error": case "form-loading": case "form-save-error": return wrap(<FrappeForm doctype="Contact" name="Sara Al-Otaibi" />);
    case "form-new": return wrap(<FrappeForm doctype="ToDo" />);
    case "form-todo": return wrap(<FrappeForm doctype="ToDo" name="TD-0002" />);
    case "form-readonly": return wrap(<FrappeForm doctype="Approval Memo" name="AM-2" />);
    case "form-workflow": return wrap(<FrappeForm doctype="Approval Memo" name="AM-1" />);
    case "list": case "list-empty": case "list-error": case "list-loading": return wrap(
      <FrappeListView doctype="ToDo" selectable bulk={{ permissions: { read: true, write: true, delete: true, submit: false, cancel: false, create: true } as never }} storage={null} />,
    );
    case "timeline": case "workflow": {
      const dt = c === "timeline" ? "ToDo" : "Approval Memo";
      const d = (c === "timeline" ? todos(1)[0] : { doctype: "Approval Memo", name: "AM-1", title: "Annual travel budget", workflow_state: "Pending", docstatus: 0, owner: "Administrator", modified: T, creation: T }) as FrappeDoc;
      return wrap(
        <div className="mx-auto grid max-w-3xl gap-6">
          {c === "workflow" && <FrappeWorkflowActions doc={d} user="Administrator" roles={["System Manager"]} />}
          <FrappeAssignTo doc={{ ...d, doctype: dt }} user="Administrator" canAssign canWrite />
          <FrappeTimeline doc={{ ...d, doctype: dt }} user="Administrator" isSystemManager canDeleteComment />
        </div>,
      );
    }
    default: return wrap(<p>unknown scenario {c}</p>);
  }
}
