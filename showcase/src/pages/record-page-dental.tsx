/**
 * Record page — a dental clinic's patient (P0 T8): the record page parts composed for a domain that has nothing to do with
 * the reference app, from the package only. A patient lifecycle (header Actions menu + read-only rail, the Core helpers),
 * five tabs (scrolling on a phone), an edit session, an app card (`RecordSectionCard`), an app rail section and an
 * embedded `ListView`. Surface: glass (the default) or `?surface=plain`. All data is illustrative.
 */
import * as React from "react";
import {
  AlertTriangle, CalendarClock, CalendarPlus, ClipboardList, CreditCard, FileHeart, GitBranch, HeartPulse, MessageSquare, Phone, ShieldPlus, Smile, Stethoscope, User, Zap,
} from "lucide-react";
import {
  Input, LifecycleActions, LifecycleRail, ListView, RecordEditSession, RecordEditableCard, RecordField, RecordFieldGrid, RecordHeaderCard, RecordHeaderIcon,
  RecordInfoRow, RecordInfoTile, RecordNotSavedPill, RecordPage, RecordQuickAction, RecordQuickActionMenu, RecordRail, RecordRailFooter, RecordRailSection,
  RecordSaveButton, RecordSectionCard, RecordTabs, StatusBadge, TabsContent, lifecycleNext, lifecyclePath, lifecycleTone, lifecycleTransitionsFrom,
  useRecordEditSession, type ColumnDef, type LifecycleDefinition,
} from "@ui";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

type Tr = (en: string, ar: string) => string;

/** The clinic's patient journey (app data: the package only gets it as a LifecycleDefinition). */
const journey = (L: Tr): LifecycleDefinition => ({
  states: [
    { id: "registered", label: L("Registered", "مسجّل"), phase: "open" },
    { id: "assessment", label: L("Assessment", "الفحص"), phase: "open" },
    { id: "plan", label: L("Treatment plan", "خطة العلاج"), phase: "open" },
    { id: "treatment", label: L("In treatment", "قيد العلاج"), phase: "open" },
    { id: "paused", label: L("Paused", "متوقف مؤقتاً"), phase: "on_hold", color: "#eab308" },
    { id: "completed", label: L("Completed", "مكتمل"), phase: "closed", color: "#16a34a" },
    { id: "discontinued", label: L("Discontinued", "منقطع"), phase: "closed", color: "#dc2626" },
  ],
  transitions: [
    { id: "t1", from: "registered", to: "assessment", label: L("Start assessment", "بدء الفحص") },
    { id: "t2", from: "assessment", to: "plan", label: L("Propose plan", "اقتراح خطة") },
    { id: "t3", from: "plan", to: "treatment", label: L("Begin treatment", "بدء العلاج") },
    { id: "t4", from: "treatment", to: "paused", label: L("Pause", "إيقاف مؤقت") },
    { id: "t5", from: "paused", to: "treatment", label: L("Resume", "استئناف") },
    { id: "t6", from: "treatment", to: "completed", label: L("Complete", "إكمال") },
    { id: "t7", from: "paused", to: "discontinued", label: L("Discontinue", "إيقاف نهائي") },
    { id: "t8", from: "treatment", to: "discontinued", label: L("Recall overdue", "تجاوز موعد الاستدعاء"), trigger: "automatic" },
  ],
});

interface Appointment { id: string; date: string; procedure: string; dentist: string; chair: string; status: string }

export function RecordPageDentalPage() {
  const tr = useTr();
  const L: Tr = (en, ar) => tr({ en, ar });
  const [surface] = React.useState<"glass" | "plain">(() =>
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("surface") === "plain" ? "plain" : "glass"));
  return (
    <Section title={l("Record page — a dental patient", "صفحة السجل — مريض أسنان")}
      description={l("The same record page parts for another domain: a patient journey, five tabs, an app card, an app rail section and an embedded list. Package components only.",
        "أجزاء صفحة السجل نفسها لمجال آخر: رحلة المريض، خمسة تبويبات، بطاقة من التطبيق، قسم في الشريط من التطبيق وقائمة مضمّنة. مكوّنات الحزمة فقط.")}>
      <Example title={l("Patient P-1042", "المريض P-1042")}>
        <div data-demo="record-page-dental" data-demo-surface={surface}>
          <PatientPage L={L} surface={surface} />
        </div>
      </Example>
    </Section>
  );
}

function PatientPage({ L, surface }: { L: Tr; surface: "glass" | "plain" }) {
  const [phone, setPhone] = React.useState("+966 55 010 4421");
  const [dentist, setDentist] = React.useState("Dr. Hana Saleh");
  return (
    <RecordEditSession pageSave commit={(m) => { if (typeof m.phone === "string") setPhone(m.phone); if (typeof m.dentist === "string") setDentist(m.dentist); return true; }}>
      <PatientBody L={L} surface={surface} phone={phone} dentist={dentist} />
    </RecordEditSession>
  );
}

function PatientBody({ L, surface, phone, dentist }: { L: Tr; surface: "glass" | "plain"; phone: string; dentist: string }) {
  const session = useRecordEditSession();
  const def = React.useMemo(() => journey(L), [L]);
  const [state, setState] = React.useState("treatment");
  const [log, setLog] = React.useState<Record<string, string>>({ registered: "Reception · Mar 2", assessment: "Dr. Hana · Mar 9", plan: "Dr. Hana · Mar 16", treatment: "Dr. Hana · Apr 1" });
  const [tab, setTab] = React.useState("overview");
  const [draft, setDraft] = React.useState({ phone, dentist });
  const current = def.states.find((s) => s.id === state);
  const path = lifecyclePath(def, state);
  const run = (id: string) => {
    const t = def.transitions.find((x) => x.id === id); if (!t) return;
    setLog((g) => ({ ...g, [t.to]: L("You · now", "أنت · الآن") })); setState(t.to);
  };
  const appointments: Appointment[] = [
    { id: "A-301", date: "2026-11-19", procedure: L("Root canal — tooth 36 (2/3)", "علاج عصب — السن 36 (2/3)"), dentist: "Dr. Hana Saleh", chair: "2", status: L("Booked", "محجوز") },
    { id: "A-288", date: "2026-11-05", procedure: L("Root canal — tooth 36 (1/3)", "علاج عصب — السن 36 (1/3)"), dentist: "Dr. Hana Saleh", chair: "2", status: L("Done", "تم") },
    { id: "A-270", date: "2026-10-21", procedure: L("Scaling and polishing", "تنظيف وتلميع"), dentist: "Faisal (hygienist)", chair: "4", status: L("Done", "تم") },
    { id: "A-251", date: "2026-10-02", procedure: L("Panoramic X-ray", "أشعة بانورامية"), dentist: "Dr. Hana Saleh", chair: "X-ray", status: L("Done", "تم") },
  ];
  const columns: ColumnDef<Appointment>[] = [
    { key: "date", label: { en: "Date", ar: "التاريخ" }, type: "date" },
    { key: "procedure", label: { en: "Procedure", ar: "الإجراء" }, type: "text" },
    { key: "dentist", label: { en: "Clinician", ar: "الطبيب" }, type: "text" },
    { key: "chair", label: { en: "Chair", ar: "الكرسي" }, type: "text" },
    { key: "status", label: { en: "Status", ar: "الحالة" }, type: "text" },
  ];
  const tile = (icon: React.ComponentType<{ className?: string }>) => {
    const I = icon;
    return <span className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center"><I className="h-4 w-4 text-primary" /></span>;
  };
  return (
    <RecordPage
      surface={surface}
      back={{ label: L("Back to Patients", "العودة للمرضى"), onClick: () => {} }}
      actions={<>
        <RecordSaveButton />
        <LifecycleActions actions={lifecycleTransitionsFrom(def, state).map((t) => ({ id: t.id, label: t.label ?? t.id }))} onAction={run}
          blockedReason={session?.dirty ? L("Save your changes first", "احفظ تغييراتك أولاً") : undefined} blockedIcon={Zap}
          labels={{ actions: L("Actions", "الإجراءات"), none: L("No actions from this stage", "لا توجد إجراءات من هذه المرحلة") }} />
      </>}
      header={
        <RecordHeaderCard variant="page" avatar={<RecordHeaderIcon icon={Smile} />} title={L("Mariam Al-Ghamdi", "مريم الغامدي")} name="P-1042"
          statusNode={<StatusBadge label={current?.label ?? state} tone={lifecycleTone(current)} />} titleExtra={<RecordNotSavedPill />}
          facts={[{ icon: User, text: L("34 years", "34 سنة") }, { icon: Stethoscope, text: dentist, onClick: () => {} }, { icon: Phone, text: <span dir="ltr">{phone}</span> }]}
          value={L("Balance: 1,250 SAR", "الرصيد: 1,250 ريال")}
          actions={<>
            <RecordQuickAction icon={CalendarPlus} label={L("Book visit", "حجز زيارة")} onClick={() => {}} />
            <RecordQuickAction icon={MessageSquare} label={L("Message", "رسالة")} onClick={() => {}} />
            <RecordQuickActionMenu variant="more" label={L("More", "المزيد")} items={[
              { label: L("Print treatment plan", "طباعة خطة العلاج"), icon: ClipboardList, onSelect: () => {} },
              { label: L("Record payment", "تسجيل دفعة"), icon: CreditCard, onSelect: () => {} },
            ]} />
          </>} />
      }
      aside={
        <RecordRail className="lg:col-span-1 lg:sticky lg:top-4 lg:self-start space-y-4"
          sections={[
            { id: "journey", label: L("Patient journey", "رحلة المريض"), pinned: true, render: () => (
              <RecordRailSection title={L("Patient journey", "رحلة المريض")} icon={GitBranch} spec={{ kind: "process" }}>
                <LifecycleRail path={path.map((s) => ({ id: s.id, label: s.label, meta: log[s.id] }))}
                  next={lifecycleNext(def, state, path.map((s) => s.id))} ended={lifecycleNext(def, state).length === 0}
                  labels={{ back: L("back", "رجوع"), end: L("Journey complete", "اكتملت الرحلة"), current: L("Current", "الحالية"), next: L("Next", "التالي") }} />
              </RecordRailSection>
            ) },
            { id: "insurance", label: L("Insurance", "التأمين"), render: () => (
              <RecordRailSection title={L("Insurance", "التأمين")} icon={ShieldPlus} spec={{ kind: "single" }}>
                <div className="space-y-1 text-xs" data-app-rail-section="insurance">
                  <p className="font-medium text-foreground">Tawuniya — Gold</p>
                  <p className="text-muted-foreground">{L("Covers 80% · valid until 2027-03-31", "يغطي 80% · صالح حتى 2027-03-31")}</p>
                </div>
              </RecordRailSection>
            ) },
          ]}
          footer={<RecordRailFooter lines={[{ label: L("Registered by", "سجّله"), who: "Reception", when: "255d" }]} />} />
      }>
      <RecordTabs value={tab} onValueChange={(v) => setTab(v)} overflow="scroll" ariaLabel={L("Patient sections", "أقسام المريض")} tabs={[
        { value: "overview", label: L("Overview", "نظرة عامة"), icon: Smile },
        { value: "history", label: L("Medical History", "التاريخ الطبي"), icon: FileHeart },
        { value: "appointments", label: L("Appointments", "المواعيد"), icon: CalendarClock },
        { value: "treatments", label: L("Treatments", "العلاجات"), icon: Stethoscope },
        { value: "payments", label: L("Payments", "المدفوعات"), icon: CreditCard },
      ]}>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <RecordEditableCard cardId="details" label={L("Patient details", "بيانات المريض")} icon={tile(User)}
            onSave={() => {}} onCancel={() => setDraft({ phone, dentist })}
            getPatch={() => (draft.phone.trim() ? { phone: draft.phone, dentist: draft.dentist } : false)}
            renderEdit={({ markDirty }) => (
              <RecordFieldGrid>
                <RecordField label={L("Mobile", "الجوال")} htmlFor="dental-phone" required>
                  <Input id="dental-phone" dir="ltr" value={draft.phone} onChange={(e) => { setDraft((d) => ({ ...d, phone: e.target.value })); markDirty(); }} />
                </RecordField>
                <RecordField label={L("Treating dentist", "الطبيب المعالج")} htmlFor="dental-dentist">
                  <Input id="dental-dentist" value={draft.dentist} onChange={(e) => { setDraft((d) => ({ ...d, dentist: e.target.value })); markDirty(); }} />
                </RecordField>
              </RecordFieldGrid>
            )}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <RecordInfoTile label={L("Treating dentist", "الطبيب المعالج")} icon={Stethoscope}><p className="text-sm font-medium">{dentist}</p></RecordInfoTile>
              <RecordInfoTile label={L("Next visit", "الزيارة القادمة")} icon={CalendarClock}><p className="text-sm font-medium">2026-11-19 · 10:30</p></RecordInfoTile>
            </div>
            <RecordInfoRow icon={Phone} label={L("Mobile", "الجوال")} value={phone} dir="ltr" />
          </RecordEditableCard>
          <RecordSectionCard cardId="alerts" label={L("Allergies & alerts", "الحساسية والتنبيهات")} icon={tile(AlertTriangle)} bodyClassName="space-y-2">
            <p className="text-sm text-foreground" data-app-card="alerts">{L("Penicillin allergy — use clindamycin.", "حساسية من البنسلين — استخدم الكليندامايسين.")}</p>
            <p className="text-xs text-muted-foreground">{L("Anxious patient: prefers morning appointments.", "مريضة قلقة: تفضّل المواعيد الصباحية.")}</p>
          </RecordSectionCard>
        </TabsContent>
        <TabsContent value="history" className="mt-4 space-y-4">
          <RecordSectionCard label={L("Medical history", "التاريخ الطبي")} icon={tile(HeartPulse)} bodyClassName="space-y-1 text-sm">
            <p>{L("Type 2 diabetes — controlled (HbA1c 6.4%).", "سكري من النوع الثاني — منضبط (HbA1c 6.4%).")}</p>
            <p>{L("No anticoagulants.", "لا تتناول مميّعات الدم.")}</p>
          </RecordSectionCard>
        </TabsContent>
        <TabsContent value="appointments" className="mt-4">
          <div data-app-list="appointments">
            <ListView<Appointment> rows={appointments} columns={columns} rowKey={(r) => r.id} pageSize={10} />
          </div>
        </TabsContent>
        <TabsContent value="treatments" className="mt-4">
          <RecordSectionCard label={L("Treatment plan", "خطة العلاج")} icon={tile(Stethoscope)} bodyClassName="space-y-1 text-sm">
            <p>{L("Root canal, tooth 36 — 3 visits (2 left).", "علاج عصب، السن 36 — 3 زيارات (بقيت 2).")}</p>
            <p>{L("Crown, tooth 36 — after the root canal.", "تاج، السن 36 — بعد علاج العصب.")}</p>
          </RecordSectionCard>
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <RecordSectionCard label={L("Payments", "المدفوعات")} icon={tile(CreditCard)}>
            <RecordInfoRow icon={CreditCard} label={L("Balance", "الرصيد")} value="1,250 SAR" dir="ltr" />
          </RecordSectionCard>
        </TabsContent>
      </RecordTabs>
    </RecordPage>
  );
}
