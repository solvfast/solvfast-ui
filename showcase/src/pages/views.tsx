/**
 * P35 views — List / Report / Image / Kanban / Calendar on a SIMULATED Frappe site (in-browser simulator, demo data:
 * src/frappe/testing/handlers/views.ts `viewsDemoBackend`), plus the Core components with plain data. Nothing here
 * talks to a real site.
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { CalendarMonth, KanbanBoard, ViewSwitcher, type CalendarEvent, type KanbanMove, type ListViewType } from "@ui";
import { FrappeImageView, FrappeProvider, FrappeViews, createFrappeClient } from "@ui/frappe";
import { createFixtureTransport, viewsDemoBackend, type FixtureTransport } from "../../../src/frappe/testing";
import { reportSetValueHandler } from "../../../src/frappe/testing/handlers/views";
import { Example, Section } from "../doc/Doc";
import { l } from "../i18n";
import { StatusStrip } from "./frappe/shared";

function useViewsSite() {
  return React.useMemo(() => {
    // P36: set_value with the child-table branch (client.py:195-203), so Report view child cells save as on a site
    // eslint-disable-next-line prefer-const
    let transport: FixtureTransport;
    transport = createFixtureTransport(viewsDemoBackend(), { handlers: { "frappe.client.set_value": reportSetValueHandler(() => transport) } });
    return { transport, client: createFrappeClient({ transport }), qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
  }, []);
}

const SESSION = { user: "Administrator", fullName: "Administrator", roles: ["System Manager"] };

export function ViewsPage() {
  const site = useViewsSite();
  const [view, setView] = React.useState<ListViewType>("list");
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["ViewSwitcher · availableViews", "simulated"], ["FrappeReportView (reportview.get, client.set_value)", "simulated"], ["FrappeImageView (reportview.get)", "simulated"], ["FrappeKanbanView (Kanban Board, update_order_for_single_card)", "simulated"], ["FrappeCalendarView (reportview range / get_events)", "simulated"], ["Gantt · Dashboard · Map · Tree · Inbox", "missing"]]}
        note={l("SIMULATED. Every view is the real package component; each request goes to the in-browser simulator (Kanban Board and get_events handlers cite kanban_board.py / calendar.py). Permissions are not evaluated by the simulated Kanban and calendar handlers. No view here has been run against a real site.", "محاكاة. كل عرض هو مكوّن الحزمة الحقيقي؛ كل طلب يذهب إلى المحاكي داخل المتصفّح (معالجات لوحة كانبان و get_events تستشهد بـ kanban_board.py و calendar.py). لا تقيّم المعالجات المحاكاة للكانبان والتقويم الأذونات. لم يُشغَّل أي عرض هنا على موقع حقيقي.")} />
      <FrappeProvider client={site.client} queryClient={site.qc} session={SESSION}>
        <Section title={l("One DocType, every implemented view (SIMULATED)", "نوع مستند واحد، كل العروض المنفّذة (محاكاة)")}
          description={l("FrappeViews on Project Task: the switcher offers List, Report, Kanban (a Kanban Board exists) and Calendar (date fields); Image is listed disabled (no image_field) and Gantt / Dashboard / Map / Tree / Inbox are listed disabled as not implemented. Filters set in the Report, Kanban or Calendar view carry to the next view. The Report view edits cells as Desk 15.110 does (Project Task has a Table field, so every writable field of a draft is editable, child-table columns included; editable=\"strict\" or a function opts out).", "FrappeViews على مهام المشروع: يعرض المبدّل القائمة والتقرير وكانبان (توجد لوحة كانبان) والتقويم (حقول تاريخ)؛ وتظهر الصور معطّلة (لا يوجد image_field) وجانت ولوحة المعلومات والخريطة والشجرة وصندوق الوارد معطّلة لأنها غير منفّذة. تنتقل التصفيات من عرض التقرير أو كانبان أو التقويم إلى العرض التالي. يحرّر عرض التقرير الخلايا كما يفعل Desk 15.110 (لمهام المشروع حقل جدول، فكل حقل قابل للكتابة في المسودة قابل للتحرير، بما في ذلك أعمدة الجداول الفرعية؛ ويغيّر editable=\"strict\" أو دالة ذلك).")}>
          <Example className="p-3" code={`<FrappeViews doctype="Project Task" showUnavailable
  view={view} onViewChange={setView}
  calendarView={{ initialMonth: "2026-11-01" }} />`}>
            <FrappeViews doctype="Project Task" showUnavailable view={view} onViewChange={setView} calendarView={{ initialMonth: "2026-11-01", today: "2026-11-04" }} />
          </Example>
        </Section>
        <Section title={l("Image view (SIMULATED)", "عرض الصور (محاكاة)")} description={l("FrappeImageView on Product: image_field and title_field from the meta, initials when there is no image, the list's search / filters / sort / pager. The demo images do not exist on this page, so the browser shows their alt text.", "FrappeImageView على المنتج: image_field و title_field من البيانات الوصفية، والأحرف الأولى عند غياب الصورة، وبحث القائمة وتصفياتها وفرزها وترقيمها. الصور التجريبية غير موجودة في هذه الصفحة فيعرض المتصفّح نصّها البديل.")}>
          <Example className="p-3" code={`<FrappeImageView doctype="Product" />`}>
            <FrappeImageView doctype="Product" />
          </Example>
        </Section>
      </FrappeProvider>
      <CoreViews />
    </div>
  );
}

type Card = { id: string; title: string; col: string };
const CARDS: Card[] = [{ id: "1", title: "Draft brief", col: "todo" }, { id: "2", title: "Review copy", col: "todo" }, { id: "3", title: "Publish", col: "doing" }];
const EVENTS: CalendarEvent[] = [{ id: "a", title: "Workshop", start: "2026-11-03", end: "2026-11-05", color: "#2490ef" }, { id: "b", title: "Launch", start: "2026-11-18 10:00:00" }];

function CoreViews() {
  const [cards, setCards] = React.useState(CARDS);
  const [month, setMonth] = React.useState("2026-11-01");
  const [view, setView] = React.useState<ListViewType>("kanban");
  const move = (m: KanbanMove<Card>) => setCards((cs) => cs.map((c) => (c.id === m.key ? { ...c, col: m.to } : c)));
  return (
    <Section title={l("Core views with plain data (no Frappe)", "العروض الأساسية ببيانات عادية (دون فرابيه)")} description={l("KanbanBoard (drag a card, or use its Move to… menu, or Alt+Left / Alt+Right) and CalendarMonth. The ViewSwitcher only offers the views you declare available.", "KanbanBoard (اسحب بطاقة، أو استخدم قائمة نقل إلى…، أو Alt+يسار / Alt+يمين) و CalendarMonth. لا يعرض ViewSwitcher إلا العروض التي تعلنها متاحة.")}>
      <Example className="space-y-3 p-3" code={`<ViewSwitcher views={[{ view: "kanban", available: true }, { view: "calendar", available: true }]} value={view} onChange={setView} />
<KanbanBoard columns={cols} rows={cards} rowKey={(c) => c.id} columnOf={(c) => c.col} title={(c) => c.title} onMove={move} />`}>
        <ViewSwitcher views={[{ view: "kanban", available: true }, { view: "calendar", available: true }]} value={view} onChange={setView} />
        {view === "kanban"
          ? <KanbanBoard columns={[{ key: "todo", label: l("To do", "للتنفيذ"), indicator: "Blue" }, { key: "doing", label: l("Doing", "قيد التنفيذ"), indicator: "Orange" }, { key: "done", label: l("Done", "منجز"), indicator: "Green" }]}
              rows={cards} rowKey={(c) => c.id} columnOf={(c) => c.col} title={(c) => c.title} onMove={move} />
          : <CalendarMonth month={month} onMonthChange={setMonth} events={EVENTS} today="2026-11-04" />}
      </Example>
    </Section>
  );
}
