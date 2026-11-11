// What SayrRecordPage reads from Sayr (sear_product): one aggregate call for the header and the side cards, the
// transition, and the playbook checklist of the record's status.
export const RECORD_PAGE_METHOD = "sear_product.apis.tickets.tickets.record_page";
export const TRANSITION_METHOD = "sear_product.apis.tickets.tickets.execute_transition";
export const OPEN_CHECKLIST_METHOD = "sear_product.apis.sear_playbook_checklist.sear_playbook_checklist.open_checklist";
export const TICK_STEP_METHOD = "sear_product.apis.sear_playbook_checklist.sear_playbook_checklist.tick_step";

/** Sayr Studio's lifecycle builder (sear_product's `/sayr-framework` app). */
export const defaultLifecycleHref = (lifecycle: string) =>
  `/sayr-framework/workspace/build/sear_studio/life_cycles/${encodeURIComponent(lifecycle)}`;

export interface SlaTargetClock { due: string | null; met_on: string | null; breached: boolean }

export interface RecordPageData {
  header: {
    owner: string; owner_name: string | null; creation: string;
    modified_by: string; modified_by_name: string | null; modified: string;
  };
  lifecycle_deployed: boolean;
  lifecycle: null | {
    lifecycle: string; title: string | null; status: string | null; phase: string | null;
    status_label_en: string | null; status_label_ar: string | null; playbook: string | null;
    states: { state_key: string; name_en: string; name_ar: string | null; phase: string; color: string | null; is_current: boolean }[];
    actions: { transition_key: string; action_en: string; action_ar: string | null; to_state: string; to_phase: string | null }[];
  };
  sla: { deployed: false } | {
    deployed: true; policy: string; policy_name: string; level: string | null; calendar_name: string | null;
    priority: string | null; targets: { first_response: number; resolution: number } | null;
    clock: null | { status: "Running" | "Paused" | "Fulfilled"; first_response: SlaTargetClock; resolution: SlaTargetClock };
  };
  assignment: { todo_description: string | null };
  tasks: {
    name: string; allocated_to: string; allocated_to_name: string | null; status: string; priority: string | null;
    date: string | null; description: string | null;
  }[];
}

export interface ChecklistData {
  name: string; playbook_title: string | null; checks_done: number; checks_total: number; can_tick: boolean;
  steps: { name: string; step_title: string | null; instruction: string | null; done_check: boolean; done: boolean; done_by: string | null }[];
}
