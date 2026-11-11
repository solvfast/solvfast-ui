/**
 * SayrRecordPage — a Sayr record opened as a page: a header card (title, name, status, who created it and when), the
 * record's form with its own tabs as a full-width bar, and a side rail. The rail shows the Lifecycle card (always first),
 * then Assignment, SLA, Playbook, Tasks, Pinned Notes and Attachments, which the viewer can hide per DocType ("Customize
 * sections", kept in this browser). A card with nothing to show says so ("No SLA deployed") instead of disappearing.
 *
 * Reads Sayr's `record_page` (header, lifecycle, SLA, the assign comment, the record's ToDos) in one call; assignment,
 * comments and attachments are Frappe's own (docinfo). A next action runs Sayr's `execute_transition`, then the form
 * is read again.
 */
import * as React from "react";
import {
  ArrowLeft, ArrowRight, Calendar, CheckSquare, FileText, GitBranch, ListChecks, Paperclip, ShieldCheck,
  StickyNote, Timer, User,
} from "lucide-react";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/relative-time";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import { Card } from "../primitives/card";
import { Checkbox } from "../primitives/checkbox";
import { Skeleton } from "../primitives/skeleton";
import { LifecycleRail, type LifecycleRailNext } from "../record/LifecycleRail";
import { fmt, initials } from "../record/format";
import { RecordHeaderCard } from "../record/RecordHeaderCard";
import { htmlToText } from "../record/sanitize";
import { useLocale } from "../theme/ThemeProvider";
import type { FrappeDoc } from "../frappe/contract";
import { FrappeForm, type FrappeFormProps } from "../frappe/form/FrappeForm";
import { useFrappeApi, useFrappeSettings } from "../frappe/FrappeProvider";
import { useDoc, useMetaBundle, usePermissions, useRefreshDoc } from "../frappe/hooks";
import { FrappeAssignTo } from "../frappe/record/FrappeAssignTo";
import { FrappeAttachments } from "../frappe/record/FrappeAttachments";
import { FrappeComments } from "../frappe/record/FrappeComments";
import { stateEntries } from "../frappe/record/stateHistory";
import { parseFrappeTime } from "../frappe/record/timeline";
import {
  OPEN_CHECKLIST_METHOD, RECORD_PAGE_METHOD, TICK_STEP_METHOD, TRANSITION_METHOD, defaultLifecycleHref,
  type ChecklistData, type RecordPageData, type SlaTargetClock,
} from "./recordPage";
import {
  CustomizeSections, Empty, PHASE_VARIANT, RECORD_RAIL_CARDS, RailCard, dateTime, duration, railStorageKeyOf, useHiddenCards,
  type RecordRailCard, type T,
} from "./rail";

const TASKS_BEFORE_SCROLL = 5;

export interface SayrRecordPageProps extends Omit<FrappeFormProps, "doctype" | "name" | "header" | "toolbarStart" | "tabBar"> {
  doctype: string;
  name: string;
  onBack?: () => void;
  backLabel?: string;
  /** The record's type, shown as a chip in the header (e.g. "Bug"). */
  typeLabel?: string;
  /** Where "View full lifecycle" opens (a new tab). Default: Sayr Studio's lifecycle builder. */
  lifecycleHref?: (lifecycle: string) => string;
  /** Where the hidden cards are kept (localStorage). Default `sf-record-rail:<doctype>`. */
  railStorageKey?: string;
}

/** One Sayr method's answer, read again when `key` changes or on `reload`. */
export function useSayrCall<D>(method: string, args: Record<string, unknown>, key: string, enabled = true) {
  const api = useFrappeApi();
  const [state, setState] = React.useState<{ data?: D; error?: Error; pending: boolean }>({ pending: enabled });
  const latest = React.useRef(0);
  const reload = React.useCallback(async () => {
    const run = ++latest.current;
    setState((s) => ({ ...s, pending: s.data === undefined }));
    try {
      const data = (await api.call(method, args)).message as D;
      if (run === latest.current) setState({ data, pending: false });
    } catch (error) {
      if (run === latest.current) setState((s) => ({ ...s, error: error as Error, pending: false }));
    }
  }, [api, method, key]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (enabled) void reload(); }, [reload, enabled]);
  const set = React.useCallback((data: D) => setState({ data, pending: false }), []);
  return { ...state, reload, set };
}

export function SayrRecordPage({
  doctype, name, onBack, backLabel, typeLabel, lifecycleHref = defaultLifecycleHref, railStorageKey, onDirtyChange, onSaved, ...form
}: SayrRecordPageProps) {
  const { t, language, isRTL } = useLocale();
  const api = useFrappeApi();
  const refreshDoc = useRefreshDoc();
  const { session } = useFrappeSettings();
  const meta = useMetaBundle(doctype);
  const loaded = useDoc(doctype, name);
  const doc = loaded.data?.doc as FrappeDoc | undefined;
  const docinfo = loaded.data?.docinfo;
  const permissions = usePermissions(meta.data, doc, docinfo);
  const canWrite = !!doc && permissions.can("write");
  const [dirty, setDirty] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);

  const page = useSayrCall<RecordPageData>(RECORD_PAGE_METHOD, { doctype, name }, `${doctype}\u0001${name}`);
  const refresh = page.reload;
  // A save, a toolbar workflow action or a transition changes `modified`: the header and cards follow.
  const seenModified = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    const modified = doc?.modified as string | undefined;
    if (!modified) return;
    if (seenModified.current && seenModified.current !== modified) void page.reload();
    seenModified.current = modified;
  }, [doc?.modified]); // eslint-disable-line react-hooks/exhaustive-deps
  const [moving, setMoving] = React.useState(false);
  const [moveNote, setMoveNote] = React.useState<{ text: string; error: boolean } | null>(null);

  const runTransition = async (next: LifecycleRailNext) => {
    setMoving(true);
    setMoveNote(null);
    try {
      await api.call(TRANSITION_METHOD, { doctype, name, transition_key: next.id });
      const lc = page.data?.lifecycle;
      const to = lc?.states.find((s) => s.state_key === lc.actions.find((a) => a.transition_key === next.id)?.to_state);
      await refreshDoc(doctype, name);
      await page.reload();
      // The form keeps the copy it last saved; a new key reads the moved record instead.
      setFormKey((k) => k + 1);
      setMoveNote({ text: fmt(t("rpMoved"), (isRTL && to?.name_ar) || to?.name_en || next.label), error: false });
    } catch (e) {
      setMoveNote({ text: (e as Error).message, error: true });
    } finally {
      setMoving(false);
    }
  };

  const { hidden, toggle } = useHiddenCards(railStorageKey ?? railStorageKeyOf(doctype));

  const data = page.data;
  const lc = data?.lifecycle ?? null;
  const stateLabel = (s?: { name_en: string; name_ar: string | null }) => (s ? (isRTL && s.name_ar) || s.name_en : "");
  const current = lc?.states.find((s) => s.is_current);
  const titleField = meta.data?.meta.title_field;
  const title = doc ? htmlToText(String((titleField && doc[titleField]) || "")) || doc.name : name;

  const header = (
    <RecordHeaderCard
      title={title}
      name={name}
      avatar={initials(title) || <FileText className="h-6 w-6" />}
      status={current ? { label: stateLabel(current), variant: PHASE_VARIANT[current.phase as keyof typeof PHASE_VARIANT] ?? "outline", key: current.state_key } : undefined}
      facts={data ? [
        { icon: User, text: data.header.owner_name || data.header.owner },
        { icon: Calendar, text: fmt(t("rpCreatedOn"), dateTime(parseFrappeTime(data.header.creation), language)), title: dateTime(parseFrappeTime(data.header.creation), language) },
      ] : undefined}
      chips={typeLabel ? <Badge variant="brand">{typeLabel}</Badge> : undefined}
    >
      {data ? null : <Skeleton className="h-4 w-48" />}
    </RecordHeaderCard>
  );

  const back = onBack ? (
    <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onBack}>
      {isRTL ? <ArrowRight className="h-4 w-4" aria-hidden /> : <ArrowLeft className="h-4 w-4" aria-hidden />}{backLabel ?? t("rpBack")}
    </Button>
  ) : null;

  const lifecycleCard = (
    <RailCard id="lifecycle" icon={GitBranch} title={lc?.title ? `${t("rpLifecycle")} · ${lc.title}` : t("rpLifecycle")}>
      {page.pending ? <Skeleton className="h-24" /> : !lc ? (
        <Empty>{data?.lifecycle_deployed ? t("rpNotUnderLifecycle") : t("rpNoLifecycle")}</Empty>
      ) : (
        <LifecycleRail
          path={lifecyclePath(lc, doc, docinfo, isRTL, language)}
          next={lc.actions.map((a) => ({
            id: a.transition_key,
            label: (isRTL && a.action_ar) || a.action_en,
            back: false,
            disabled: dirty || moving,
            disabledReason: dirty ? t("rpSaveFirst") : undefined,
          }))}
          ended={lc.actions.length === 0}
          // The server lists only actions this user may take; a state's edit lock does not apply to a transition.
          onSelectNext={(n) => void runTransition(n)}
          onViewAll={() => window.open(lifecycleHref(lc.lifecycle), "_blank", "noopener")}
        />
      )}
      {moveNote ? <p role={moveNote.error ? "alert" : "status"} className={cn("text-xs", moveNote.error ? "text-destructive" : "text-muted-foreground")}>{moveNote.text}</p> : null}
    </RailCard>
  );

  const cards: Record<RecordRailCard, React.ReactNode> = {
    assignment: (
      <RailCard id="assignment" icon={ShieldCheck} title={t("rpAssignment")}>
        {doc && session?.user ? (
          <FrappeAssignTo layout="sidebar" doc={doc} docinfo={docinfo} bundle={meta.data} user={session.user} userFullName={session.fullName}
            canWrite={canWrite} comment={data?.assignment.todo_description ?? undefined} threePriorities onChanged={refresh} />
        ) : <Skeleton className="h-8" />}
      </RailCard>
    ),
    sla: <RailCard id="sla" icon={Timer} title={t("rpSla")}>{page.pending ? <Skeleton className="h-16" /> : <SlaBody data={data} t={t} language={language} />}</RailCard>,
    playbook: (
      <RailCard id="playbook" icon={ListChecks} title={t("rpPlaybook")}>
        {page.pending ? <Skeleton className="h-12" /> : lc?.playbook && lc.status ? (
          <PlaybookBody doctype={doctype} name={name} status={lc.status} t={t} />
        ) : <Empty>{t("rpNoPlaybook")}</Empty>}
      </RailCard>
    ),
    tasks: (
      <RailCard id="tasks" icon={CheckSquare} title={data?.tasks.length ? `${t("rpTasks")} (${data.tasks.length})` : t("rpTasks")}>
        {page.pending ? <Skeleton className="h-12" /> : !data?.tasks.length ? <Empty>{t("rpNoTasks")}</Empty> : (
          <ul className={cn("space-y-2", data.tasks.length > TASKS_BEFORE_SCROLL && "max-h-80 overflow-y-auto pe-1")} data-tasks-scroll={data.tasks.length > TASKS_BEFORE_SCROLL || undefined}>
            {data.tasks.map((task) => (
              <li key={task.name} className="rounded-lg border border-border/60 bg-background/40 p-2.5" data-task={task.name}>
                <p className="line-clamp-2 text-sm">{htmlToText(task.description || "") || task.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="truncate">{task.allocated_to_name || task.allocated_to}</span>
                  <Badge variant={task.status === "Open" ? "info" : "success"} className="h-5 px-1.5 text-[10px]">
                    {task.status === "Open" ? t("rpTaskOpen") : t("rpTaskClosed")}
                  </Badge>
                  {task.priority ? <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{t(`recPriority${task.priority}` as Parameters<T>[0]) || task.priority}</Badge> : null}
                  {task.date ? <span>{task.date}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </RailCard>
    ),
    notes: (
      <RailCard id="notes" icon={StickyNote} title={docinfo?.comments?.length ? `${t("rpNotes")} (${docinfo.comments.length})` : t("rpNotes")}>
        <div className="max-h-96 overflow-y-auto pe-1">
          <FrappeComments doctype={doctype} name={name} docinfo={docinfo} order="newest-first" labels={{ empty: t("rpNoNotes") }} />
        </div>
      </RailCard>
    ),
    attachments: (
      <RailCard id="attachments" icon={Paperclip} title={t("rpAttachments")}>
        <FrappeAttachments doctype={doctype} name={name} doc={doc} bundle={meta.data} docinfo={docinfo} readOnly={!canWrite} />
      </RailCard>
    ),
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-4" data-sayr-record-page>
      <div className="min-w-0 lg:col-span-3">
        <FrappeForm
          key={formKey}
          {...form}
          doctype={doctype}
          name={name}
          header={header}
          toolbarStart={back}
          tabBar="record"
          onDirtyChange={(d) => { setDirty(d); onDirtyChange?.(d); }}
          onSaved={(saved, action) => { void refresh(); onSaved?.(saved, action); }}
        />
      </div>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:col-span-1 lg:self-start" aria-label={t("rpVisibleSections")}>
        <CustomizeSections hidden={hidden} onToggle={toggle} />
        {page.error ? <p role="alert" className="text-xs text-destructive">{page.error.message || t("rpLoadFailed")}</p> : null}
        {lifecycleCard}
        {RECORD_RAIL_CARDS.filter((card) => !hidden.has(card)).map((card) => <React.Fragment key={card}>{cards[card]}</React.Fragment>)}
        {data ? (
          <Card className="space-y-1 p-4 text-[11px] text-muted-foreground" data-rail-footer>
            <FooterLine label={t("rpCreatedBy")} who={data.header.owner_name || data.header.owner} at={data.header.creation} isRTL={isRTL} language={language} />
            <FooterLine label={t("rpEditedBy")} who={data.header.modified_by_name || data.header.modified_by} at={data.header.modified} isRTL={isRTL} language={language} />
          </Card>
        ) : null}
      </aside>
    </div>
  );
}

function FooterLine({ label, who, at, isRTL, language }: { label: string; who: string; at: string; isRTL: boolean; language: string }) {
  const ms = parseFrappeTime(at);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span>{label}</span>
      <span className="font-medium text-foreground">{who}</span>
      <span title={dateTime(ms, language)}>· {relativeTime(ms, isRTL)}</span>
    </div>
  );
}

/** The states the record went through (Frappe's workflow log and versions), oldest first, ending at the current one. */
function lifecyclePath(lc: NonNullable<RecordPageData["lifecycle"]>, doc: FrappeDoc | undefined, docinfo: Parameters<typeof stateEntries>[0]["docinfo"], isRTL: boolean, language: string) {
  const label = (s: { name_en: string; name_ar: string | null }) => (isRTL && s.name_ar) || s.name_en;
  const byName = new Map(lc.states.map((s) => [s.name_en, s]));
  const entries = doc ? stateEntries({ doc, docinfo, stateField: "workflow_state", states: lc.states.map((s) => s.name_en) }) : new Map();
  const visited = [...entries.entries()].sort((a, b) => a[1].at - b[1].at)
    .map(([stateName, e]) => ({ state: byName.get(stateName)!, entry: e }))
    .filter((x) => x.state && x.state.state_key !== lc.status);
  const current = lc.states.find((s) => s.state_key === lc.status);
  const currentEntry = current ? entries.get(current.name_en) : undefined;
  const step = (s: typeof lc.states[number], e?: { by: string; at: number }) => ({
    id: s.state_key,
    label: label(s),
    meta: e ? `${e.by.split(/\s+/)[0]} · ${new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(new Date(e.at))}` : undefined,
    metaTitle: e ? `${e.by} · ${dateTime(e.at, language)}` : undefined,
  });
  return [...visited.map((v) => step(v.state, v.entry)), ...(current ? [step(current, currentEntry)] : [])];
}

function SlaBody({ data, t, language }: { data?: RecordPageData; t: T; language: string }) {
  const sla = data?.sla;
  if (!sla || !sla.deployed) return <Empty>{t("rpNoSla")}</Empty>;
  const level = sla.level ? t(`rpLevel${sla.level}` as Parameters<T>[0]) || sla.level : null;
  const clock = sla.clock;
  const breached = !!clock && (clock.first_response.breached || clock.resolution.breached);
  const status = clock ? (breached ? { text: t("rpBreached"), variant: "destructive" as const }
    : { text: t(`rpSla${clock.status}` as Parameters<T>[0]), variant: ({ Running: "info", Paused: "warning", Fulfilled: "success" } as const)[clock.status] }) : null;
  const target = (label: string, clockTarget: SlaTargetClock | undefined, seconds?: number) => (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-end font-medium", clockTarget?.breached ? "text-destructive" : "text-foreground")}>
        {clockTarget?.met_on ? fmt(t("rpMetAt"), dateTime(parseFrappeTime(clockTarget.met_on), language))
          : clockTarget?.due ? fmt(t("rpDueAt"), dateTime(parseFrappeTime(clockTarget.due), language))
          : seconds ? fmt(t("rpTarget"), duration(seconds, t)) : "—"}
      </span>
    </div>
  );
  return (
    <div className="space-y-2 text-xs" data-sla-status={clock ? (breached ? "breached" : clock.status) : "none"}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{sla.policy_name}</p>
          {level ? <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px]">{level}</Badge> : null}
        </div>
        {status ? <Badge variant={status.variant}>{status.text}</Badge> : null}
      </div>
      {clock ? (
        <div className="space-y-1.5 border-t border-border/40 pt-2">
          {target(t("rpFirstResponse"), clock.first_response, sla.targets?.first_response)}
          {target(t("rpResolution"), clock.resolution, sla.targets?.resolution)}
        </div>
      ) : (
        <div className="space-y-0.5 border-t border-border/40 pt-2">
          <p className="text-muted-foreground">{t("rpNoClock")}</p>
          <p className="text-[11px] text-muted-foreground/80">{t("rpNoClockHint")}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {sla.priority ? <span>{t("rpPriority")}: {sla.priority}</span> : null}
        {sla.calendar_name ? <span>{t("rpWorkingHours")}: {sla.calendar_name}</span> : null}
      </div>
    </div>
  );
}

function PlaybookBody({ doctype, name, status, t }: { doctype: string; name: string; status: string; t: T }) {
  const api = useFrappeApi();
  const checklist = useSayrCall<ChecklistData | null>(OPEN_CHECKLIST_METHOD, { doctype, name }, `${doctype}\u0001${name}\u0001${status}`);
  const [ticking, setTicking] = React.useState(false);
  const [tickError, setTickError] = React.useState<string | null>(null);
  const tick = async (step: string, done: boolean) => {
    setTicking(true);
    setTickError(null);
    try {
      checklist.set((await api.call(TICK_STEP_METHOD, { checklist: checklist.data!.name, step, done: done ? 1 : 0 })).message as ChecklistData);
    } catch (e) {
      setTickError((e as Error).message);
    } finally {
      setTicking(false);
    }
  };
  if (checklist.pending) return <Skeleton className="h-12" />;
  if (checklist.error) return <p role="alert" className="text-xs text-destructive">{checklist.error.message}</p>;
  const c = checklist.data;
  if (!c) return <Empty>{t("rpNoPlaybook")}</Empty>;
  return (
    <div className="space-y-2" data-checklist={c.name}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">{c.playbook_title}</span>
        {c.checks_total ? <span className="shrink-0 text-muted-foreground">{fmt(t("rpStepsDone"), c.checks_done, c.checks_total)}</span> : null}
      </div>
      <ol className="space-y-1.5">
        {c.steps.map((s, i) => (
          <li key={s.name} className="flex items-start gap-2 text-xs">
            {s.done_check ? (
              <Checkbox checked={s.done} disabled={!c.can_tick || ticking} aria-label={s.step_title ?? ""}
                onCheckedChange={(v) => void tick(s.name, v === true)} className="mt-0.5" />
            ) : <span className="w-4 shrink-0 text-center text-muted-foreground">{i + 1}</span>}
            <span className={cn("min-w-0", s.done && "text-muted-foreground line-through")}>
              {s.step_title}
              {s.instruction ? <span className="block text-[11px] text-muted-foreground">{htmlToText(s.instruction)}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {tickError ? <p role="alert" className="text-xs text-destructive">{tickError}</p> : null}
    </div>
  );
}
