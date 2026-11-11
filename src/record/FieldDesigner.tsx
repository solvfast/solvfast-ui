import * as React from "react";
import {
  AlignLeft, ArrowDown, ArrowUp, Calendar, CheckSquare, ChevronDown, Clock, Database, FileText, GripVertical, Hash,
  Image as ImageIcon, Layers, Link2, List, Lock, MapPin, Palette, PenLine, Phone, Plus, Share2, Star, Table, Trash2,
  Type, Upload, X, type LucideIcon,
} from "lucide-react";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Switch } from "../primitives/switch";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Skeleton } from "../primitives/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "../primitives/alert-dialog";
import { useLocale } from "../theme/ThemeProvider";
import type { designerEn } from "../theme/messages-ws/designer";
import { loc, type Localized } from "../lib/localized";
import { cn } from "../lib/cn";
import {
  appendTab, insertItem, insertSectionAfter, moveItem, removeSection, removeTab, stepItem, toLayout,
  type DesignerItem, type DesignerKind, type DropSlot,
} from "./fieldLayout";
import { definitionProblem, ownKeys, type FieldDefinition, type FieldTypeRegistry } from "./fieldDefinition";
import { FieldInspector, type LinkTargetField, type LinkTargetOption } from "./FieldInspector";

/** What the designer shows: the form's items in order, or why it cannot be designed here. */
export interface DesignerState {
  items: DesignerItem[];
  /** Why this form cannot be designed (no right, a DocType that takes no fields): shown instead of the tools. */
  refusal?: string;
  /** A line shown above the form (e.g. the field set changed since it was saved). */
  notice?: string;
}
export interface DesignerFieldSet { name: string; label: Localized; description?: string; fieldCount?: number }
export interface DesignerSetField {
  /** The id the item will carry on the form (the adapter's token). */
  id: string;
  label: Localized;
  kind: DesignerKind;
  fieldtype?: string;
}
export interface DesignerRemoval { id: string; label: string; rowsWithData: number }

/**
 * Where the designer reads and writes. The app supplies it (Sayr's: `createSayrFieldDesignerAdapter` in
 * `@solvfast/ui/sayr`); keep it stable (`useMemo`), the designer reloads when it changes.
 */
export interface FieldDesignerAdapter {
  load(): Promise<DesignerState>;
  listFieldSets(): Promise<DesignerFieldSet[]>;
  /** A set's fields that can be added (layout breaks left out). */
  fieldsOf(set: string): Promise<DesignerSetField[]>;
  /** The section a set's fields are added under. Absent: fields are only added into existing sections. */
  sectionOf?(set: string, label: string): DesignerItem;
  /** A new tab. Absent: no Add tab. */
  makeTab?(label: string): DesignerItem;
  /** A new section the form adds itself (`own`). Absent: no Add section. */
  makeSection?(label: string): DesignerItem;
  /** The types a field defined on the form may take. Absent: fields come from field sets only. */
  fieldTypes?(): Promise<FieldTypeRegistry>;
  /** Record types a record link (or, `childTables`, a table) may point at. */
  linkTargets?(search: string, childTables: boolean): Promise<LinkTargetOption[]>;
  /** A record type's fields: what a link filter and an auto-fill may name. */
  linkTargetFields?(doctype: string): Promise<LinkTargetField[]>;
  /** Write the form as arranged; resolves to the form as the server has it now. */
  save(items: DesignerItem[]): Promise<DesignerState>;
  /** How many records hold a value in fields about to leave the form (asked before saving a removal). */
  removalImpact?(ids: string[]): Promise<DesignerRemoval[]>;
}

/** Unsaved changes handed to a host whose own Save also saves the form (e.g. `FrappeTypeForm`). */
export interface DesignerPending { dirty: boolean; save: () => Promise<void> }

type Key = keyof typeof designerEn;

export interface FieldDesignerProps {
  adapter: FieldDesignerAdapter;
  /** Replace any string (keys of the `fd…` / `fi…` message blocks). */
  labels?: Partial<Record<Key, Localized>>;
  onSaved?: (state: DesignerState) => void;
  /** Wizard mode: the form's tabs are a new record's ordered steps. Shown as a switch; saved by the host. */
  wizard?: { on: boolean; onChange: (on: boolean) => void | Promise<void> };
  /** The host saves the form with its own Save: the designer reports its changes here and shows no Save button. */
  onPendingChange?: (pending: DesignerPending) => void;
  className?: string;
}

type Selection =
  | { kind: "none" }
  | { kind: "add"; slot: DropSlot }
  | { kind: "field"; id: string }
  | { kind: "section"; id: string }
  | { kind: "tab"; index: number }
  | { kind: "deploy"; where: { tab: number; section: number } };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/<[^>]+>/g, "");
const signature = (items: DesignerItem[]) => JSON.stringify(items.map((i) => [i.id, i.label ?? "", i.definition ?? null]));
const canMove = (i: DesignerItem) => !i.native || !!i.movable;
let newIds = 0;

const TYPE_ICONS: Record<string, LucideIcon> = {
  text: Type, long_text: AlignLeft, paragraph: AlignLeft, long_form: FileText, rich_text: FileText, markdown: FileText,
  html_content: FileText, read_only: Lock, dropdown: List, radio: List, autocomplete: List, multi_select: List,
  checkbox: CheckSquare, rating: Star, color: Palette, icon: ImageIcon, number: Hash, decimal: Hash, currency: Hash,
  percent: Hash, duration: Clock, date: Calendar, datetime: Calendar, time: Clock, email: Type, phone: Phone,
  web_address: Link2, file_upload: Upload, image_upload: ImageIcon, signature: PenLine, image_preview: ImageIcon,
  record_link: Link2, dynamic_link: Link2, child_table: Table, map_location: MapPin, barcode: Hash, json_data: Database,
};
const iconOf = (type?: string): LucideIcon => (type && TYPE_ICONS[type]) || Type;

/** The Form section of a type: its fields as tabs → sections → columns, with a properties panel beside it. Standard
 *  fields are placed only; shared fields move; a field set's fields move and are removed; fields defined here are
 *  edited with every property a field set's field has. */
export function FieldDesigner({ adapter, labels, onSaved, wizard, onPendingChange, className }: FieldDesignerProps) {
  const { t, language } = useLocale();
  const L = React.useCallback((key: Key) => loc(labels?.[key], language) || t(key), [labels, language, t]);
  const [state, setState] = React.useState<DesignerState | null>(null);
  const [items, setItems] = React.useState<DesignerItem[]>([]);
  const [registry, setRegistry] = React.useState<FieldTypeRegistry | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);
  const [selection, setSelection] = React.useState<Selection>({ kind: "none" });
  const [confirm, setConfirm] = React.useState<null | { kind: "removal"; removals: DesignerRemoval[] } | { kind: "empty" }>(null);
  const confirmAnswer = React.useRef<((ok: boolean) => void) | null>(null);
  const dragging = React.useRef<string | null>(null);

  const apply = (next: DesignerState) => { setState(next); setItems(next.items); setError(null); };
  React.useEffect(() => {
    let live = true;
    setState(null);
    adapter.load().then((s) => live && apply(s), (e) => live && setError(errorText(e)));
    adapter.fieldTypes?.().then((r) => live && setRegistry(r), () => live && setRegistry(null));
    return () => { live = false; };
  }, [adapter]);

  const edit = (next: DesignerItem[]) => { setItems(next); setSaved(false); };
  const tabs = toLayout(items);
  const tabIndex = Math.min(activeTab, tabs.length - 1);
  const dirty = !!state && !state.refusal && signature(items) !== signature(state.items);
  const keys = React.useMemo(() => ownKeys(items), [items]);
  const siblings = React.useMemo(
    () => items.filter((i) => i.definition).map((i) => ({ ...i.definition!, key: keys.get(i.id) })),
    [items, keys],
  );

  const ask = (next: NonNullable<typeof confirm>) => new Promise<boolean>((resolve) => {
    confirmAnswer.current = resolve;
    setConfirm(next);
  });
  const answer = (ok: boolean) => {
    setConfirm(null);
    confirmAnswer.current?.(ok);
    confirmAnswer.current = null;
  };

  const save = async (): Promise<void> => {
    if (!state) return;
    const broken = items.find((i) => i.definition && definitionProblem(i.definition, registry?.types.find((x) => x.key === i.definition!.type)));
    if (broken) {
      setSelection({ kind: "field", id: broken.id });
      throw new Error(L("fdFixFields"));
    }
    const now = new Set(items.map((i) => i.id));
    const loadedOwn = state.items.filter((i) => !i.native && i.kind === "field");
    const removed = loadedOwn.filter((i) => !now.has(i.id)).map((i) => i.id);
    if (loadedOwn.length && !items.some((i) => !i.native && i.kind === "field")) {
      if (!(await ask({ kind: "empty" }))) throw new Error(L("fdNotSaved"));
    } else if (removed.length && adapter.removalImpact) {
      const holding = (await adapter.removalImpact(removed)).filter((r) => r.rowsWithData > 0);
      if (holding.length && !(await ask({ kind: "removal", removals: holding }))) throw new Error(L("fdNotSaved"));
    }
    setSaving(true);
    try {
      const next = await adapter.save(items);
      apply(next);
      setSaved(true);
      setSelection({ kind: "none" });
      onSaved?.(next);
    } finally {
      setSaving(false);
    }
  };
  const saveRef = React.useRef(save);
  saveRef.current = save;
  React.useEffect(() => { onPendingChange?.({ dirty, save: () => saveRef.current() }); }, [dirty, onPendingChange]);
  const saveHere = async () => { try { await save(); } catch (e) { setError(errorText(e)); } };

  const drop = (slot: DropSlot) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragging.current;
    dragging.current = null;
    if (id) edit(moveItem(items, id, slot));
  };
  const allowDrop = (e: React.DragEvent) => { if (dragging.current) e.preventDefault(); };

  const addOwnField = (slot: DropSlot, type: string) => {
    const item: DesignerItem = { id: `new:${++newIds}`, kind: "field", own: true, fieldtype: type, label: "", definition: { type, label: "" } };
    edit(insertItem(items, item, slot));
    setSelection({ kind: "field", id: item.id });
  };
  const updateDefinition = (id: string, definition: FieldDefinition) =>
    edit(items.map((i) => (i.id === id ? { ...i, definition, fieldtype: definition.type, label: (language === "ar" && definition.labelAr) || definition.label || definition.labelAr || "" } : i)));

  const uniqueLabel = (base: string) => {
    const taken = new Set(items.filter((i) => i.kind !== "field").map((i) => (i.label ?? "").trim().toLowerCase()));
    let label = base;
    for (let n = 2; taken.has(label.toLowerCase()); n++) label = `${base} ${n}`;
    return label;
  };
  const addSection = () => {
    if (!adapter.makeSection) return;
    const item = adapter.makeSection(uniqueLabel(L("fdNewSection")));
    edit(insertSectionAfter(items, { tab: tabIndex, section: tabs[tabIndex].sections.length - 1 }, item));
    setSelection({ kind: "section", id: item.id });
  };
  const addTab = () => {
    if (!adapter.makeTab) return;
    const item = adapter.makeTab(uniqueLabel(wizard?.on ? `${L("fdStep")} ${tabs.length + 1}` : L("fdNewTab")));
    edit(appendTab(items, item));
    setActiveTab(tabs.length);
    setSelection({ kind: "tab", index: tabs.length });
  };
  const renameBreak = (id: string, label: string) => edit(items.map((i) => (i.id === id ? { ...i, label } : i)));

  const addFromSet = (set: DesignerFieldSet, picked: DesignerSetField[], asSection: boolean, where: { tab: number; section: number }) => {
    const source = loc(set.label, language);
    let next = items;
    let slot: DropSlot;
    if (asSection && adapter.sectionOf) {
      const section = adapter.sectionOf(set.name, source);
      if (!next.some((i) => i.id === section.id)) next = insertSectionAfter(next, where, section);
      const layout = toLayout(next);
      const si = layout[where.tab].sections.findIndex((s) => s.breakItem?.id === section.id);
      slot = { tab: where.tab, section: si, column: layout[where.tab].sections[si].columns.length - 1 };
    } else {
      const layout = toLayout(next);
      slot = { ...where, column: layout[where.tab].sections[where.section].columns.length - 1 };
    }
    for (const f of picked) next = insertItem(next, { id: f.id, kind: "field", label: loc(f.label, language), fieldtype: f.fieldtype, source }, slot);
    edit(next);
    setSelection({ kind: "none" });
  };

  if (error && !state) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!state) return <div className="space-y-2" aria-label={L("fdLoading")}><Skeleton className="h-8 w-48" /><Skeleton className="h-40 rounded-xl" /></div>;
  if (state.refusal) {
    return (
      <section className={cn("space-y-2", className)}>
        <h2 className="text-lg font-semibold">{L("fdTitle")}</h2>
        <p role="alert" className="text-sm text-muted-foreground">{state.refusal}</p>
      </section>
    );
  }

  const tab = tabs[tabIndex];
  const showTabs = tabs.some((x) => x.breakItem) || !!wizard?.on || !!adapter.makeTab;
  const typeLabel = (type?: string) => (type && registry ? loc(registry.types.find((x) => x.key === type)?.label ?? type, language) : type ?? "");
  const selectedItem = selection.kind === "field" || selection.kind === "section" ? items.find((i) => i.id === selection.id) : undefined;
  const whereOf = (id: string) => {
    for (let ti = 0; ti < tabs.length; ti++) {
      const si = tabs[ti].sections.findIndex((s) => s.breakItem?.id === id);
      if (si >= 0) return { tab: ti, section: si };
    }
    return null;
  };

  const panel = (() => {
    if (selection.kind === "add" && registry) {
      return (
        <Panel title={L("fdAddField")} onClose={() => setSelection({ kind: "none" })} closeLabel={L("fdClose")}>
          <div className="space-y-3" role="group" aria-label={L("fdFieldTypes")}>
            {registry.groups.map((g) => {
              const types = g.types.filter((k) => registry.types.some((x) => x.key === k));
              if (!types.length) return null;
              return (
                <div key={g.group} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {types.map((k) => {
                      const Icon = iconOf(k);
                      return (
                        <button key={k} type="button" onClick={() => addOwnField(selection.slot, k)}
                          className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-start text-xs hover:border-primary/50 hover:bg-muted/50">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{typeLabel(k)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      );
    }
    if (selection.kind === "deploy") {
      return (
        <Panel title={L("fdDeploySet")} onClose={() => setSelection({ kind: "none" })} closeLabel={L("fdClose")}>
          <DeploySetPanel adapter={adapter} L={L} present={new Set(items.map((i) => i.id))} canSection={!!adapter.sectionOf}
            onAdd={(set, picked, asSection) => addFromSet(set, picked, asSection, selection.where)} />
        </Panel>
      );
    }
    if (selection.kind === "field" && selectedItem) {
      const item = selectedItem;
      const Icon = iconOf(item.definition?.type ?? item.fieldtype);
      const title = <span className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4 text-primary" />{item.definition ? typeLabel(item.definition.type) : item.label || item.id}</span>;
      const remove = !item.native ? () => { edit(items.filter((i) => i.id !== item.id)); setSelection({ kind: "none" }); } : undefined;
      return (
        <Panel title={title} onClose={() => setSelection({ kind: "none" })} closeLabel={L("fdClose")}
          action={remove && <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label={`${L("fdRemove")}: ${item.label || item.id}`} onClick={remove}><Trash2 className="h-4 w-4" /></Button>}>
          {item.definition && registry ? (
            <FieldInspector definition={item.definition} onChange={(d) => updateDefinition(item.id, d)} registry={registry}
              siblings={siblings.filter((s) => s.key !== keys.get(item.id))} keyPreview={keys.get(item.id) ?? ""}
              linkTargets={adapter.linkTargets} linkTargetFields={adapter.linkTargetFields} L={L} language={language} />
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{item.label || item.id}</p>
              {item.fieldtype && <p className="text-xs text-muted-foreground">{item.fieldtype}</p>}
              <Note icon={item.native ? (item.movable ? Share2 : Lock) : Layers}>
                {item.native ? (item.movable ? L("fdShared") : L("fdLocked")) : `${L("fdFromSet")}: ${item.source ?? ""}. ${L("fdEditInLibrary")}`}
              </Note>
            </div>
          )}
        </Panel>
      );
    }
    if (selection.kind === "section" && selectedItem) {
      const item = selectedItem;
      const where = whereOf(item.id);
      return (
        <Panel title={L("fdSection")} onClose={() => setSelection({ kind: "none" })} closeLabel={L("fdClose")}>
          <div className="space-y-3">
            {item.own ? (
              <div className="space-y-1.5">
                <Label htmlFor="sf-designer-section-title" className="text-xs">{L("fdSectionTitle")}</Label>
                <Input id="sf-designer-section-title" value={item.label ?? ""} onChange={(e) => renameBreak(item.id, e.target.value)} />
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">{item.label || L("fdUntitledSection")}</p>
                <Note icon={item.native ? Lock : Layers}>{item.native ? L("fdSectionLocked") : `${L("fdFromSet")}: ${item.source ?? ""}`}</Note>
              </>
            )}
            {!item.native && where && (
              <Button type="button" size="sm" variant="outline" className="w-full gap-1.5 text-destructive"
                onClick={() => { edit(removeSection(items, where)); setSelection({ kind: "none" }); }}>
                <Trash2 className="h-3.5 w-3.5" />{L("fdRemoveSection")}
              </Button>
            )}
            {!item.native && <p className="text-[11px] text-muted-foreground">{L("fdRemoveSectionHint")}</p>}
          </div>
        </Panel>
      );
    }
    if (selection.kind === "tab" && tabs[selection.index]) {
      const brk = tabs[selection.index].breakItem;
      return (
        <Panel title={wizard?.on ? L("fdStep") : L("fdTab")} onClose={() => setSelection({ kind: "none" })} closeLabel={L("fdClose")}>
          <div className="space-y-3">
            {brk?.own ? (
              <div className="space-y-1.5">
                <Label htmlFor="sf-designer-tab-name" className="text-xs">{L("fdTabName")}</Label>
                <Input id="sf-designer-tab-name" value={brk.label ?? ""} onChange={(e) => renameBreak(brk.id, e.target.value)} />
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">{brk?.label || L("fdUntitledTab")}</p>
                <Note icon={Lock}>{L("fdTabLocked")}</Note>
              </>
            )}
            {brk && !brk.native && (
              <Button type="button" size="sm" variant="outline" className="w-full gap-1.5 text-destructive"
                onClick={() => { edit(removeTab(items, selection.index)); setActiveTab(Math.max(0, selection.index - 1)); setSelection({ kind: "none" }); }}>
                <Trash2 className="h-3.5 w-3.5" />{L("fdRemoveTab")}
              </Button>
            )}
          </div>
        </Panel>
      );
    }
    return <p className="p-8 text-center text-sm text-muted-foreground">{L("fdSelectHint")}</p>;
  })();

  return (
    <section className={cn("space-y-4", className)} aria-label={L("fdTitle")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold">{L("fdTitle")}</h2>
          <p className="text-sm text-muted-foreground">{L("fdDescription")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <Badge variant="warning">{L("fdUnsaved")}</Badge>}
          {saved && !dirty && <Badge variant="success">{L("fdSaved")}</Badge>}
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setSelection({ kind: "deploy", where: { tab: tabIndex, section: tab.sections.length - 1 } })}>
            <Layers className="h-4 w-4" />{L("fdDeploySet")}
          </Button>
          {!onPendingChange && <Button type="button" size="sm" variant="outline" disabled={!dirty || saving} onClick={() => void saveHere()}>{L("fdSave")}</Button>}
        </div>
      </div>

      {wizard && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
          <div className="space-y-0.5">
            <Label htmlFor="sf-designer-wizard" className="text-xs">{L("fdWizard")}</Label>
            <p id="sf-designer-wizard-hint" className="text-[11px] text-muted-foreground">{L("fdWizardHint")}</p>
          </div>
          <Switch id="sf-designer-wizard" aria-describedby="sf-designer-wizard-hint" checked={wizard.on}
            onCheckedChange={(on) => { Promise.resolve(wizard.onChange(on)).catch((e) => setError(errorText(e))); }} />
        </div>
      )}
      {state.notice && <p className="text-sm text-muted-foreground">{state.notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          {showTabs && (
            <div className="rounded-xl border border-border bg-card p-2.5">
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5" role="tablist">
                {tabs.map((x, ti) => (
                  <button key={x.breakItem?.id ?? `tab-${ti}`} type="button" role="tab" aria-selected={ti === tabIndex}
                    onDragOver={allowDrop}
                    onDrop={drop({ tab: ti, section: x.sections.length - 1, column: x.sections[x.sections.length - 1].columns.length - 1 })}
                    onClick={() => { setActiveTab(ti); setSelection({ kind: "tab", index: ti }); }}
                    className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                      ti === tabIndex ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                    {wizard?.on ? `${L("fdStep")} ${ti + 1} · ` : ""}{x.breakItem?.label || L("fdUntitledTab")}
                    {x.breakItem?.native && <Lock className="h-3 w-3 opacity-60" />}
                  </button>
                ))}
                {adapter.makeTab && (
                  <button type="button" onClick={addTab}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs text-primary">
                    <Plus className="h-3 w-3" />{wizard?.on ? L("fdAddStep") : L("fdAddTab")}
                  </button>
                )}
              </div>
            </div>
          )}

          {tab.sections.map((section, si) => {
            const brk = section.breakItem;
            const selected = !!brk && selection.kind === "section" && selection.id === brk.id;
            return (
              <div key={brk?.id ?? `section-${si}`} className={cn("overflow-hidden rounded-xl border bg-card/60", selected ? "border-primary ring-1 ring-primary/30" : "border-border")}>
                {brk && (
                  <button type="button" onClick={() => setSelection({ kind: "section", id: brk.id })} aria-label={`${L("fdSection")}: ${brk.label || L("fdUntitledSection")}`}
                    className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-3 py-2 text-start">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{brk.label || <span className="italic text-muted-foreground/70">{L("fdUntitledSection")}</span>}</span>
                    {brk.native && <Lock className="h-3 w-3 text-muted-foreground/70" />}
                    {brk.source && <Badge variant="brand">{brk.source}</Badge>}
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground rtl:rotate-90" />
                  </button>
                )}
                <div className="grid gap-3 p-3" style={{ gridTemplateColumns: `repeat(${section.columns.length}, minmax(0, 1fr))` }}>
                  {section.columns.map((column, ci) => {
                    const slot: DropSlot = { tab: tabIndex, section: si, column: ci };
                    return (
                      <div key={column.breakItem?.id ?? `column-${ci}`} className="min-w-0 space-y-2">
                        {column.fields.map((field) => (
                          <FieldCard key={field.id} field={field} L={L} typeLabel={typeLabel(field.definition?.type ?? field.fieldtype)}
                            selected={selection.kind === "field" && selection.id === field.id}
                            onSelect={() => setSelection({ kind: "field", id: field.id })}
                            onDragStart={() => { dragging.current = field.id; }}
                            onDragOver={allowDrop}
                            onDrop={drop({ ...slot, before: field.id })}
                            onStep={(d) => edit(stepItem(items, field.id, d))} />
                        ))}
                        <div onDragOver={allowDrop} onDrop={drop(slot)}
                          className="rounded-lg border border-dashed border-border/60 py-2 text-center text-[11px] text-muted-foreground/80">
                          {registry ? (
                            <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => setSelection({ kind: "add", slot })}>
                              <Plus className="h-3 w-3" />{L("fdAddField")}
                            </button>
                          ) : L("fdEmptyColumn")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {adapter.makeSection && (
            <button type="button" onClick={addSection}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-primary hover:bg-muted/40">
              <Plus className="h-4 w-4" />{L("fdAddSection")}
            </button>
          )}
        </div>
        <aside className="self-start lg:sticky lg:top-4" aria-label={L("fdProperties")}>
          <div className="rounded-xl border border-border bg-card">{panel}</div>
        </aside>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && answer(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "empty" ? L("fdConfirmEmptyTitle") : L("fdConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.kind === "empty" ? L("fdConfirmEmptyBody") : L("fdConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.kind === "removal" && (
            <ul className="space-y-1 text-sm">
              {confirm.removals.map((r) => <li key={r.id}>{r.label}: {r.rowsWithData} {L("fdRecords")}</li>)}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => answer(false)}>{L("fdCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => answer(true)}>{L("fdConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Panel({ title, onClose, closeLabel, action, children }: { title: React.ReactNode; onClose: () => void; closeLabel: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1 text-sm font-semibold">{title}</div>
        {action}
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={closeLabel} onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function Note({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <p className="inline-flex items-start gap-1.5 text-[11px] text-muted-foreground"><Icon className="mt-0.5 h-3 w-3 shrink-0" />{children}</p>;
}

function FieldCard({ field, L, typeLabel, selected, onSelect, onDragStart, onDragOver, onDrop, onStep }: {
  field: DesignerItem; L: (key: Key) => string; typeLabel: string; selected: boolean; onSelect: () => void;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
  onStep: (direction: -1 | 1) => void;
}) {
  const movable = canMove(field);
  const note = field.native ? (field.movable ? L("fdShared") : L("fdLocked")) : undefined;
  const label = field.label || (field.definition ? L("fdUntitledField") : field.id);
  const Icon = iconOf(field.definition?.type ?? field.fieldtype);
  return (
    <div onDragOver={onDragOver} onDrop={onDrop} title={note} data-field={field.id}
      className={cn("group relative min-w-0 rounded-lg border bg-card p-2.5 transition-colors", selected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/40")}>
      <div className="flex items-start gap-2">
        {movable ? (
          <span draggable role="button" tabIndex={0} aria-label={`${L("fdReorder")}: ${label}`} className="mt-0.5 cursor-grab text-muted-foreground/60 hover:text-foreground"
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", field.id); onDragStart(); }}
            onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); onStep(-1); } if (e.key === "ArrowDown") { e.preventDefault(); onStep(1); } }}>
            <GripVertical className="h-4 w-4" />
          </span>
        ) : <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-label={note} />}
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-start" aria-label={`${L("fdEditField")}: ${label}`}>
          <span className="flex items-center gap-1.5 text-sm">
            <span className={cn("truncate", !field.label && field.definition && "italic text-muted-foreground")}>{label}</span>
            {field.definition?.required && <span className="text-destructive">*</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3 w-3" />{typeLabel}</span>
        </button>
        {field.native && field.movable && <Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-label={L("fdShared")} />}
        {field.source && <Badge variant="brand" className="shrink-0">{field.source}</Badge>}
        {movable && (
          <span className="flex flex-col opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button type="button" size="icon" variant="ghost" className="h-5 w-5" aria-label={`${L("fdMoveUp")}: ${label}`} onClick={() => onStep(-1)}><ArrowUp className="h-3 w-3" /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-5 w-5" aria-label={`${L("fdMoveDown")}: ${label}`} onClick={() => onStep(1)}><ArrowDown className="h-3 w-3" /></Button>
          </span>
        )}
      </div>
    </div>
  );
}

function DeploySetPanel({ adapter, L, present, canSection, onAdd }: {
  adapter: FieldDesignerAdapter; L: (key: Key) => string; present: Set<string>; canSection: boolean;
  onAdd: (set: DesignerFieldSet, picked: DesignerSetField[], asSection: boolean) => void;
}) {
  const { language } = useLocale();
  const [sets, setSets] = React.useState<DesignerFieldSet[] | null>(null);
  const [set, setSet] = React.useState<DesignerFieldSet | null>(null);
  const [fields, setFields] = React.useState<DesignerSetField[] | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [asSection, setAsSection] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { adapter.listFieldSets().then(setSets, (e) => setError(errorText(e))); }, [adapter]);
  React.useEffect(() => {
    if (!set) return;
    setFields(null);
    adapter.fieldsOf(set.name).then((list) => {
      const free = list.filter((f) => !present.has(f.id));
      setFields(free);
      setPicked(new Set(free.map((f) => f.id)));
    }, (e) => setError(errorText(e)));
  }, [set, adapter]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!sets) return <Skeleton className="h-24 rounded-md" />;
  if (!set) {
    return sets.length === 0 ? <p className="text-sm text-muted-foreground">{L("fdNoSets")}</p> : (
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">{L("fdChooseSet")}</p>
        {sets.map((s) => (
          <button key={s.name} type="button" onClick={() => setSet(s)}
            className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card p-3 text-start transition-colors hover:border-primary/50">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Layers className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{loc(s.label, language)}</span>
              {s.description && <span className="block truncate text-[11px] text-muted-foreground">{s.description}</span>}
            </span>
            {s.fieldCount !== undefined && <Badge variant="brand" className="shrink-0">{s.fieldCount}</Badge>}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <button type="button" className="text-xs text-primary" onClick={() => { setSet(null); setFields(null); }}>← {L("fdOtherSet")}</button>
      <p className="text-sm font-medium">{loc(set.label, language)}</p>
      {!fields && <Skeleton className="h-24 rounded-md" />}
      {fields && fields.length === 0 && <p className="text-sm text-muted-foreground">{L("fdNoFieldsLeft")}</p>}
      {fields && fields.length > 0 && (
        <ul className="max-h-72 space-y-1.5 overflow-auto">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <Checkbox id={`sf-designer-f-${f.id}`} checked={picked.has(f.id)} onCheckedChange={() => toggle(f.id)} />
              <Label htmlFor={`sf-designer-f-${f.id}`} className="font-normal">{loc(f.label, language)}</Label>
              {f.fieldtype && <span className="text-xs text-muted-foreground">{f.fieldtype}</span>}
            </li>
          ))}
        </ul>
      )}
      {canSection && fields && fields.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox id="sf-designer-as-section" checked={asSection} onCheckedChange={(v) => setAsSection(v === true)} />
          <Label htmlFor="sf-designer-as-section" className="font-normal">{L("fdAsSection")}</Label>
        </div>
      )}
      <Button type="button" size="sm" className="w-full" disabled={!fields || picked.size === 0}
        onClick={() => fields && onAdd(set, fields.filter((f) => picked.has(f.id)), canSection && asSection)}>
        {L("fdAddToForm")}
      </Button>
    </div>
  );
}
