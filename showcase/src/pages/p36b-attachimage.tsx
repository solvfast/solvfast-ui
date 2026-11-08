/**
 * P36b attachimage — Desk's Attach Image / Attach controls (Frappe 15.110 form/controls/attach.js, attach_image.js,
 * file_uploader/FileUploader.vue) and the form image's "Change" menu (form/sidebar/user_image.js) on the SIMULATED site.
 * Every server answer is the in-browser simulator's (createFixtureTransport + withSimulatedSidebar; get_max_file_size from
 * src/frappe/testing/handlers/form.ts); only the File row of an upload is kept (no bytes). Nothing here ran on a real site.
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { AttachInput } from "@ui";
import { FrappeForm, FrappeProvider, createFrappeClient, type DocTypeMeta, type FrappeDoc } from "@ui/frappe";
import { userDocs, T } from "../../../playground/src/demo/sim-site";
import { createFixtureTransport } from "../../../src/frappe/testing";
import { withSimulatedSidebar } from "../../../src/frappe/testing/handlers/sidebar";
import { Example, Section } from "../doc/Doc";
import { l } from "../i18n";
import { Picker, Readout, SessionBadge, SimulatedPermissionStrip, StatusStrip, sessionPermissions, SESSIONS, type SessionKey } from "./frappe/shared";

const SM = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1 } as const;
const SITE_VISIT: DocTypeMeta = {
  name: "Site Visit", autoname: "hash", title_field: "subject", image_field: "photo",
  permissions: [SM, { role: "Data Entry", permlevel: 0, read: 1, write: 1, create: 1 }, { role: "Sales User", permlevel: 0, read: 1 }],
  fields: [
    { fieldname: "subject", fieldtype: "Data", label: "Subject", reqd: 1 },
    { fieldname: "photo", fieldtype: "Attach Image", label: "Photo" },
    { fieldname: "column_break_1", fieldtype: "Column Break" },
    { fieldname: "report", fieldtype: "Attach", label: "Report" },
  ],
};
const METHODS = ["upload_file", "frappe.desk.form.utils.remove_attach", "frappe.core.api.file.get_max_file_size", "frappe.core.api.file.get_files_by_search_text", "frappe.desk.form.save.savedocs"];

function useSite(session: SessionKey) {
  return React.useMemo(() => {
    const base = createFixtureTransport({
      meta: { "Site Visit": [SITE_VISIT] },
      docs: {
        User: userDocs,
        "Site Visit": [{ doctype: "Site Visit", name: "SV-0001", subject: "Riyadh depot inspection", photo: "/files/depot-front.png", owner: "Administrator", creation: T, modified: T, docstatus: 0 } as FrappeDoc],
        File: [
          { doctype: "File", name: "FILE-PHOTO", file_name: "depot-front.png", file_url: "/files/depot-front.png", is_private: 0, attached_to_doctype: "Site Visit", attached_to_name: "SV-0001", attached_to_field: "photo", owner: "Administrator", modified: T, creation: T },
          { doctype: "File", name: "FILE-LIB", file_name: "company-logo.png", file_url: "/files/company-logo.png", is_private: 0, owner: "Administrator", modified: T, creation: T },
        ] as FrappeDoc[],
        "System Settings": [{ doctype: "System Settings", name: "System Settings", max_file_size: 5, modified: T, creation: T } as FrappeDoc],
      },
    }, { permissions: sessionPermissions(session) });
    const transport = withSimulatedSidebar(base);
    return { transport, client: createFrappeClient({ transport, files: transport.files }), qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
  }, [session]);
}

function RequestLog({ transport }: { transport: ReturnType<typeof useSite>["transport"] }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 600); return () => clearInterval(id); }, []);
  const rows = transport.store.calls.filter((c) => METHODS.includes(c.method)).slice(-8).reverse();
  return <Readout label="SIMULATED requests (newest first):">{rows.length ? rows.map((c) => `${c.method} ${JSON.stringify(c.args).slice(0, 300)}`).join("\n") : "—"}</Readout>;
}

export function P36bAttachImagePage() {
  const [session, setSession] = React.useState<SessionKey>("admin");
  const site = useSite(session);
  const s = site.transport.store.session ?? SESSIONS[session];
  const [core, setCore] = React.useState<string | null>("/files/sample.png");
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["AttachInput", "generic"], ["FrappeAttachField · FrappeAttachHost · FrappeFormImage", "simulated"]]} note={l(
        "SIMULATED backend operations: uploads (only the File row is kept — no bytes), Library / Link attachments, remove_attach and savedocs are answered by the in-browser simulator. Nothing on this page ran against a real Frappe site.",
        "عمليات خلفية محاكاة: الرفع (يُحفظ صف File فقط بلا محتوى) والإرفاق من المكتبة أو الرابط و remove_attach و savedocs يجيب عنها المحاكي داخل المتصفّح. لم يُشغَّل شيء في هذه الصفحة على موقع فرابيه حقيقي.")} />
      <Section title={l("Attach Image in a form", "إرفاق صورة في نموذج")}
        description={l("As Desk: Attach opens the uploader (My Device / Library / Link / Camera where the browser has one; per file: thumbnail, Optimize, Private with the public-file warning, Crop for JPEG / PNG; images only; the site's max_file_size — 5 MB here), the value becomes the File's URL and the FORM IS SAVED; hover or focus the link to preview the image; Clear asks, removes the File (remove_attach) and saves; Reload File re-sends the last file. The header image has Desk's Change → Upload / Remove. Sales User only reads: no menu, and the simulated server refuses uploads (403).",
          "كما في ديسك: «إرفاق» يفتح أداة الرفع (جهازي / المكتبة / رابط / الكاميرا إن توفّرت؛ لكل ملف: صورة مصغّرة وتحسين وخاص مع تحذير الملف العام وقص لصور JPEG / PNG؛ صور فقط، الحد الأقصى لحجم الملف في الموقع — 5 ميغابايت هنا)، وتصبح القيمة رابط الملف ويُحفظ النموذج؛ مرّر المؤشر أو ركّز على الرابط لمعاينة الصورة؛ «مسح» يسأل ثم يحذف الملف (remove_attach) ويحفظ؛ «إعادة رفع الملف» يرسل آخر ملف من جديد. ولصورة الرأس قائمة «تغيير» ← رفع / إزالة. مستخدم المبيعات للقراءة فقط: لا قائمة، والخادم المحاكى يرفض الرفع (403).")}>
        <SimulatedPermissionStrip />
        <Picker legend={l("Session", "الجلسة")} value={session} onChange={setSession}
          options={[{ value: "admin", label: l("System Manager", "مدير النظام") }, { value: "dataEntry", label: l("Data Entry", "إدخال البيانات") }, { value: "sales", label: l("Sales User", "مستخدم المبيعات") }]} />
        <SessionBadge session={session} />
        <Example code={`<FrappeForm doctype="Site Visit" name="SV-0001" />  // FrappeFormView is the Attach controls' form (FrappeAttachHost)`}>
          <FrappeProvider key={session} client={site.client} queryClient={site.qc} session={{ user: s.user, fullName: s.fullName, roles: s.roles }}>
            <FrappeForm doctype="Site Visit" name="SV-0001" guardUnload={false} menu={false} />
          </FrappeProvider>
        </Example>
        <RequestLog transport={site.transport} />
      </Section>
      <Section title={l("The Core control, without Frappe", "عنصر التحكم الأساسي بلا فرابيه")}
        description={l("AttachInput draws Desk's Attach button and attached-file row; the host uploads. Here the host keeps the value in memory.",
          "يرسم AttachInput زر الإرفاق وسطر الملف المرفق كما في ديسك؛ والمضيف هو من يرفع. هنا يحفظ المضيف القيمة في الذاكرة.")}>
        <Example code={`<AttachInput value={url} image onAttach={openMyUploader} onClear={() => setUrl(null)} />`}>
          <div className="max-w-sm">
            <AttachInput value={core} image onAttach={() => setCore("/files/sample.png")} onClear={() => setCore(null)} />
          </div>
        </Example>
      </Section>
    </div>
  );
}
