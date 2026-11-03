/**
 * The seven SIMULATED permission scenarios (playground/src/demo/sim-site.ts `PERMISSION_SCENARIOS`): one picker drives
 * BOTH the client session (`FrappeProvider session` = `transport.store.session`) and the simulator's server-side
 * evaluation (`createFixtureTransport(…, { permissions })`). Everything here — data and permission decisions — is the
 * in-browser simulator's approximation of a Frappe server; every scenario carries `SimulatedPermissionStrip`.
 */
import * as React from "react";
import { Badge, Button, Skeleton, cn } from "@ui";
import { FrappeError, FrappeForm, FrappeListView, useDoc, useMetaBundle, usePermissions, type FrappeDoc, type PermType } from "@ui/frappe";
import { PERMISSION_SCENARIOS, probeServer, type FileCall, type PermissionScenario, type ProbeLine, type SimSite } from "../../../../playground/src/demo/sim-site";
import type { SimScenarioName } from "../../../../src/frappe/testing";
import { l, useTr, type L } from "../../i18n";
import { Picker, Readout, SimProvider, SimulatedPermissionStrip, useSimSite } from "./shared";

const WRAP = "max-w-full [overflow-wrap:anywhere]";

export const SCENARIO_ORDER: SimScenarioName[] = ["administrator", "full-access", "read-only", "restricted-doctype", "restricted-fields", "user-permissions", "unknown-roles"];
export const SCENARIO_LEGEND = l("Permission scenario", "سيناريو الأذونات");

export const SCENARIO_TEXT: Record<SimScenarioName, { label: L; blurb: L }> = {
  administrator: {
    label: l("Administrator", "المدير (Administrator)"),
    blurb: l("The Administrator user: the server passes every check (permissions.py:107-109) and strips nothing.", "المستخدم Administrator: يجتاز كل فحص على الخادم (permissions.py:107-109) ولا يُحذف أي حقل."),
  },
  "full-access": {
    label: l("Full-access role", "دور بصلاحيات كاملة"),
    blurb: l("Sara with System Manager: every right on Travel Request including permlevel 1 — evaluated from the DocPerm rows, not bypassed.", "سارة بدور System Manager: كل الحقوق على طلب السفر بما فيها permlevel 1 — تُحسب من صفوف DocPerm ولا تُتجاوز."),
  },
  "read-only": {
    label: l("Read-only role", "دور للقراءة فقط"),
    blurb: l("Lina with Sales User (read / report / print / email): the form is read-only, Save is gone, Internal notes (permlevel 1) is stripped by the server; a forced save answers 403.", "لينا بدور Sales User (قراءة / تقرير / طباعة / بريد): النموذج للقراءة فقط ولا زر حفظ، والخادم يحذف «ملاحظات داخلية» (permlevel 1)؛ الحفظ القسري يُجاب بـ 403."),
  },
  "restricted-doctype": {
    label: l("Restricted DocType", "نوع مستند مقيّد"),
    blurb: l("Khaled with Purchase User — a role Travel Request has no row for: the meta still loads (getdoctype has no check), getdoc and the list answer 403.", "خالد بدور Purchase User — دور ليس له صف في طلب السفر: تُحمَّل البيانات الوصفية (getdoctype بلا فحص)، و getdoc والقائمة يُجابان بـ 403."),
  },
  "restricted-fields": {
    label: l("Restricted fields (permlevel 1)", "حقول مقيّدة (permlevel 1)"),
    blurb: l("Omar with Data Entry: read / write / create at level 0, nothing at level 1 — Internal notes is stripped on read and the server keeps its stored value on save (validate_higher_perm_levels).", "عمر بدور Data Entry: قراءة / كتابة / إنشاء في المستوى 0 ولا شيء في المستوى 1 — تُحذف «ملاحظات داخلية» عند القراءة ويحتفظ الخادم بقيمتها المخزّنة عند الحفظ."),
  },
  "user-permissions": {
    label: l("User Permissions", "أذونات المستخدم"),
    blurb: l("Omar (Data Entry) with a User Permission User = omar@example.com for Travel Request: the list keeps his trip (TR-0003) plus TR-0002, shared with him read-only (docinfo.shared); TR-0001 answers 403. Desk parity: TR-0002 looks editable (docinfo.permissions is {} after the User Permission denial, so the role rights stay) and the server refuses the save.", "عمر (Data Entry) مع إذن مستخدم User = omar@example.com لطلب السفر: تبقى رحلته (TR-0003) و TR-0002 المشارَكة معه للقراءة (docinfo.shared)؛ و TR-0001 يُجاب بـ 403. تطابق ديسك: يبدو TR-0002 قابلاً للتعديل (docinfo.permissions فارغة بعد رفض إذن المستخدم فتبقى حقوق الدور) والخادم يرفض الحفظ."),
  },
  "unknown-roles": {
    label: l("Unknown roles", "أدوار مجهولة"),
    blurb: l("Noor, a new user: the client is given no roles (rule 9: \"permissions unknown\", nothing granted); the server always knows them — get_roles adds All, Guest and Desk User, none of which has a Travel Request row, so it answers 403.", "نور، مستخدمة جديدة: لا يُعطى العميل أي دور (القاعدة 9: «الأذونات غير معروفة»، لا يُمنح شيء)؛ الخادم يعرفها دائماً — get_roles يضيف All و Guest و Desk User ولا صف لأي منها في طلب السفر، فيُجيب بـ 403."),
  },
};

export function ScenarioPicker({ value, onChange }: { value: SimScenarioName; onChange: (v: SimScenarioName) => void }) {
  return <Picker legend={SCENARIO_LEGEND} value={value} onChange={onChange} options={SCENARIO_ORDER.map((k) => ({ value: k, label: SCENARIO_TEXT[k].label }))} />;
}

/** One simulated site per scenario (clean data, its own query cache). */
export function useScenarioSite(key: SimScenarioName, extra: Partial<Parameters<typeof useSimSite>[0]> = {}): { site: SimSite; sc: PermissionScenario } {
  const sc = PERMISSION_SCENARIOS[key];
  const site = useSimSite({ ...extra, permissions: sc.permissions }, [key]);
  return { site, sc };
}

/** Who the scenario is, on both sides. */
export function ScenarioFacts({ site, sc }: { site: SimSite; sc: PermissionScenario }) {
  const tr = useTr();
  const session = site.transport.store.session;
  const serverRoles = site.transport.permissions?.rolesOf() ?? [];
  const p = sc.permissions;
  return (
    <div className="space-y-2">
      <SimulatedPermissionStrip />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className={WRAP} variant="info" dir="ltr">{p.user}</Badge>
        <Badge className={WRAP} variant="outline" dir="ltr" title="get_roles (permissions.py:497-528)">
          {tr(l("server roles", "أدوار الخادم"))}: {p.user === "Administrator" ? tr(l("every role", "كل الأدوار")) : serverRoles.join(", ")}
        </Badge>
        <Badge className={WRAP} variant={session?.roles ? "outline" : "warning"} dir="ltr">
          {tr(l("client session.roles", "session.roles في العميل"))}: {session?.roles ? (p.user === "Administrator" ? tr(l("every role", "كل الأدوار")) : session.roles.join(", ")) : tr(l("not given (unknown)", "غير مُعطاة (غير معروفة)"))}
        </Badge>
        {(p.userPermissions ?? []).map((u) => <Badge className={WRAP} key={`${u.allow}-${u.for_value}`} variant="outline" dir="ltr">User Permission: {u.allow} = {u.for_value}{u.applicable_for ? ` (for ${u.applicable_for})` : ""}</Badge>)}
        {(p.shares ?? []).map((s) => <Badge className={WRAP} key={`${s.share_doctype}-${s.share_name}`} variant="outline" dir="ltr">DocShare: {s.share_name} → {s.user ?? "everyone"} ({s.write ? "read + write" : "read"})</Badge>)}
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{tr(SCENARIO_TEXT[sc.key].blurb)}</p>
    </div>
  );
}

/** The simulated server's answers to a fixed set of calls (on a throwaway copy of the scenario's site). */
export function ServerProbe({ sc }: { sc: PermissionScenario }) {
  const tr = useTr();
  const [lines, setLines] = React.useState<ProbeLine[] | null>(null);
  React.useEffect(() => {
    let live = true;
    setLines(null);
    void probeServer(sc).then((r) => { if (live) setLines(r); });
    return () => { live = false; };
  }, [sc]);
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{tr(l("What the simulated server answers (a throwaway copy of this site)", "ما يجيب به الخادم المحاكى (نسخة مؤقتة من هذا الموقع)"))}</h4>
      {!lines ? <Skeleton className="h-40 w-full" /> : (
        <div className="overflow-x-auto rounded-2xl border border-border" data-testid="server-probe">
          <table className="w-full min-w-[34rem] text-xs">
            <thead className="bg-muted/40 text-muted-foreground"><tr>
              <th className="px-3 py-2 text-start font-medium">{tr(l("Call", "الطلب"))}</th>
              <th className="px-3 py-2 text-start font-medium">{tr(l("Status", "الحالة"))}</th>
              <th className="px-3 py-2 text-start font-medium">{tr(l("Simulated answer", "الإجابة المحاكاة"))}</th>
            </tr></thead>
            <tbody>
              {lines.map((x) => (
                <tr key={x.call} className="border-t border-border align-top">
                  <td className="px-3 py-1.5 font-mono" dir="ltr">{x.call}</td>
                  <td className="px-3 py-1.5"><Badge variant={x.status === 200 ? "success" : "destructive"} dir="ltr">{x.status}</Badge></td>
                  <td className="px-3 py-1.5 break-words" dir="ltr">{x.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Post a save of the document as this session sees it — even when the client hides Save — and show the server's answer. */
export function ForcedSave({ site, sc }: { site: SimSite; sc: PermissionScenario }) {
  const tr = useTr();
  const [out, setOut] = React.useState("");
  const send = async () => {
    const { doctype, name } = sc.focus;
    let doc: FrappeDoc;
    try { doc = (await site.transport("frappe.desk.form.load.getdoc", { doctype, name })).docs![0] as FrappeDoc; } catch {
      doc = site.transport.store.docs.get(doctype)!.get(name)!; // unreadable: post the stored doc as a crafted request would
    }
    try {
      await site.transport("frappe.desk.form.save.savedocs", { doc: JSON.stringify(doc), action: "Save" });
      setOut(`savedocs ${name} → 200 Saved (simulated server)`);
    } catch (e) {
      const err = e instanceof FrappeError ? e : undefined;
      setOut(`savedocs ${name} → ${err?.status ?? "?"} ${err?.excType ?? ""}: ${(err?.message ?? String(e)).replace(/<[^>]+>/g, "")} (simulated server)`);
    }
  };
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" className="h-auto min-h-8 whitespace-normal text-start" onClick={() => void send()} data-testid="forced-save">{tr(l("Send a save request anyway (bypasses the client's gate)", "أرسل طلب حفظ رغم ذلك (يتجاوز بوابة العميل)"))}</Button>
      <Readout label="server →">{out || "—"}</Readout>
    </div>
  );
}

const RIGHTS: PermType[] = ["read", "write", "create", "delete", "submit", "share", "export"];

/** The client's rights on the focus document (`usePermissions(bundle, doc, docinfo)`) next to what the server said. */
function ClientRights({ sc }: { sc: PermissionScenario }) {
  const tr = useTr();
  const bundle = useMetaBundle(sc.focus.doctype);
  const q = useDoc(sc.focus.doctype, sc.focus.name);
  const perms = usePermissions(bundle.data, q.data?.doc, q.data?.docinfo);
  if (bundle.isLoading || (q.isLoading && !q.error)) return <Skeleton className="h-40 w-full" />;
  const yes = (v: boolean) => <Badge variant={v ? "success" : "outline"}>{v ? tr(l("yes", "نعم")) : tr(l("no", "لا"))}</Badge>;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{tr(l(`The client on ${sc.focus.name}: usePermissions(bundle, doc, docinfo)`, `العميل على ${sc.focus.name}: usePermissions(bundle, doc, docinfo)`))}</h4>
      {q.error ? (
        <p className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground" dir="ltr">getdoc → {(q.error as FrappeError).status} {(q.error as FrappeError).excType}: {(q.error as Error).message}</p>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <tbody>
            {RIGHTS.map((r) => <tr key={r} className="border-t border-border first:border-t-0"><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">can("{r}")</td><td className="px-3 py-1.5">{yes(perms.can(r))}</td></tr>)}
            <tr className="border-t border-border"><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">can("read", 1) — Internal notes</td><td className="px-3 py-1.5">{yes(perms.can("read", 1))}</td></tr>
            <tr className="border-t border-border"><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">known</td><td className="px-3 py-1.5">{yes(perms.known)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The forms page: the scenario's saved document as FrappeForm, plus a forced save. */
export function ScenarioFormDemo() {
  const tr = useTr();
  const [key, setKey] = React.useState<SimScenarioName>("read-only");
  const { site, sc } = useScenarioSite(key);
  const [saved, setSaved] = React.useState("");
  return (
    <div className="space-y-3" data-testid="scenario-form-demo">
      <ScenarioPicker value={key} onChange={(v) => { setKey(v); setSaved(""); }} />
      <ScenarioFacts site={site} sc={sc} />
      <SimProvider site={site} key={key}>
        <div className="rounded-2xl border border-border p-4 md:p-6">
          <FrappeForm doctype={sc.focus.doctype} name={sc.focus.name} guardUnload={false} onSaved={(d, a) => setSaved(`onSaved: ${d.name} (${a})`)} />
        </div>
      </SimProvider>
      <Readout label="callbacks →">{saved || "—"}</Readout>
      <ForcedSave site={site} sc={sc} key={`fs-${key}`} />
      <p className="text-xs text-muted-foreground">{tr(l("The forced save posts what this session can read (getdoc), or — when it cannot read the document — the stored document, as a crafted request would. The answer is the simulated server's decision.", "الحفظ القسري يرسل ما تستطيع هذه الجلسة قراءته (getdoc)، أو — إن لم تستطع — المستند المخزّن كما يفعل طلب مصنوع. الإجابة قرار الخادم المحاكى."))}</p>
    </div>
  );
}

/** What the simulated server pushed over "realtime" (msgprints of bulk actions) — kept in `store.published`. */
const plainText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** The permissions page: client rights | server answers, the filtered list (with Desk's Actions), the focus document. */
export function ScenarioPermissionsDemo() {
  const tr = useTr();
  const [key, setKey] = React.useState<SimScenarioName>("read-only");
  const [actions, setActions] = React.useState<string[]>([]);
  const note = React.useCallback((line: string) => setActions((a) => [line, ...a].slice(0, 6)), []);
  const onFileCall = React.useCallback((c: FileCall) => note(`${c.kind} ${c.method} → ${c.outcome}`), [note]);
  const { site, sc } = useScenarioSite(key, { fileMode: "respond", onFileCall });
  const published = () => site.transport.store.published.slice(-3).map((m) => `published (${m.event}${m.title ? ` · ${m.title}` : ""}): ${plainText(m.message).slice(0, 220)}`);
  return (
    <div className="space-y-4" data-testid="scenario-permissions-demo">
      <ScenarioPicker value={key} onChange={(v) => { setKey(v); setActions([]); }} />
      <ScenarioFacts site={site} sc={sc} />
      <SimProvider site={site} key={key}>
        <div className="grid gap-6 lg:grid-cols-2">
          <ClientRights sc={sc} />
          <ServerProbe sc={sc} />
        </div>
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{tr(l("Travel Request list — the rows this session may read", "قائمة طلبات السفر — الصفوف التي تستطيع هذه الجلسة قراءتها"))}</h4>
          <div className={cn("rounded-2xl border border-border px-4 py-4 md:px-6")} data-testid="scenario-list">
            <FrappeListView doctype="Travel Request" storage={null} rowMeta={false}
              bulk={{ onDone: (kind, outcome, names, action) => { note(`bulk ${action ?? kind}: ${names.length} requested${outcome.queued ? " (queued)" : ""}${outcome.failed.length ? `, failed: ${outcome.failed.join(", ")}` : ""}${outcome.silent ? " — the answer reports nothing per document" : ""}`); setActions((a) => [...published(), ...a].slice(0, 8)); },
                onError: (e, kind) => note(`bulk ${kind} refused: ${e instanceof FrappeError ? `${e.status} ${e.excType ?? ""} ${e.message}` : String(e)}`) }} />
          </div>
          <p className="text-xs text-muted-foreground">{tr(l("Select rows: the selection bar offers Desk's Actions for this session's rights (Export always); each action goes to the simulated server, which applies its own checks — Print and Export answer text files labelled SIMULATED, never data.", "حدّد صفوفاً: يعرض شريط التحديد إجراءات ديسك بحسب حقوق هذه الجلسة (التصدير دائماً)؛ كل إجراء يذهب إلى الخادم المحاكى الذي يطبّق فحوصه — الطباعة والتصدير يجيبان بملفات نصية موسومة SIMULATED، دون بيانات أبداً."))}</p>
          <Readout label="actions →">{actions.length ? actions.join("\n") : "—"}</Readout>
        </div>
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{tr(l(`${sc.focus.name} as this session`, `${sc.focus.name} بهذه الجلسة`))}</h4>
          <div className="rounded-2xl border border-border p-4 md:p-6" data-testid="scenario-form">
            <FrappeForm doctype={sc.focus.doctype} name={sc.focus.name} guardUnload={false} />
          </div>
        </div>
        {key === "unknown-roles" && (
          <div className="mt-6 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">{tr(l("A new Travel Request as this session — the client's rule-9 state", "طلب سفر جديد بهذه الجلسة — حالة القاعدة 9 في العميل"))}</h4>
            <p className="text-xs text-muted-foreground">{tr(l("Without session.roles the client grants nothing and says so (\"Read only\", data-permissions=\"unknown\") instead of guessing; the simulated server would refuse the save anyway (no role of Noor's has a Travel Request row).", "دون session.roles لا يمنح العميل شيئاً ويقول ذلك («للقراءة فقط»، data-permissions=\"unknown\") بدل التخمين؛ والخادم المحاكى سيرفض الحفظ على أي حال (لا صف لأي من أدوار نور في طلب السفر)."))}</p>
            <div className="rounded-2xl border border-border p-4 md:p-6" data-testid="scenario-new-form">
              <FrappeForm doctype="Travel Request" guardUnload={false} />
            </div>
          </div>
        )}
      </SimProvider>
    </div>
  );
}
