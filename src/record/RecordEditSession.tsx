/**
 * RecordEditSession + RecordEditableCard — the record page's ONE editing pattern (the CRM's, ported from serve_fast's
 * components/record-detail/RecordEditSession.tsx, its @solvfast/ui-scope branches).
 *
 * Two models share the provider:
 *  - page-level Save (`pageSave` + `commit`) — many cards edit at once; none has its own Save; every change feeds ONE
 *    pending save: the "Not saved" pill (RecordNotSavedPill) and the toolbar Save (RecordSaveButton). Each card is a
 *    region `{ label, getPatch, reset }`; `saveAll()` collects the dirty regions' patches (a `false` refuses and
 *    focuses that region), merges them and calls `commit` once (one savedocs on Frappe data). Ctrl/Cmd+S saves.
 *  - single card (default) — one card edits at a time and saves itself (Cancel / Save in its footer).
 * Leaving while dirty (`guard(fn)`: a tab switch, Back, opening another record) asks first: Save and leave · Discard ·
 * Keep editing. The tab-close warning is native.
 *
 * Frappe-free and toast-free: the host gets `notify` (Saved / failed — e.g. its toast) and `onDirtyChange` (e.g. its
 * shell's navigation guard). Strings default to the ThemeProvider's language (`res*`); `labels` override them.
 */
import * as React from "react";
import { Pencil, Save as SaveIcon } from "lucide-react";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "../primitives/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../primitives/alert-dialog";
import { StatusBadge } from "./StatusBadge";

type IconType = React.ComponentType<{ className?: string }>;

interface CardReg { label: string; save: () => boolean; cancel: () => void }

/** A page-level editable region (page-Save model): contributes a patch to the one merged save. */
export interface RecordSaveRegion {
  label: string;
  /** This region's field patch; `false` refuses (the region shows its own errors). */
  getPatch: () => Record<string, unknown> | false;
  /** Revert this region's local edits. */
  reset: () => void;
  /** Scroll to / focus this region (the first refusal). */
  focus?: () => void;
}

export interface RecordEditSessionApi {
  isRTL: boolean;
  /** The record is closed: read-only except cards marked editable when closed. */
  closed: boolean;
  /** Any pending change (either model). */
  dirty: boolean;
  pageSave: boolean;
  saving: boolean;
  registerRegion: (cardId: string, reg: RecordSaveRegion) => void;
  unregisterRegion: (cardId: string) => void;
  setRegionDirty: (cardId: string, dirty: boolean) => void;
  isEditing: (cardId: string) => boolean;
  toggleEdit: (cardId: string, on: boolean) => void;
  /** Commit every dirty region as one save; false when a region refused or the save failed. */
  saveAll: () => Promise<boolean>;
  activeCardId: string | null;
  setDirty: (dirty: boolean) => void;
  requestEdit: (cardId: string, reg: CardReg) => void;
  release: (cardId: string) => void;
  /** Run an in-app navigation, asking first while there are unsaved changes. */
  guard: (fn: () => void) => void;
  /** Ask before `run` when dirty (e.g. the host shell's own navigation); true = the dialog took it. */
  prompt: (run: () => void) => boolean;
  labels: RecordEditSessionLabels;
}

export interface RecordEditSessionLabels {
  notSaved?: string; save?: string; saving?: string; saved?: string; saveFailed?: string; edit?: string; cancel?: string;
  unsavedTitlePage?: string; unsavedTitleCard?: string; unsavedBodyPage?: string;
  /** `{0}` = the card's label. */
  unsavedBodyCard?: string;
  saveAndLeave?: string; keepEditing?: string; stay?: string; discard?: string;
}

const Ctx = React.createContext<RecordEditSessionApi | null>(null);
/** The surrounding RecordEditSession (null outside one). */
export const useRecordEditSession = () => React.useContext(Ctx);

export interface RecordEditSessionProps {
  isRTL?: boolean;
  closed?: boolean;
  children: React.ReactNode;
  /** The page-level single-Save model (toolbar Save, no per-card Save). */
  pageSave?: boolean;
  /** Persist the merged patch of every dirty region in one write; true on success. A `false` means the commit showed
   *  its own error; a throw gets the generic "Couldn't save" notice. */
  commit?: (merged: Record<string, unknown>) => boolean | Promise<boolean>;
  /** After a successful save: the labels of the regions that changed (e.g. a History entry). */
  onSaved?: (changedLabels: string[]) => void;
  /** Feedback (e.g. the host's toast): "saved" after a save, "error" when the commit threw. */
  notify?: (kind: "saved" | "error", message: string) => void;
  /** Dirty changes (e.g. the host shell's navigation guard). */
  onDirtyChange?: (dirty: boolean) => void;
  labels?: RecordEditSessionLabels;
  /** Render the unsaved-changes prompt yourself (e.g. an app's own popup); default: the package's AlertDialog. */
  renderUnsavedDialog?: (d: RecordUnsavedDialogProps) => React.ReactNode;
}

/** What `renderUnsavedDialog` gets: the prompt's text and its three answers. */
export interface RecordUnsavedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  isRTL: boolean;
  /** "Save and leave" (page model) / "Save" (single card). */
  saveLabel: string;
  /** "Keep editing" / "Stay". */
  stayLabel: string;
  discardLabel: string;
  onSave: () => void;
  onStay: () => void;
  onDiscard: () => void;
}

const fill = (s: string, v: string) => s.replace("{0}", v);

export function RecordEditSession({ isRTL: isRTLProp, closed = false, children, pageSave = false, commit, onSaved, notify, onDirtyChange, labels, renderUnsavedDialog }: RecordEditSessionProps) {
  const { t, isRTL: providerRTL } = useLocale();
  const isRTL = isRTLProp ?? providerRTL;
  const L: Required<RecordEditSessionLabels> = {
    notSaved: labels?.notSaved ?? t("resNotSaved"), save: labels?.save ?? t("resSave"), saving: labels?.saving ?? t("resSaving"),
    saved: labels?.saved ?? t("resSaved"), saveFailed: labels?.saveFailed ?? t("resSaveFailed"), edit: labels?.edit ?? t("resEdit"),
    cancel: labels?.cancel ?? t("resCancel"), unsavedTitlePage: labels?.unsavedTitlePage ?? t("resUnsavedTitlePage"),
    unsavedTitleCard: labels?.unsavedTitleCard ?? t("resUnsavedTitleCard"), unsavedBodyPage: labels?.unsavedBodyPage ?? t("resUnsavedBodyPage"),
    unsavedBodyCard: labels?.unsavedBodyCard ?? t("resUnsavedBodyCard"), saveAndLeave: labels?.saveAndLeave ?? t("resSaveAndLeave"),
    keepEditing: labels?.keepEditing ?? t("resKeepEditing"), stay: labels?.stay ?? t("resStay"), discard: labels?.discard ?? t("resDiscard"),
  };
  // single-card model
  const [activeCardId, setActiveCardId] = React.useState<string | null>(null);
  const [legacyDirty, setLegacyDirty] = React.useState(false);
  const regRef = React.useRef<CardReg | null>(null);
  // page-level registry
  const regions = React.useRef(new Map<string, RecordSaveRegion>());
  const [dirtyIds, setDirtyIds] = React.useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [pending, setPending] = React.useState<null | { label: string; run: () => void }>(null);

  const dirty = pageSave ? dirtyIds.size > 0 : legacyDirty;
  const onDirtyRef = React.useRef(onDirtyChange); onDirtyRef.current = onDirtyChange;
  React.useEffect(() => { onDirtyRef.current?.(dirty); }, [dirty]);
  React.useEffect(() => () => onDirtyRef.current?.(false), []);

  const release = React.useCallback((cardId: string) => {
    setActiveCardId((cur) => (cur === cardId ? null : cur));
    regRef.current = null;
    setLegacyDirty(false);
  }, []);
  const requestEdit = React.useCallback((cardId: string, reg: CardReg) => {
    if (activeCardId && activeCardId !== cardId && legacyDirty) {
      setPending({ label: regRef.current?.label ?? "", run: () => { regRef.current = reg; setActiveCardId(cardId); setLegacyDirty(false); } });
      return;
    }
    regRef.current = reg;
    setActiveCardId(cardId);
    setLegacyDirty(false);
  }, [activeCardId, legacyDirty]);

  const registerRegion = React.useCallback((cardId: string, reg: RecordSaveRegion) => { regions.current.set(cardId, reg); }, []);
  const unregisterRegion = React.useCallback((cardId: string) => {
    regions.current.delete(cardId);
    setDirtyIds((s) => { if (!s.has(cardId)) return s; const n = new Set(s); n.delete(cardId); return n; });
    setEditingIds((s) => { if (!s.has(cardId)) return s; const n = new Set(s); n.delete(cardId); return n; });
  }, []);
  const setRegionDirty = React.useCallback((cardId: string, d: boolean) => {
    setDirtyIds((s) => { const has = s.has(cardId); if (d === has) return s; const n = new Set(s); if (d) n.add(cardId); else n.delete(cardId); return n; });
  }, []);
  const isEditing = React.useCallback((cardId: string) => editingIds.has(cardId), [editingIds]);
  const toggleEdit = React.useCallback((cardId: string, on: boolean) => {
    setEditingIds((s) => { const has = s.has(cardId); if (on === has) return s; const n = new Set(s); if (on) n.add(cardId); else n.delete(cardId); return n; });
    if (!on) { regions.current.get(cardId)?.reset(); setRegionDirty(cardId, false); }
  }, [setRegionDirty]);

  const saveAll = React.useCallback(async (): Promise<boolean> => {
    const ids = [...regions.current.keys()].filter((id) => dirtyIds.has(id));
    if (ids.length === 0) return true;
    const merged: Record<string, unknown> = {};
    for (const id of ids) {
      const reg = regions.current.get(id)!;
      const patch = reg.getPatch();
      if (patch === false) { reg.focus?.(); return false; }
      Object.assign(merged, patch);
    }
    setSaving(true);
    let ok = false, threw = false;
    try { ok = Object.keys(merged).length === 0 ? true : !!(await commit?.(merged)); } catch { ok = false; threw = true; }
    setSaving(false);
    if (ok) {
      const changed = ids.map((id) => regions.current.get(id)!.label);
      ids.forEach((id) => regions.current.get(id)!.reset());
      setDirtyIds(new Set());
      setEditingIds(new Set());
      onSaved?.(changed);
      notify?.("saved", L.saved);
      return true;
    }
    if (threw) notify?.("error", L.saveFailed);
    return false;
  }, [dirtyIds, commit, onSaved, notify, L.saved, L.saveFailed]);

  const guard = React.useCallback((fn: () => void) => {
    if (dirty) { setPending({ label: regRef.current?.label ?? "", run: fn }); return; }
    fn();
  }, [dirty]);
  const dirtyRef = React.useRef(dirty); dirtyRef.current = dirty;
  const prompt = React.useCallback((run: () => void) => {
    if (!dirtyRef.current) return false;
    setPending({ label: regRef.current?.label ?? "", run });
    return true;
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (pageSave && dirty) { e.preventDefault(); void saveAll(); }
        else if (!pageSave && activeCardId) { e.preventDefault(); regRef.current?.save(); }
      } else if (!pageSave && e.key === "Escape" && activeCardId && !legacyDirty) {
        regRef.current?.cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageSave, dirty, activeCardId, legacyDirty, saveAll]);

  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const discard = () => {
    if (pageSave) { regions.current.forEach((r) => r.reset()); setDirtyIds(new Set()); setEditingIds(new Set()); }
    else { regRef.current?.cancel(); release(activeCardId ?? ""); }
    const p = pending; setPending(null); p?.run();
  };
  const saveThenContinue = async () => {
    const ok = pageSave ? await saveAll() : regRef.current?.save() !== false;
    if (!ok) return;
    const p = pending; setPending(null); p?.run();
  };

  const api: RecordEditSessionApi = {
    isRTL, closed, dirty, pageSave, saving, registerRegion, unregisterRegion, setRegionDirty, isEditing, toggleEdit, saveAll,
    activeCardId, setDirty: setLegacyDirty, requestEdit, release, guard, prompt, labels: L,
  };

  const title = pageSave ? L.unsavedTitlePage : L.unsavedTitleCard;
  const body = pageSave ? L.unsavedBodyPage : fill(L.unsavedBodyCard, pending?.label ?? "");
  const stayLabel = pageSave ? L.keepEditing : L.stay;
  const saveLabel = pageSave ? L.saveAndLeave : L.save;
  return (
    <Ctx.Provider value={api}>
      {renderUnsavedDialog ? renderUnsavedDialog({
        open: !!pending, onOpenChange: (o) => { if (!o) setPending(null); }, title, body, isRTL, saveLabel, stayLabel, discardLabel: L.discard,
        onSave: () => void saveThenContinue(), onStay: () => setPending(null), onDiscard: discard,
      }) : (
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"} data-record-unsaved-dialog="">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={discard}>{L.discard}</Button>
            <AlertDialogCancel>{stayLabel}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void saveThenContinue(); }}>{saveLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
      {children}
    </Ctx.Provider>
  );
}

/** The header "Not saved" pill (warning tone) while the session is dirty. */
export function RecordNotSavedPill({ label }: { label?: string }) {
  const s = useRecordEditSession();
  if (!s?.dirty) return null;
  return <StatusBadge tone="warning" label={label ?? s.labels.notSaved ?? ""} />;
}

/** The toolbar Save of the page-level model (rendered only when the page opted in). */
export function RecordSaveButton({ icon: Icon = SaveIcon, label, savingLabel }: { icon?: IconType; label?: string; savingLabel?: string }) {
  const s = useRecordEditSession();
  if (!s?.pageSave) return null;
  return (
    <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={!s.dirty || s.saving} onClick={() => void s.saveAll()}>
      <Icon className="h-3.5 w-3.5" />
      {s.saving ? (savingLabel ?? s.labels.saving) : (label ?? s.labels.save)}
    </Button>
  );
}

export interface RecordEditableCardProps {
  cardId: string;
  /** The card's title (also its name in the unsaved dialog). */
  label: string;
  /** Keeps its Edit button on a closed record. */
  editableWhenClosed?: boolean;
  /** The read view. */
  children: React.ReactNode;
  /** The edit view; `markDirty` turns on the "Not saved" pill and the Save. */
  renderEdit: (ctx: { markDirty: () => void }) => React.ReactNode;
  /** Single-card model: persist; `false` refuses. */
  onSave: () => boolean | void;
  /** Discard local edits. */
  onCancel?: () => void;
  /** Page-Save model: this card's patch for the one save; `false` refuses. */
  getPatch?: () => Record<string, unknown> | false;
  /** Header end, before Edit. */
  headerExtra?: React.ReactNode;
  /** Header start (e.g. a tinted icon square). */
  icon?: React.ReactNode;
  /** No Edit button at all. */
  readOnly?: boolean;
  /** The Edit glyph (default Pencil). */
  editIcon?: IconType;
}

/** An About card whose fields turn into inputs in place: header (icon, title, Edit), body, and Cancel (+ Save in the
 *  single-card model) while editing. */
export function RecordEditableCard({ cardId, label, editableWhenClosed, children, renderEdit, onSave, onCancel, getPatch, headerExtra, icon, readOnly, editIcon: EditIcon = Pencil }: RecordEditableCardProps) {
  const s = useRecordEditSession();
  const pageSave = !!s?.pageSave;
  const ref = React.useRef<HTMLElement | null>(null);
  const legacyEditing = s?.activeCardId === cardId;
  const legacyDirty = legacyEditing && !!s?.dirty;
  const lockedByClosed = !!readOnly || (!!s?.closed && !editableWhenClosed);
  const pageEditing = pageSave && !!s?.isEditing(cardId);
  const getPatchRef = React.useRef(getPatch); getPatchRef.current = getPatch;
  const onCancelRef = React.useRef(onCancel); onCancelRef.current = onCancel;
  React.useEffect(() => {
    if (!pageSave || !s || lockedByClosed) return;
    s.registerRegion(cardId, {
      label,
      getPatch: () => (getPatchRef.current ? getPatchRef.current() : {}),
      reset: () => onCancelRef.current?.(),
      focus: () => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    });
    return () => s.unregisterRegion(cardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSave, cardId, label, lockedByClosed]);
  const editing = pageSave ? pageEditing : legacyEditing;
  const markDirty = () => { if (pageSave) s?.setRegionDirty(cardId, true); else s?.setDirty(true); };
  const doSave = () => { const r = onSave(); if (r === false) return false; s?.release(cardId); return true; };
  const doCancel = () => { onCancel?.(); if (pageSave) s?.toggleEdit(cardId, false); else s?.release(cardId); };
  const begin = () => { if (pageSave) s?.toggleEdit(cardId, true); else s?.requestEdit(cardId, { label, save: doSave, cancel: doCancel }); };
  const L = s?.labels;
  return (
    <section ref={ref} className="rounded-xl border border-border bg-card" data-record-card={cardId} data-editing={editing || undefined}>
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <div className="flex-1" />
        {headerExtra}
        {!editing && !lockedByClosed && (
          <Button type="button" size="sm" variant="ghost" onClick={begin} className="h-7 gap-1 px-2 text-xs">
            <EditIcon className="h-3.5 w-3.5" />{L?.edit}
          </Button>
        )}
      </header>
      <div className="p-4">{editing ? renderEdit({ markDirty }) : children}</div>
      {editing && (
        <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={doCancel}>{L?.cancel}</Button>
          {!pageSave && <Button size="sm" className="h-8 text-xs" disabled={!legacyDirty} onClick={doSave}>{L?.save}</Button>}
        </footer>
      )}
    </section>
  );
}
