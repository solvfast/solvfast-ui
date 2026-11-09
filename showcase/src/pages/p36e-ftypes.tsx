/**
 * P36e ftypes — the real controls for Frappe's Signature, Icon, Barcode and Geolocation field types, rendered through
 * the package's `FrappeField` from a DocField (Frappe 15.110 form/controls/signature.js, icon.js, barcode.js,
 * geolocation.js). No server call is made by these controls; the FrappeProvider here sits on an empty in-page
 * simulator only because FrappeField needs one. Status: Signature Complete; Icon Complete where the page carries Desk's
 * sprite (names only elsewhere, as here); Barcode and Geolocation PARTIAL (display only — see the notes on each).
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { Badge } from "@ui";
import { FrappeField, FrappeProvider, createFrappeClient, type FieldDisplayStatus, type FrappeDocField } from "@ui/frappe";
import { createFixtureTransport } from "../../../src/frappe/testing";
import { Example, Section } from "../doc/Doc";
import { l, useTr, type L } from "../i18n";

function useEmptySite() {
  return React.useMemo(() => {
    const transport = createFixtureTransport({ meta: {} });
    return { client: createFrappeClient({ transport }), qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
  }, []);
}

const show = (v: unknown) => {
  const s = v == null ? "null" : typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v);
  return s.length > 140 ? `${s.slice(0, 140)}… (${s.length} chars)` : s;
};

function LiveField({ df, initial, status }: { df: FrappeDocField; initial: unknown; status?: FieldDisplayStatus }) {
  const [value, setValue] = React.useState<unknown>(initial);
  React.useEffect(() => setValue(initial), [initial]);
  return (
    <div className="min-w-0 space-y-2">
      <FrappeField df={df} value={value} onChange={setValue} status={status} />
      <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr" title={show(value)}>value: {show(value)}</p>
    </div>
  );
}

function StatusLine({ status, note }: { status: "COMPLETE" | "PARTIAL"; note: L }) {
  const tr = useTr();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant={status === "COMPLETE" ? "success" : "warning"} data-ftypes-status={status}>{tr(status === "COMPLETE" ? l("Complete", "مكتمل") : l("Partial", "جزئي"))}</Badge>
      <span className="text-muted-foreground">{tr(note)}</span>
    </div>
  );
}

/** A real PNG data URL drawn on an off-screen canvas (black ink on transparent, as Desk stores it). */
function useSampleSignature(): string {
  const [png, setPng] = React.useState("");
  React.useEffect(() => {
    const c = document.createElement("canvas");
    c.width = 360; c.height = 120;
    const g = c.getContext("2d");
    if (!g) return;
    g.lineWidth = 2; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#000000";
    g.beginPath(); g.moveTo(20, 80);
    for (let x = 20; x <= 300; x += 6) g.lineTo(x, 70 + Math.sin(x / 14) * 22 - (x % 60 === 20 ? 18 : 0));
    g.stroke();
    g.beginPath(); g.moveTo(40, 100); g.lineTo(320, 96); g.stroke();
    setPng(c.toDataURL("image/png"));
  }, []);
  return png;
}

// Sample stored markup in JsBarcode's format (barcode.js:44-57: <svg … data-barcode-value>, width="100%"). The bars are
// illustrative — this is not a scannable code; the package draws whatever SVG is stored, after sanitizing it.
const BARS = [3, 1, 1, 2, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 1, 3];
const SAMPLE_BARCODE = (() => {
  let x = 0;
  const rects = BARS.map((w, i) => { const r = i % 2 === 0 ? `<rect x="${x}" y="0" width="${w * 3}" height="50"></rect>` : ""; x += w * 3; return r; }).join("");
  return `<svg width="100%" x="0px" y="0px" viewBox="0 0 ${x + 20} 90" xmlns="http://www.w3.org/2000/svg" version="1.1" data-barcode-value="SF-2026-0042"><rect x="0" y="0" width="${x + 20}" height="90" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;">${rects}<text style="font: 16px monospace" text-anchor="middle" x="${x / 2}" y="72">SF-2026-0042</text></g></svg>`;
})();
const UNSAFE_BARCODE = SAMPLE_BARCODE.replace("<svg ", '<svg onload="alert(1)" ').replace("</g>", '</g><script>alert(2)</script><foreignObject><img src="x" onerror="alert(3)"></foreignObject>');

const GEO_SAMPLE = JSON.stringify({
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [46.6753, 24.7136] } },
    { type: "Feature", properties: { point_type: "circle", radius: 250 }, geometry: { type: "Point", coordinates: [39.1925, 21.4858] } },
    { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[46.6, 24.7], [46.7, 24.75], [46.8, 24.72]] } },
    { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[50.1, 26.3], [50.2, 26.3], [50.2, 26.4], [50.1, 26.4], [50.1, 26.3]]] } },
  ],
});

const df = (fieldtype: string, label: string, extra: Partial<FrappeDocField> = {}) => ({ fieldname: "value", fieldtype, label, ...extra }) as FrappeDocField;

export function FtypesP36ePage() {
  const site = useEmptySite();
  const tr = useTr();
  const signature = useSampleSignature();
  return (
    <FrappeProvider client={site.client} queryClient={site.qc} session={{ user: "Administrator" }}>
      <div className="space-y-10" data-testid="ftypes-p36e">
        <Section title={l("Signature", "التوقيع")}
          description={l("Draw with a mouse, pen or finger: each stroke stores the canvas as a PNG data URL (signature.js:130-135); Undo removes the last stroke, Clear stores \"\" (:125-128). Read-only shows the image. Black ink on a white pad in both themes — the PNG is what Desk stores.",
            "ارسم بالفأرة أو القلم أو الإصبع: كل خط يحفظ اللوحة كعنوان بيانات PNG ‏(signature.js:130-135)؛ «تراجع» يزيل آخر خط و«مسح» يحفظ قيمة فارغة (:125-128). وضع القراءة يعرض الصورة. حبر أسود على لوحة بيضاء في السمتين — ملف PNG هو ما يحفظه ديسك.")}>
          <StatusLine status="COMPLETE" note={l("Core SignatureInput; FrappeField dispatch.", "SignatureInput في النواة؛ توجيه FrappeField.")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Example title={l("Write — empty, required", "كتابة — فارغ، إلزامي")}><LiveField df={df("Signature", tr(l("Customer signature", "توقيع العميل")), { reqd: 1 })} initial="" status="Write" /></Example>
            <Example title={l("Write — a stored signature (new strokes add to it)", "كتابة — توقيع محفوظ (الخطوط الجديدة تُضاف إليه)")}><LiveField df={df("Signature", tr(l("Approver signature", "توقيع المعتمد")))} initial={signature} status="Write" /></Example>
            <Example title={l("Read", "قراءة")}><LiveField df={df("Signature", tr(l("Approver signature", "توقيع المعتمد")))} initial={signature} status="Read" /></Example>
            <Example title={l("Read — empty", "قراءة — فارغ")}><LiveField df={df("Signature", tr(l("Witness signature", "توقيع الشاهد")))} initial="" status="Read" /></Example>
          </div>
        </Section>

        <Section title={l("Icon", "الأيقونة")}
          description={l("The value is an icon NAME from Frappe's sprite (icon.js). Names: the page's #all-symbols sprite when Desk loaded it, else the 179 names of Frappe 15.110's timeless sprite. Glyphs are drawn only when the sprite is in the page — this showcase has none, so only the names show (no other icon set is substituted).",
            "القيمة اسم أيقونة من ملف رموز فرابيه (icon.js). الأسماء: رموز ‎#all-symbols‎ في الصفحة إن حمّلها ديسك، وإلا أسماء ملف timeless في فرابيه 15.110 وعددها 179. لا تُرسم الأيقونات إلا إذا كان الملف في الصفحة — لا يوجد هنا، فتظهر الأسماء فقط (دون استبدالها بمجموعة أخرى).")}>
          <StatusLine status="COMPLETE" note={l("Complete in a page that carries Desk's sprite; names only elsewhere (as here).", "مكتمل في صفحة تحمل ملف رموز ديسك؛ الأسماء فقط في غيرها (كما هنا).")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Example title={l("Write — pick or type a name", "كتابة — اختر اسمًا أو اكتبه")}><LiveField df={df("Icon", tr(l("Menu icon", "أيقونة القائمة")))} initial="crm" status="Write" /></Example>
            <Example title={l("Write — empty, required", "كتابة — فارغ، إلزامي")}><LiveField df={df("Icon", tr(l("Menu icon", "أيقونة القائمة")), { reqd: 1 })} initial="" status="Write" /></Example>
            <Example title={l("Read", "قراءة")}><LiveField df={df("Icon", tr(l("Menu icon", "أيقونة القائمة")))} initial="folder-normal" status="Read" /></Example>
          </div>
        </Section>

        <Section title={l("Barcode", "الباركود")}
          description={l("Desk stores the SVG that JsBarcode draws (barcode.js:44-57) and the server does not sanitize it (base_document.py:1117). Shown here sanitized, with its data-barcode-value. Creating or changing a barcode needs a generator (JsBarcode, MIT) that this package does not include — only Clear is offered. The sample bars are illustrative, not a scannable code.",
            "يحفظ ديسك صورة SVG التي يرسمها JsBarcode ‏(barcode.js:44-57) ولا ينقّيها الخادم (base_document.py:1117). تُعرض هنا بعد التنقية مع قيمة data-barcode-value. إنشاء الباركود أو تغييره يحتاج إلى مولّد (JsBarcode، رخصة MIT) غير مضمّن في الحزمة — يُتاح «مسح» فقط. الأشرطة في المثال توضيحية وليست رمزًا قابلًا للمسح.")}>
          <StatusLine status="PARTIAL" note={l("Display (sanitized) + Clear; editing deferred (needs JsBarcode).", "عرض (بعد التنقية) + مسح؛ التعديل مؤجّل (يحتاج JsBarcode).")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Example title={l("Write — stored SVG", "كتابة — SVG محفوظ")}><LiveField df={df("Barcode", tr(l("Asset tag", "ملصق الأصل")))} initial={SAMPLE_BARCODE} status="Write" /></Example>
            <Example title={l("Read — unsafe stored markup, sanitized", "قراءة — ترميز محفوظ غير آمن بعد التنقية")}><LiveField df={df("Barcode", tr(l("Asset tag", "ملصق الأصل")))} initial={UNSAFE_BARCODE} status="Read" /></Example>
            <Example title={l("Read — plain text (not converted yet)", "قراءة — نص (لم يُحوَّل بعد)")}><LiveField df={df("Barcode", tr(l("Asset tag", "ملصق الأصل")))} initial="6281000000001" status="Read" /></Example>
            <Example title={l("Write — empty, required", "كتابة — فارغ، إلزامي")}><LiveField df={df("Barcode", tr(l("Asset tag", "ملصق الأصل")), { reqd: 1 })} initial="" status="Write" /></Example>
          </div>
        </Section>

        <Section title={l("Geolocation", "الموقع الجغرافي")}
          description={l("Desk stores a GeoJSON FeatureCollection drawn on a Leaflet map (geolocation.js:207-223); circles are Points with properties.point_type and radius (:117-139). Here the features are listed (latitude / longitude, radius, number of points). Drawing needs Leaflet + Leaflet.draw (BSD-2-Clause / MIT), not included. Invalid JSON is reported, never thrown.",
            "يحفظ ديسك مجموعة معالم GeoJSON مرسومة على خريطة Leaflet ‏(geolocation.js:207-223)؛ الدوائر نقاط مع properties.point_type ونصف القطر (:117-139). هنا تُسرد المعالم (خطا العرض والطول، نصف القطر، عدد النقاط). الرسم يحتاج Leaflet و Leaflet.draw ‏(BSD-2-Clause / MIT) غير المضمّنتين. يُبلَّغ عن JSON غير الصالح دون انهيار.")}>
          <StatusLine status="PARTIAL" note={l("Read-only feature list; map drawing deferred (needs Leaflet + Leaflet.draw).", "قائمة معالم للقراءة فقط؛ الرسم على الخريطة مؤجّل (يحتاج Leaflet و Leaflet.draw).")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Example title={l("Write — stored FeatureCollection", "كتابة — مجموعة معالم محفوظة")}><LiveField df={df("Geolocation", tr(l("Site location", "موقع الموقع")))} initial={GEO_SAMPLE} status="Write" /></Example>
            <Example title={l("Read — empty (still shown, as in Desk)", "قراءة — فارغ (يظهر كما في ديسك)")}><LiveField df={df("Geolocation", tr(l("Site location", "موقع الموقع")), { read_only: 1 })} initial="" /></Example>
            <Example title={l("Read — invalid GeoJSON", "قراءة — GeoJSON غير صالح")}><LiveField df={df("Geolocation", tr(l("Site location", "موقع الموقع")))} initial={'{"type":"FeatureCollection","features":'} status="Read" /></Example>
          </div>
        </Section>
      </div>
    </FrappeProvider>
  );
}
