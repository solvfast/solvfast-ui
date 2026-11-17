/**
 * 0.10 consolidation — the lifecycle diagram (LifecycleGraphView, LifecycleGraphDialog) and record editing (FrappeForm
 * `sectionEdit` with `editScope` "section" and "record") on one page, for e2e/consolidation-010.mjs. The graphs and the
 * DocType come from consolidation-010-spec.json, which the browser test reads too. The form runs on the in-browser
 * Frappe simulator (SIMULATED: nothing here talks to a server).
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { Button, LifecycleGraphView, lifecycleGraph, useLocale, type LifecycleDefinition } from "@ui";
import { FrappeForm, FrappeProvider, createFrappeClient, type DocTypeMeta, type FrappeDoc, type FrappeDocField } from "@ui/frappe";
import { createFixtureTransport } from "../../../src/frappe/testing";
import { LifecycleGraphDialog, type LifecycleGraphData } from "../../../src/sayr";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import spec from "./consolidation-010-spec.json";

type Lang = "en" | "ar";
type GraphSpec = Pick<typeof spec.sada, "initial" | "current" | "path" | "states" | "transitions">;

const definition = (g: GraphSpec, lang: Lang): LifecycleDefinition => ({
  states: g.states.map((s) => ({ id: s.id, label: s[lang], phase: s.phase as "open" | "on_hold" | "closed" })),
  transitions: g.transitions.map((t) => ({ id: t.id, from: t.from, to: t.to, label: t[lang] })),
});

/** The same lifecycle as Sayr sends it (`record_page` → `lifecycle`), for the sayr adapter (`LifecycleGraphDialog`). */
const sayrData = (g: GraphSpec): LifecycleGraphData => ({
  initial_state: g.initial,
  states: g.states.map((s) => ({ state_key: s.id, name_en: s.en, name_ar: s.ar, phase: s.phase })),
  transitions: g.transitions.map((t) => ({ transition_key: t.id, from_state: t.from, to_state: t.to, action_en: t.en, action_ar: t.ar })),
});

function GraphBox({ id, g }: { id: string; g: GraphSpec }) {
  const { language } = useLocale();
  const lang: Lang = language === "ar" ? "ar" : "en";
  const graph = React.useMemo(() => lifecycleGraph(definition(g, lang), g.current, g.path), [g, lang]);
  return (
    <div className="relative h-[560px] overflow-hidden rounded-xl border border-border bg-background" data-demo={id}>
      <LifecycleGraphView graph={graph} initial={g.initial} />
    </div>
  );
}

function DialogDemo() {
  const tr = useTr();
  const [open, setOpen] = React.useState(false);
  const data = React.useMemo(() => sayrData(spec.branching), []);
  const path = React.useMemo(() => spec.branching.path.map((id) => ({ id })), []);
  return (
    <div className="flex items-center gap-3" data-demo="graph-dialog">
      <Button type="button" variant="outline" onClick={() => setOpen(true)} data-open-lifecycle-dialog>
        {tr(l("View full lifecycle", "عرض دورة الحياة كاملة"))}
      </Button>
      <LifecycleGraphDialog open={open} onOpenChange={setOpen} title={tr(l("Deal lifecycle", "دورة حياة الصفقة"))}
        subtitle={tr(l("DEAL-0042 · currently Negotiation", "DEAL-0042 · الحالة الآن تفاوض"))}
        lifecycle={data} status={spec.branching.current} path={path} />
    </div>
  );
}

// ---- the simulated DocType ------------------------------------------------------------------------------------------

const FSPEC = spec.form;
const SM = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, select: 1, report: 1, export: 1, print: 1, email: 1, share: 1 };

function metaFor(lang: Lang): DocTypeMeta {
  const fields: FrappeDocField[] = [];
  for (const sec of FSPEC.sections) {
    fields.push({ fieldname: sec.fieldname, fieldtype: "Section Break", label: sec[lang] });
    sec.columns.forEach((col, i) => {
      if (i > 0) fields.push({ fieldname: `${sec.fieldname}_col${i}`, fieldtype: "Column Break" });
      for (const f of col) {
        const d = FSPEC.fields[f as keyof typeof FSPEC.fields] as { fieldtype: string; en: string; ar: string; reqd?: number; options?: string };
        fields.push({ fieldname: f, fieldtype: d.fieldtype, label: d[lang], ...(d.reqd ? { reqd: 1 as const } : {}), ...(d.options ? { options: d.options } : {}) });
      }
    });
  }
  return { name: FSPEC.doctype, autoname: "hash", title_field: "subject", track_changes: 1, permissions: [SM], fields } as DocTypeMeta;
}

const T = "2026-11-02 09:00:00.000000";
function useVisitSite(lang: Lang) {
  return React.useMemo(() => {
    const docs = Object.values(FSPEC.docs).map((name) => ({ doctype: FSPEC.doctype, name, ...FSPEC.values, owner: "Administrator", modified: T, creation: T, docstatus: 0 })) as FrappeDoc[];
    const transport = createFixtureTransport({ meta: { [FSPEC.doctype]: [metaFor(lang)] }, docs: { [FSPEC.doctype]: docs }, user: "Administrator" }, { roles: ["System Manager", "All"] });
    const client = createFrappeClient({ transport });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return { client, qc };
  }, [lang]);
}

function VisitForm({ scope }: { scope: "section" | "record" | "plain" }) {
  const { language } = useLocale();
  const lang: Lang = language === "ar" ? "ar" : "en";
  const site = useVisitSite(lang);
  return (
    <div data-demo={`form-${scope}`} data-edit-scope={scope}>
      <FrappeProvider key={lang} client={site.client} queryClient={site.qc} session={{ user: "Administrator", fullName: "Administrator", roles: ["System Manager", "All"] }}>
        <FrappeForm doctype={FSPEC.doctype} name={FSPEC.docs[scope]} sectionEdit={scope !== "plain"} editScope={scope === "plain" ? undefined : scope} guardUnload={false} />
      </FrappeProvider>
    </div>
  );
}

export function Consolidation010Page() {
  return (
    <div className="space-y-12">
      <Section title={l("LifecycleGraphView: a post's lifecycle", "LifecycleGraphView: دورة حياة منشور")} description={l(
        "Draft → In Review → Approved → Archived, with Request Changes back from In Review to Draft (routed beside). The post is In Review; Draft → In Review is its path.",
        "مسودة ← قيد المراجعة ← معتمد ← مؤرشف، مع «طلب تعديلات» عائداً من قيد المراجعة إلى المسودة (بجانب المخطط). المنشور قيد المراجعة؛ ومساره من المسودة إليها.")}>
        <GraphBox id="graph-sada" g={spec.sada} />
      </Section>
      <Section title={l("LifecycleGraphView: a branching lifecycle", "LifecycleGraphView: دورة حياة متفرّعة")} description={l(
        "Six states: two ways out of New into the same row, a move within a row, a move up into another column, one beside, and a self-loop (Counter-offer).",
        "ست حالات: طريقان من «جديد» إلى الصف نفسه، وانتقال داخل الصف، وانتقال إلى أعلى في عمود آخر، وآخر بجانب المخطط، وحلقة على الحالة نفسها (عرض مضاد).")}>
        <GraphBox id="graph-branching" g={spec.branching} />
      </Section>
      <Section title={l("LifecycleGraphDialog (./sayr)", "LifecycleGraphDialog (‎./sayr‎)")} description={l(
        "The same lifecycle as Sayr sends it, through the sayr adapter: View full lifecycle opens it in place.",
        "دورة الحياة نفسها كما يرسلها صاير، عبر محوّل sayr: «عرض دورة الحياة كاملة» يفتحها في مكانها.")}>
        <DialogDemo />
      </Section>
      <Section title={l("Record editing: editScope=\"section\"", "تعديل السجل: editScope=\"section\"")} description={l(
        "SIMULATED. FrappeForm sectionEdit: each section reads until its own Edit; opening is not a change.",
        "محاكاة. FrappeForm sectionEdit: كل قسم يُقرأ حتى زر «تعديل» الخاص به؛ الفتح ليس تغييراً.")}>
        <Example className="p-4"><VisitForm scope="section" /></Example>
      </Section>
      <Section title={l("Record editing: editScope=\"record\"", "تعديل السجل: editScope=\"record\"")} description={l(
        "SIMULATED. One Edit opens every section; Save and one Cancel.",
        "محاكاة. زر «تعديل» واحد يفتح كل الأقسام؛ ثم «حفظ» و«إلغاء» واحد.")}>
        <Example className="p-4"><VisitForm scope="record" /></Example>
      </Section>
      <Section title={l("Control: the same record without sectionEdit", "للمقارنة: السجل نفسه بلا sectionEdit")} description={l(
        "SIMULATED. Desk's always-editable form, for comparison with the two above.",
        "محاكاة. نموذج ديسك القابل للتعديل دائماً، للمقارنة مع النموذجين أعلاه.")}>
        <Example className="p-4"><VisitForm scope="plain" /></Example>
      </Section>
    </div>
  );
}
