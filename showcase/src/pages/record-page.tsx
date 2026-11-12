/**
 * Record page (CRM) — RecordPage + RecordHeaderCard variant="crm" + quick actions + RecordRail, with no app CSS: what
 * another app gets from the package (the CRM record page's look, `sf-record-page` surfaces). Data is illustrative.
 */
import * as React from "react";
import {
  Building2, Calendar, CalendarPlus, CheckSquare, ClipboardList, GitBranch, Handshake, Mail, Paperclip, Percent, PhoneCall, ShieldCheck, StickyNote, TrendingUp, User,
} from "lucide-react";
import {
  Button, LifecycleRail, RecordHeaderCard, RecordHeaderIcon, RecordPage, RecordQuickAction, RecordQuickActionMenu, RecordRail, RecordRailArticles,
  RecordRailAssignment, RecordRailFooter, RecordRailLinkedRecord, RecordRailSection, RecordRailTasks, StatusBadge, TabsContent, RecordTabs,
  RecordEditSession, RecordEditableCard, RecordSaveButton, RecordNotSavedPill, RecordInfoTile, RecordInfoRow, RecordScoreRing, RecordInteractions, Input, Label,
} from "@ui";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

export function RecordPageDemoPage() {
  const tr = useTr();
  const [tab, setTab] = React.useState("about");
  const [value, setValue] = React.useState(12500000);
  const [draft, setDraft] = React.useState(String(value));
  const L = (en: string, ar: string) => tr({ en, ar });
  return (
    <Section title={l("Record page (CRM)", "صفحة السجل (CRM)")}>
      <Example title={l("A deal, as the CRM shows it", "صفقة كما يعرضها CRM")}>
        <div data-demo="record-page">
          <RecordEditSession pageSave commit={(m) => { setValue(Number(m.value)); return true; }}>
          <RecordPage
            back={{ label: L("Back to Deals", "العودة للصفقات"), onClick: () => {} }}
            actions={<><RecordSaveButton /><Button size="sm">{L("Actions", "الإجراءات")}</Button></>}
            header={
              <RecordHeaderCard variant="crm" avatar={<RecordHeaderIcon icon={Handshake} />} title={L("Annual Corporate Travel Contract", "عقد السفر المؤسسي السنوي")}
                name="1" statusNode={<StatusBadge label={L("Negotiation", "تفاوض")} tone="info" />} titleExtra={<RecordNotSavedPill />}
                facts={[{ icon: Building2, text: "Al-Faisaliah Group", onClick: () => {} }, { icon: User, text: "Sara Al-Otaibi" }, { icon: Calendar, text: "2026-11-15" }]}
                value={`${value.toLocaleString()} USD`}
                actions={<>
                  <RecordQuickAction icon={PhoneCall} label={L("Log Call", "تسجيل مكالمة")} onClick={() => {}} />
                  <RecordQuickActionMenu variant="split" icon={CalendarPlus} label={L("Meeting", "اجتماع")} items={[
                    { label: L("Schedule meeting", "جدولة اجتماع"), icon: CalendarPlus, iconClassName: "text-brand-violet", onSelect: () => {} },
                    { label: L("Log meeting", "تسجيل اجتماع"), icon: ClipboardList, onSelect: () => {} },
                  ]} />
                  <RecordQuickAction icon={StickyNote} label={L("Note", "ملاحظة")} onClick={() => {}} />
                  <RecordQuickActionMenu variant="more" label={L("More", "المزيد")} items={[{ label: L("Attachment", "رفع ملف"), icon: Paperclip, onSelect: () => {} }]} />
                </>} />
            }
            aside={
              <RecordRail className="lg:col-span-1 lg:sticky lg:top-4 lg:self-start space-y-4"
                sections={[
                  { id: "workflow", label: L("Lifecycle", "دورة الحياة"), pinned: true, render: () => (
                    <RecordRailSection title={L("Lifecycle", "دورة الحياة")} icon={GitBranch} spec={{ kind: "process" }}>
                      <LifecycleRail path={[{ id: "q", label: L("Qualification", "تأهيل"), meta: "Sara · Apr 15" }, { id: "n", label: L("Negotiation", "تفاوض"), meta: "Sara · Apr 17" }]}
                        next={[{ id: "a", label: L("Awaiting Client", "بانتظار العميل") }]} onViewAll={() => {}} />
                    </RecordRailSection>
                  ) },
                  { id: "assignment", label: L("Assignment", "التعيين"), render: () => (
                    <RecordRailSection title={L("Assignment", "التعيين")} icon={ShieldCheck} spec={{ kind: "single" }}>
                      <RecordRailAssignment team={{ label: L("Team", "الفريق"), value: "Reservations" }}><p className="text-xs">Sara Al-Otaibi</p></RecordRailAssignment>
                    </RecordRailSection>
                  ) },
                  { id: "organization", label: L("Organization", "المؤسسة"), render: () => (
                    <RecordRailLinkedRecord title={L("Organization", "المؤسسة")} icon={Building2} emptyLabel="—" onChange={() => {}} onClear={() => {}}
                      record={{ name: "Al-Faisaliah Group", subline: "Corporate / Diversified", iconTint: "bg-brand-violet/10 text-brand-violet", onClick: () => {} }} />
                  ) },
                  { id: "tasks", label: L("Tasks", "المهام"), render: () => (
                    <RecordRailTasks title={L("Tasks", "المهام")} emptyLabel="—" openLabel={L("Open in My Work", "فتح في مهامي")}
                      tasks={[{ id: "t1", title: "Prep talking points", subline: "Assignee: Layla", status: "To Do", onOpen: () => {} }]} />
                  ) },
                ]}
                footer={<RecordRailFooter lines={[{ label: L("Created by", "أنشئ بواسطة"), who: "Sara Al-Otaibi", when: "212d" }]} />}
                after={<RecordRailArticles articles={[{ id: "a1", title: "When will my refund reach my card", meta: "FAQ · from Senaiy-Pedia" }]} onOpen={() => {}} />} />
            }>
            <RecordTabs value={tab} onValueChange={setTab} tabs={[{ value: "about", label: L("About", "النبذة"), icon: Handshake }, { value: "history", label: L("History", "السجل"), icon: CheckSquare }]}>
              <TabsContent value="about" className="mt-4 space-y-4">
                <RecordEditableCard cardId="profile" label={L("Deal Profile", "ملف الصفقة")}
                  icon={<span className="h-7 w-7 rounded-md bg-brand-violet/10 flex items-center justify-center"><Handshake className="h-4 w-4 text-brand-violet" /></span>}
                  onSave={() => {}} onCancel={() => setDraft(String(value))} getPatch={() => (Number(draft) > 0 ? { value: draft } : false)}
                  renderEdit={({ markDirty }) => (
                    <div className="space-y-1.5"><Label htmlFor="demo-value" className="text-xs">{L("Value (USD)", "القيمة (USD)")}</Label>
                      <Input id="demo-value" value={draft} onChange={(e) => { setDraft(e.target.value); markDirty(); }} /></div>
                  )}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <RecordInfoTile label={L("Assignee", "المُكلَّف")} icon={ShieldCheck}><p className="text-sm font-medium">Sara Al-Otaibi</p></RecordInfoTile>
                    <RecordInfoTile label={L("Probability", "الاحتمالية")} icon={Percent}><RecordScoreRing value={75} color="hsl(var(--primary))" size={64} /></RecordInfoTile>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <RecordInfoRow icon={TrendingUp} label={L("Expected Value", "القيمة المتوقعة")} value={`${value.toLocaleString()} USD`} dir="ltr" tone="bg-success/15 text-success" />
                    <RecordInfoRow icon={Calendar} label={L("Expected Close", "الإغلاق المتوقع")} value="2026-11-15" tone="bg-info/15 text-info" />
                  </div>
                </RecordEditableCard>
                <RecordInteractions inbound={[{ id: "i1", title: "Call from Abdullah", when: "Apr 24, 10:00 AM", channel: "Phone", preview: "Asked for the revised proposal", icon: PhoneCall, iconClassName: "bg-info/10 text-info" }]}
                  outbound={[{ id: "o1", title: "Proposal v2 sent", when: "Apr 24, 11:30 AM", channel: "Email", preview: "Revised rates attached", icon: Mail, iconClassName: "bg-primary/10 text-primary" }]} />
              </TabsContent>
              <TabsContent value="history" className="mt-4 space-y-4"><div className="rounded-xl border border-border bg-card p-5 text-sm">{L("History", "السجل")}</div></TabsContent>
            </RecordTabs>
          </RecordPage>
          </RecordEditSession>
        </div>
      </Example>
    </Section>
  );
}
