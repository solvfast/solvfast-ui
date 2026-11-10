import * as React from "react";
import { ArrowDown, ArrowUp, GripVertical, Lock, Plus, X } from "lucide-react";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Switch } from "../primitives/switch";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Skeleton } from "../primitives/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../primitives/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../primitives/dialog";
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

/** What the designer shows: the form's items in order, or why it cannot be designed here. */
export interface DesignerState {
  items: DesignerItem[];
  /** Why this form cannot be designed (no right, a DocType that takes no fields): shown instead of the tools. */
  refusal?: string;
  /** A line shown above the form (e.g. the field set changed since it was saved). */
  notice?: string;
}
export interface DesignerFieldSet { name: string; label: Localized }
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
  /** Write the form as arranged; resolves to the form as the server has it now. */
  save(items: DesignerItem[]): Promise<DesignerState>;
  /** How many records hold a value in fields about to leave the form (asked before saving a removal). */
  removalImpact?(ids: string[]): Promise<DesignerRemoval[]>;
}

type Key = keyof typeof designerEn;

export interface FieldDesignerProps {
  adapter: FieldDesignerAdapter;
  /** Replace any string (keys of the `fd…` message block). */
  labels?: Partial<Record<Key, Localized>>;
  onSaved?: (state: DesignerState) => void;
  /** Wizard mode: the form's tabs are a new record's ordered steps. Shown as a switch; saved by the host. */
  wizard?: { on: boolean; onChange: (on: boolean) => void | Promise<void> };
  className?: string;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/<[^>]+>/g, "");
const signature = (items: DesignerItem[]) => items.map((i) => i.id).join("\u0001");
const canMove = (i: DesignerItem) => !i.native || !!i.movable;

/** The Form section of a type: its fields as tabs → sections → columns. Placement only — a field's own settings stay
 *  where the field set is edited. */
export function FieldDesigner({ adapter, labels, onSaved, wizard, className }: FieldDesignerProps) {
  const { t, language } = useLocale();
  const L = (key: Key) => loc(labels?.[key], language) || t(key);
  const [state, setState] = React.useState<DesignerState | null>(null);
  const [items, setItems] = React.useState<DesignerItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);
  const [adding, setAdding] = React.useState<{ tab: number; section: number } | null>(null);
  const [newTab, setNewTab] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<null | { kind: "removal"; removals: DesignerRemoval[] } | { kind: "empty" }>(null);
  const [wizardBusy, setWizardBusy] = React.useState(false);
  const toggleWizard = async (on: boolean) => {
    if (!wizard) return;
    setWizardBusy(true);
    try { await wizard.onChange(on); } catch (e) { setError(errorText(e)); } finally { setWizardBusy(false); }
  };
  const dragging = React.useRef<string | null>(null);

  const apply = (next: DesignerState) => { setState(next); setItems(next.items); setError(null); };
  React.useEffect(() => {
    let live = true;
    setState(null);
    adapter.load().then((s) => live && apply(s), (e) => live && setError(errorText(e)));
    return () => { live = false; };
  }, [adapter]);

  const edit = (next: DesignerItem[]) => { setItems(next); setSaved(false); };
  const tabs = toLayout(items);
  const tabIndex = Math.min(activeTab, tabs.length - 1);
  const dirty = !!state && signature(items) !== signature(state.items);

  const save = async (confirmed = false) => {
    if (!state) return;
    const now = new Set(items.map((i) => i.id));
    const loadedOwn = state.items.filter((i) => !i.native && i.kind === "field");
    const removed = loadedOwn.filter((i) => !now.has(i.id)).map((i) => i.id);
    if (!confirmed) {
      if (loadedOwn.length && !items.some((i) => !i.native && i.kind === "field")) { setConfirm({ kind: "empty" }); return; }
      if (removed.length && adapter.removalImpact) {
        try {
          const holding = (await adapter.removalImpact(removed)).filter((r) => r.rowsWithData > 0);
          if (holding.length) { setConfirm({ kind: "removal", removals: holding }); return; }
        } catch (e) { setError(errorText(e)); return; }
      }
    }
    setConfirm(null);
    setSaving(true);
    try {
      const next = await adapter.save(items);
      apply(next);
      setSaved(true);
      onSaved?.(next);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const drop = (slot: DropSlot) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragging.current;
    dragging.current = null;
    if (id) edit(moveItem(items, id, slot));
  };
  const allowDrop = (e: React.DragEvent) => { if (dragging.current) e.preventDefault(); };

  const addFields = (set: DesignerFieldSet, picked: DesignerSetField[], asSection: boolean) => {
    if (!adding) return;
    const source = loc(set.label, language);
    const fieldItems: DesignerItem[] = picked.map((f) => ({ id: f.id, kind: "field", label: loc(f.label, language), fieldtype: f.fieldtype, source }));
    let next = items;
    let slot: DropSlot;
    if (asSection && adapter.sectionOf) {
      const section = adapter.sectionOf(set.name, source);
      if (!next.some((i) => i.id === section.id)) next = insertSectionAfter(next, adding, section);
      const layout = toLayout(next);
      const si = layout[adding.tab].sections.findIndex((s) => s.breakItem?.id === section.id);
      slot = { tab: adding.tab, section: si, column: layout[adding.tab].sections[si].columns.length - 1 };
    } else {
      const layout = toLayout(next);
      slot = { ...adding, column: layout[adding.tab].sections[adding.section].columns.length - 1 };
    }
    for (const item of fieldItems) next = insertItem(next, item, slot);
    edit(next);
    setAdding(null);
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
  const showTabs = tabs.some((x) => x.breakItem) || !!wizard?.on;
  const lastSection = (ti: number) => ({ tab: ti, section: tabs[ti].sections.length - 1 });

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
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(lastSection(tabIndex))}>
            <Plus className="h-3.5 w-3.5" />{L("fdAddFields")}
          </Button>
          {adapter.makeTab && (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setNewTab("")}>
              <Plus className="h-3.5 w-3.5" />{L("fdAddTab")}
            </Button>
          )}
          <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>{L("fdSave")}</Button>
        </div>
      </div>

      {wizard && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="sf-designer-wizard" className="text-sm">{L("fdWizard")}</Label>
            <p id="sf-designer-wizard-hint" className="text-xs text-muted-foreground">{L("fdWizardHint")}</p>
          </div>
          <Switch id="sf-designer-wizard" aria-describedby="sf-designer-wizard-hint" checked={wizard.on} disabled={wizardBusy}
            onCheckedChange={(on) => void toggleWizard(on)} />
        </div>
      )}
      {state.notice && <p className="text-sm text-muted-foreground">{state.notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {showTabs && (
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {tabs.map((x, ti) => (
            <span key={x.breakItem?.id ?? `tab-${ti}`} className="inline-flex items-center"
              onDragOver={allowDrop}
              onDrop={drop({ tab: ti, section: x.sections.length - 1, column: x.sections[x.sections.length - 1].columns.length - 1 })}>
              <button type="button" role="tab" aria-selected={ti === tabIndex} onClick={() => setActiveTab(ti)}
                className={cn("rounded-full px-3 py-1 text-sm border transition-colors",
                  ti === tabIndex ? "bg-primary text-primary-foreground border-transparent" : "border-border hover:bg-accent")}>
                {wizard?.on ? `${L("fdStep")} ${ti + 1} · ` : ""}{x.breakItem?.label || L("fdUntitledTab")}
              </button>
              {x.breakItem && !x.breakItem.native && (
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label={`${L("fdRemoveTab")}: ${x.breakItem.label ?? ""}`}
                  onClick={() => { edit(removeTab(items, ti)); setActiveTab(Math.max(0, ti - 1)); }}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {tab.sections.map((section, si) => (
          <div key={section.breakItem?.id ?? `section-${si}`} className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {section.breakItem ? section.breakItem.label || L("fdUntitledSection") : ""}
                {section.breakItem?.source && <Badge variant="brand" className="ms-2">{section.breakItem.source}</Badge>}
              </h3>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setAdding({ tab: tabIndex, section: si })}>
                  <Plus className="h-3 w-3" />{L("fdAddHere")}
                </Button>
                {section.breakItem && !section.breakItem.native && (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                    aria-label={`${L("fdRemoveSection")}: ${section.breakItem.label ?? ""}`}
                    onClick={() => edit(removeSection(items, { tab: tabIndex, section: si }))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${section.columns.length}, minmax(0, 1fr))` }}>
              {section.columns.map((column, ci) => {
                const slot: DropSlot = { tab: tabIndex, section: si, column: ci };
                return (
                  <div key={column.breakItem?.id ?? `column-${ci}`} className="space-y-1.5 min-w-0">
                    {column.fields.map((field) => (
                      <FieldCard key={field.id} field={field} L={L}
                        onDragStart={() => { dragging.current = field.id; }}
                        onDragOver={allowDrop}
                        onDrop={drop({ ...slot, before: field.id })}
                        onStep={(d) => edit(stepItem(items, field.id, d))}
                        onRemove={() => edit(items.filter((i) => i.id !== field.id))} />
                    ))}
                    <div onDragOver={allowDrop} onDrop={drop(slot)}
                      className={cn("rounded-md border border-dashed border-border text-xs text-muted-foreground flex items-center justify-center",
                        column.fields.length ? "h-6" : "h-12")}>
                      {column.fields.length ? null : L("fdEmptyColumn")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AddFieldsDialog open={!!adding} onClose={() => setAdding(null)} adapter={adapter} L={L}
        present={new Set(items.map((i) => i.id))} canSection={!!adapter.sectionOf} onAdd={addFields} />

      <Dialog open={newTab !== null} onOpenChange={(open) => !open && setNewTab(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("fdAddTab")}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="sf-designer-tab">{L("fdTabName")}</Label>
            <Input id="sf-designer-tab" value={newTab ?? ""} onChange={(e) => setNewTab(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewTab(null)}>{L("fdCancel")}</Button>
            <Button type="button" disabled={!newTab?.trim()} onClick={() => {
              const item = adapter.makeTab!(newTab!.trim());
              if (!items.some((i) => i.id === item.id)) { edit(appendTab(items, item)); setActiveTab(tabs.length); }
              setNewTab(null);
            }}>{L("fdAdd")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "empty" ? L("fdConfirmEmptyTitle") : L("fdConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.kind === "empty" ? L("fdConfirmEmptyBody") : L("fdConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.kind === "removal" && (
            <ul className="text-sm space-y-1">
              {confirm.removals.map((r) => <li key={r.id}>{r.label}: {r.rowsWithData} {L("fdRecords")}</li>)}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{L("fdCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save(true)}>{L("fdConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function FieldCard({ field, L, onDragStart, onDragOver, onDrop, onStep, onRemove }: {
  field: DesignerItem; L: (key: Key) => string;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
  onStep: (direction: -1 | 1) => void; onRemove: () => void;
}) {
  const movable = canMove(field);
  const note = field.native ? (field.movable ? L("fdShared") : L("fdLocked")) : undefined;
  return (
    <div draggable={movable} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", field.id); onDragStart(); }}
      onDragOver={onDragOver} onDrop={onDrop} title={note} data-field={field.id}
      className={cn("flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm", movable && "cursor-grab")}>
      {movable ? <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={note} />}
      <span className="flex-1 min-w-0 truncate">{field.label || field.id}</span>
      {field.source && <Badge variant="brand" className="shrink-0">{field.source}</Badge>}
      {field.fieldtype && <span className="shrink-0 text-xs text-muted-foreground">{field.fieldtype}</span>}
      {movable && (
        <>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label={`${L("fdMoveUp")}: ${field.label ?? field.id}`} onClick={() => onStep(-1)}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label={`${L("fdMoveDown")}: ${field.label ?? field.id}`} onClick={() => onStep(1)}>
            <ArrowDown className="h-3 w-3" />
          </Button>
        </>
      )}
      {!field.native && (
        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label={`${L("fdRemove")}: ${field.label ?? field.id}`} onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function AddFieldsDialog({ open, onClose, adapter, L, present, canSection, onAdd }: {
  open: boolean; onClose: () => void; adapter: FieldDesignerAdapter; L: (key: Key) => string; present: Set<string>;
  canSection: boolean; onAdd: (set: DesignerFieldSet, picked: DesignerSetField[], asSection: boolean) => void;
}) {
  const { language } = useLocale();
  const [sets, setSets] = React.useState<DesignerFieldSet[] | null>(null);
  const [setName, setSetName] = React.useState("");
  const [fields, setFields] = React.useState<DesignerSetField[] | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [asSection, setAsSection] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSetName(""); setFields(null); setPicked(new Set()); setError(null); setAsSection(true);
    adapter.listFieldSets().then(setSets, (e) => setError(errorText(e)));
  }, [open, adapter]);
  React.useEffect(() => {
    if (!setName) return;
    setFields(null);
    adapter.fieldsOf(setName).then((list) => {
      const free = list.filter((f) => !present.has(f.id));
      setFields(free);
      setPicked(new Set(free.map((f) => f.id)));
    }, (e) => setError(errorText(e)));
  }, [setName, adapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = sets?.find((s) => s.name === setName);
  const toggle = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{L("fdAddFields")}</DialogTitle>
          <DialogDescription>{L("fdChooseSet")}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!sets ? <Skeleton className="h-10 rounded-md" /> : sets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L("fdNoSets")}</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sf-designer-set">{L("fdFieldSet")}</Label>
              <Select value={setName} onValueChange={setSetName}>
                <SelectTrigger id="sf-designer-set"><SelectValue placeholder={L("fdChooseSet")} /></SelectTrigger>
                <SelectContent>
                  {sets.map((s) => <SelectItem key={s.name} value={s.name}>{loc(s.label, language)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {setName && !fields && <Skeleton className="h-24 rounded-md" />}
            {fields && fields.length === 0 && <p className="text-sm text-muted-foreground">{L("fdNoFieldsLeft")}</p>}
            {fields && fields.length > 0 && (
              <ul className="max-h-64 overflow-auto space-y-1.5">
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
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{L("fdCancel")}</Button>
          <Button type="button" disabled={!set || !fields || picked.size === 0}
            onClick={() => set && fields && onAdd(set, fields.filter((f) => picked.has(f.id)), canSection && asSection)}>
            {L("fdAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
