/**
 * P35 form workstream — SIMULATED: FrappeForm over the in-browser simulator with the new slots (menu, extraTabs),
 * Ctrl/⌘+S (primary action), undo / redo, custom buttons, the unsaved-changes guard, and Quick Entry (Link
 * "Create a new User" and a stand-alone "New ToDo"). Every save goes to the simulator's memory; nothing here is a real
 * Frappe site.
 */
import * as React from "react";
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui";
import { FrappeForm, FrappeQuickEntry, useUnsavedChangesBlocker, type FormController } from "@ui/frappe";
import { simScenario } from "../../../src/frappe/testing";
import { Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import { SimProvider, SimulatedPermissionStrip, StatusStrip, useSimSite } from "./frappe/shared";

export function FrappeFormP35Page() {
  const tr = useTr();
  const site = useSimSite({ permissions: simScenario.administrator() }, []);
  const ref = React.useRef<FormController | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [log, setLog] = React.useState<string[]>([]);
  const [qe, setQe] = React.useState(false);
  const guard = useUnsavedChangesBlocker(dirty, { confirm: () => true });
  const note = (s: string) => setLog((l0) => [s, ...l0].slice(0, 6));
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm">⋯</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => ref.current?.undo()}>{tr(l("Undo (Ctrl+Z)", "تراجع (Ctrl+Z)"))}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => ref.current?.redo()}>{tr(l("Redo (Ctrl+Shift+Z)", "إعادة (Ctrl+Shift+Z)"))}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <div className="space-y-12">
      <SimulatedPermissionStrip />
      <StatusStrip parts={[["Ctrl+S primary action · undo / redo · custom buttons (P35)", "simulated"], ["Quick Entry (P35)", "simulated"], ["menu / extraTabs slots (P35)", "simulated"]]} />
      <Section title={l("Form with the P35 slots", "نموذج مع منافذ P35")} description={l(
        "SIMULATED. Edit a field and press Ctrl/⌘+S anywhere on the page (the visible primary action runs); Ctrl/⌘+Z outside a text box undoes. The ⋯ menu is the `menu` slot; 'Notes' is an `extraTabs` tab; 'Notify' and 'Create' come from frm.addCustomButton in refresh. In 'Allocated To', type a new address and pick 'Create a new User' — Quick Entry opens and the saved user is written back.",
        "محاكاة. عدّل حقلاً واضغط Ctrl/⌘+S في أي مكان (يُنفَّذ الإجراء الأساسي الظاهر)؛ Ctrl/⌘+Z خارج مربع النص يتراجع. قائمة ⋯ هي منفذ `menu`؛ 'Notes' تبويب من `extraTabs`؛ 'Notify' و 'Create' من frm.addCustomButton. في 'Allocated To' اكتب عنواناً جديداً واختر 'إنشاء User جديد' — يفتح الإدخال السريع ويُكتب المستخدم المحفوظ.")}>
        <SimProvider site={site}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={dirty ? "warning" : "outline"}>{dirty ? "dirty" : "clean"}</Badge>
            <span>{tr(l("Leaving now would", "المغادرة الآن"))}: {guard.dirty ? tr(l("ask first (useUnsavedChangesBlocker)", "تسأل أولاً")) : tr(l("not ask", "لا تسأل"))}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setQe(true)}>{tr(l("New ToDo (Quick Entry)", "مهمة جديدة (إدخال سريع)"))}</Button>
          </div>
          <FrappeForm
            doctype="ToDo" name="TD-0002" guardUnload={false} controllerRef={ref} onDirtyChange={setDirty} menu={menu}
            extraTabs={[{ key: "notes", label: "Notes", render: () => <p className="text-sm text-muted-foreground">{tr(l("An extra tab rendered by the app (e.g. Connections).", "تبويب إضافي يرسمه التطبيق (مثل الاتصالات)."))}</p> }]}
            events={{ refresh: (frm) => { frm.addCustomButton("Notify", () => note("Notify clicked")); frm.addCustomButton("Task", () => note("Create → Task"), "Create"); } }}
            onSaved={(d, a) => note(`onSaved: ${d.name} (${a}) — SIMULATED`)}
          />
          <FrappeQuickEntry doctype="ToDo" open={qe} onOpenChange={setQe} onCreated={(d) => note(`Quick Entry created ${d.name} — SIMULATED`)} />
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground" aria-live="polite">{log.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </SimProvider>
      </Section>
    </div>
  );
}
