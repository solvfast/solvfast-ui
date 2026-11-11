/**
 * SayrNewRecordPage — a new family record laid out like SayrRecordPage: Back and Create on top, a header card holding the
 * type picker, the type's tabs as a full-width bar, and a rail. Once a type is chosen the rail previews what its
 * DocType's deployments bring (Sayr's `type_preview`): the lifecycle and the status a record starts in, the SLA policy
 * and its targets, the assignment profiles. Playbook, Tasks, Pinned Notes and Attachments wait for the record.
 */
import { CheckSquare, GitBranch, ListChecks, Paperclip, ShieldCheck, StickyNote, Timer } from "lucide-react";
import { Badge } from "../primitives/badge";
import { LifecycleRail } from "../record/LifecycleRail";
import { fmt } from "../record/format";
import { useLocale } from "../theme/ThemeProvider";
import type { FamilyType } from "../frappe/family/family";
import { FrappeNewFamilyRecord, type FrappeNewFamilyRecordProps } from "../frappe/family/FrappeNewFamilyRecord";
import { TYPE_PREVIEW_METHOD, defaultLifecycleHref, type TypePreviewData } from "./recordPage";
import { useSayrCall } from "./SayrRecordPage";
import {
  CustomizeSections, Empty, PHASE_VARIANT, RECORD_RAIL_CARDS, RailCard, duration, railStorageKeyOf, useHiddenCards,
  type RecordRailCard, type T,
} from "./rail";
import { Skeleton } from "../primitives/skeleton";

export interface SayrNewRecordPageProps extends Omit<FrappeNewFamilyRecordProps, "layout" | "aside"> {
  /** Where "View full lifecycle" opens (a new tab). Default: Sayr Studio's lifecycle builder. */
  lifecycleHref?: (lifecycle: string) => string;
}

export function SayrNewRecordPage({ lifecycleHref = defaultLifecycleHref, ...props }: SayrNewRecordPageProps) {
  return (
    <FrappeNewFamilyRecord {...props} layout="record"
      aside={(type) => <TypePreviewRail key={type?.doctype ?? ""} type={type} lifecycleHref={lifecycleHref} />} />
  );
}

function TypePreviewRail({ type, lifecycleHref }: { type?: FamilyType; lifecycleHref: (lifecycle: string) => string }) {
  const { t, isRTL } = useLocale();
  const doctype = type?.doctype ?? "";
  const preview = useSayrCall<TypePreviewData>(TYPE_PREVIEW_METHOD, { doctype }, doctype, !!doctype);
  const { hidden, toggle } = useHiddenCards(railStorageKeyOf(doctype));
  const p = doctype ? preview.data : undefined;
  const loading = !!doctype && preview.pending;
  const later = <Empty>{t("rpAfterCreate")}</Empty>;
  const choose = <Empty>{t("rpChooseTypePreview")}</Empty>;
  const lc = p?.lifecycle;

  const cards: Record<RecordRailCard, React.ReactNode> = {
    assignment: (
      <RailCard id="assignment" icon={ShieldCheck} title={t("rpAssignment")}>
        {!doctype ? choose : loading ? <Skeleton className="h-8" /> : !p?.assignment.length ? <Empty>{t("rpNoAssignmentProfile")}</Empty> : (
          <ul className="space-y-1.5 text-xs">
            {p.assignment.map((a) => (
              <li key={a.profile} className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{a.profile_name}</span>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{a.strategy}</Badge>
              </li>
            ))}
          </ul>
        )}
      </RailCard>
    ),
    sla: (
      <RailCard id="sla" icon={Timer} title={t("rpSla")}>
        {!doctype ? choose : loading ? <Skeleton className="h-16" /> : <SlaPreview sla={p?.sla} t={t} />}
      </RailCard>
    ),
    playbook: <RailCard id="playbook" icon={ListChecks} title={t("rpPlaybook")}>{doctype ? later : choose}</RailCard>,
    tasks: <RailCard id="tasks" icon={CheckSquare} title={t("rpTasks")}>{doctype ? later : choose}</RailCard>,
    notes: <RailCard id="notes" icon={StickyNote} title={t("rpNotes")}>{doctype ? later : choose}</RailCard>,
    attachments: <RailCard id="attachments" icon={Paperclip} title={t("rpAttachments")}>{doctype ? later : choose}</RailCard>,
  };

  return (
    <>
      {doctype ? <CustomizeSections hidden={hidden} onToggle={toggle} /> : null}
      {preview.error ? <p role="alert" className="text-xs text-destructive">{preview.error.message || t("rpLoadFailed")}</p> : null}
      <RailCard id="lifecycle" icon={GitBranch} title={lc?.title ? `${t("rpLifecycle")} · ${lc.title}` : t("rpLifecycle")}>
        {!doctype ? choose : loading ? <Skeleton className="h-16" /> : !lc ? <Empty>{t("rpNoLifecycle")}</Empty> : (
          <div className="space-y-2">
            {lc.initial ? (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {fmt(t("rpStartsIn"), "")}
                <Badge variant={PHASE_VARIANT[lc.initial.phase as keyof typeof PHASE_VARIANT] ?? "outline"}>{(isRTL && lc.initial.name_ar) || lc.initial.name_en}</Badge>
                <span>· {fmt(t("rpStatusesCount"), lc.states_count)}</span>
              </p>
            ) : null}
            <LifecycleRail path={lc.initial ? [{ id: lc.initial.state_key, label: (isRTL && lc.initial.name_ar) || lc.initial.name_en }] : []}
              onViewAll={() => window.open(lifecycleHref(lc.lifecycle), "_blank", "noopener")} />
          </div>
        )}
      </RailCard>
      {RECORD_RAIL_CARDS.filter((card) => !doctype || !hidden.has(card)).map((card) => <div key={card}>{cards[card]}</div>)}
    </>
  );
}

function SlaPreview({ sla, t }: { sla?: TypePreviewData["sla"]; t: T }) {
  if (!sla || !sla.deployed) return <Empty>{t("rpNoSla")}</Empty>;
  const level = sla.level ? t(`rpLevel${sla.level}` as Parameters<T>[0]) || sla.level : null;
  const pr = { urgent: t("rpPrUrgent"), high: t("rpPrHigh"), medium: t("rpPrMedium"), low: t("rpPrLow") };
  return (
    <div className="space-y-2 text-xs" data-sla-preview={sla.policy}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{sla.policy_name}</p>
        {level ? <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px]">{level}</Badge> : null}
      </div>
      <table className="w-full border-t border-border/40 text-start">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th className="py-1.5 text-start font-normal">{t("rpPriority")}</th>
            <th className="py-1.5 text-end font-normal">{t("rpFirstResponse")}</th>
            <th className="py-1.5 text-end font-normal">{t("rpResolution")}</th>
          </tr>
        </thead>
        <tbody>
          {sla.targets.map((row) => (
            <tr key={row.priority}>
              <td className="py-0.5">{pr[row.priority]}</td>
              <td className="py-0.5 text-end font-medium">{duration(row.first_response, t)}</td>
              <td className="py-0.5 text-end font-medium">{duration(row.resolution, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sla.calendar_name ? <p className="text-[11px] text-muted-foreground">{t("rpWorkingHours")}: {sla.calendar_name}</p> : null}
    </div>
  );
}
