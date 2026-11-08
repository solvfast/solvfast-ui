/**
 * P36b social — SIMULATED: the form sidebar's Share, Like and Comments parts (FrappeSidebarShare, FrappeSidebarLikes,
 * FrappeComments) on the in-browser simulator, for a user who may share and one who may not. Every request goes to the
 * simulator's memory; nothing here is a real Frappe site.
 */
import * as React from "react";
import { Badge } from "@ui";
import { FrappeComments, FrappeSidebarLikes, FrappeSidebarShare } from "@ui/frappe";
import { simScenario } from "../../../src/frappe/testing";
import { Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import { Picker, Readout, SimProvider, SimulatedPermissionStrip, StatusStrip, useSimSite } from "./frappe/shared";

type Who = "admin" | "manager" | "viewer";
const SCENARIOS = {
  admin: () => simScenario.administrator(),
  manager: () => simScenario.fullAccess("sara@example.com", ["System Manager"]),
  viewer: () => simScenario.readOnly("khaled@example.com", ["Sales User"]),
} as const;

export function P36bSocialPage() {
  const tr = useTr();
  const [who, setWho] = React.useState<Who>("manager");
  const site = useSimSite({ permissions: SCENARIOS[who]() }, [who]);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 800);
    return () => clearInterval(id);
  }, []);
  const social = ["frappe.share.", "frappe.desk.like.", "frappe.desk.form.utils.", "frappe.client.delete"];
  const calls = site.transport.store.calls.filter((c) => social.some((p) => c.method.startsWith(p))).slice(-6);
  void tick;
  return (
    <div className="space-y-12">
      <SimulatedPermissionStrip />
      <StatusStrip parts={[["FrappeSidebarShare (P36b)", "simulated"], ["FrappeSidebarLikes (P36b)", "simulated"], ["FrappeComments (P36b)", "simulated"]]} />
      <Section title={l("Share, Like and Comments of a document", "المشاركة والإعجاب والتعليقات على مستند")} description={l(
        "SIMULATED. Travel Request TR-0001. Share: '+' opens Desk's dialog (Everyone first, then the users; Can Read / Write / Submit / Share); every box is a server call and shows the server's answer; un-ticking Can Read removes the share. A user without the share right sees it read-only. Like: the heart changes only after the server answered; the count opens the list of who liked it. Comments: @mentions, edit (author), delete (System / Website Manager), publish (author or System Manager).",
        "محاكاة. طلب السفر TR-0001. المشاركة: '+' يفتح حوار ديسك (الجميع أولاً ثم المستخدمون؛ القراءة / الكتابة / الاعتماد / المشاركة)؛ كل مربع طلبٌ للخادم ويعرض ردّه؛ إلغاء 'القراءة' يزيل المشاركة. من لا يملك صلاحية المشاركة يراها للقراءة فقط. الإعجاب: يتغيّر القلب بعد ردّ الخادم فقط؛ والعدد يفتح قائمة المعجبين. التعليقات: الإشارات @، التعديل (الكاتب)، الحذف (مدير النظام / الموقع)، النشر (الكاتب أو مدير النظام).")}>
        <Picker legend={l("Signed in as", "مسجّل الدخول باسم")} value={who} onChange={setWho} options={[
          { value: "admin", label: l("Administrator", "المسؤول") },
          { value: "manager", label: l("sara — System Manager", "sara — مدير النظام") },
          { value: "viewer", label: l("khaled — Sales User (read only, no share)", "khaled — مستخدم مبيعات (قراءة فقط، بلا مشاركة)") },
        ]} />
        <SimProvider site={site}>
          <div className="mt-4 grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="space-y-4 rounded-xl border border-border p-3" aria-label={tr(l("Form sidebar", "الشريط الجانبي للنموذج"))}>
              <FrappeSidebarShare doctype="Travel Request" name="TR-0001" />
              <div className="flex items-center gap-2 border-t border-border pt-3">
                <FrappeSidebarLikes doctype="Travel Request" name="TR-0001" />
                <span aria-hidden className="text-muted-foreground">·</span>
                <FrappeComments doctype="Travel Request" name="TR-0001" variant="count" />
              </div>
            </aside>
            <div className="min-w-0">
              <FrappeComments doctype="Travel Request" name="TR-0001" />
            </div>
          </div>
        </SimProvider>
        <div className="mt-4 space-y-1">
          <Badge variant="warning">{tr(l("SIMULATED requests (latest 6)", "طلبات محاكاة (آخر 6)"))}</Badge>
          <Readout>{calls.length ? calls.map((c) => `${c.method} ${JSON.stringify(c.args)}`).join("\n") : "—"}</Readout>
        </div>
      </Section>
    </div>
  );
}
