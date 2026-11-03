import { StatusBadge } from "../../record/StatusBadge";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeDoc, MetaBundle } from "../contract";
import type { RecordClient } from "./data";
import { useRecordClient, useRecordMeta } from "./data";
import { indicatorFor, type Indicator } from "./indicator";
import { useWorkflowDefinition } from "./useWorkflow";
import type { RecordWorkflow } from "./workflow";

export interface FrappeStatusIndicatorProps {
  doc: FrappeDoc;
  /** Meta of the DocType; loaded through the client when omitted. */
  bundle?: MetaBundle;
  /** Pass the definition when the page already has it; otherwise it is loaded. */
  workflow?: RecordWorkflow | null;
  client?: RecordClient;
  translate?: (text: string) => string;
  variant?: "pill" | "dot";
  className?: string;
}

/** The record’s status chip: `frappe.get_indicator` precedence (workflow state → Draft / Cancelled → meta.states → Submitted → status → enabled). */
export function FrappeStatusIndicator({ doc, bundle, workflow, client, translate = (s) => s, variant, className }: FrappeStatusIndicatorProps) {
  const { t } = useLocale();
  const c = useRecordClient(client);
  const meta = useRecordMeta(c, doc.doctype, bundle);
  const def = useWorkflowDefinition(doc.doctype, c, workflow === undefined);
  const wf = workflow === undefined ? def.workflow : workflow;
  if (!meta.data) return null;
  const ind: Indicator | null = indicatorFor({ doc, meta: { ...meta.data.meta, states: (meta.data.meta.states as Array<{ title: string; color?: string }> | undefined) }, workflow: wf });
  if (!ind) return null;
  const label = ind.builtin
    ? t(({ notSaved: "recNotSaved", draft: "recDraft", cancelled: "recCancelledStatus", submitted: "recSubmittedStatus", enabled: "recEnabled", disabled: "recDisabled" } as const)[ind.builtin])
    : translate(ind.label);
  return <StatusBadge label={label} tone={ind.tone} variant={variant} className={className} />;
}
