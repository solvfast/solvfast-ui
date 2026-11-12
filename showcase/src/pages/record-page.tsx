/**
 * Record page (CRM) — RecordPage + RecordHeaderCard variant="crm" + quick actions + RecordRail, with no app CSS: what
 * another app gets from the package (the CRM record page's look, `sf-record-page` surfaces). Data is illustrative.
 */
import * as React from "react";
import {
  Building2, Calendar, CalendarPlus, CheckSquare, ClipboardList, GitBranch, Handshake, Paperclip, PhoneCall, ShieldCheck, StickyNote, User,
} from "lucide-react";
import {
  Button, LifecycleRail, RecordHeaderCard, RecordHeaderIcon, RecordPage, RecordQuickAction, RecordQuickActionMenu, RecordRail, RecordRailArticles,
  RecordRailAssignment, RecordRailFooter, RecordRailLinkedRecord, RecordRailSection, RecordRailTasks, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger,
} from "@ui";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

export function RecordPageDemoPage() {
  const tr = useTr();
  const [tab, setTab] = React.useState("about");
  const L = (en: string, ar: string) => tr({ en, ar });
  return (
    <Section title={l("Record page (CRM)", "صفحة السجل (CRM)")}>
      <Example title={l("A deal, as the CRM shows it", "صفقة كما يعرضها CRM")}>
        <div data-demo="record-page">
          <RecordPage
            back={{ label: L("Back to Deals", "العودة للصفقات"), onClick: () => {} }}
            actions={<Button size="sm">{L("Actions", "الإجراءات")}</Button>}
            header={
              <RecordHeaderCard variant="crm" avatar={<RecordHeaderIcon icon={Handshake} />} title={L("Annual Corporate Travel Contract", "عقد السفر المؤسسي السنوي")}
                name="1" statusNode={<StatusBadge label={L("Negotiation", "تفاوض")} tone="info" />}
                facts={[{ icon: Building2, text: "Al-Faisaliah Group", onClick: () => {} }, { icon: User, text: "Sara Al-Otaibi" }, { icon: Calendar, text: "2026-11-15" }]}
                value="12,500,000 USD"
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
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex w-full">
                {[["about", L("About", "النبذة"), Handshake], ["history", L("History", "السجل"), CheckSquare]].map(([k, label, Icon]) => {
                  const I = Icon as typeof Handshake;
                  return <TabsTrigger key={k as string} value={k as string} className="min-w-0 flex-1 gap-1.5"><I className="h-3.5 w-3.5" />{label as string}</TabsTrigger>;
                })}
              </TabsList>
              <TabsContent value="about" className="mt-4 space-y-4"><div className="rounded-xl border border-border bg-card p-5 text-sm">{L("About content", "محتوى النبذة")}</div></TabsContent>
              <TabsContent value="history" className="mt-4 space-y-4"><div className="rounded-xl border border-border bg-card p-5 text-sm">{L("History", "السجل")}</div></TabsContent>
            </Tabs>
          </RecordPage>
        </div>
      </Example>
    </Section>
  );
}
