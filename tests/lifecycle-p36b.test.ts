/**
 * P36b lifecycle — DS terminology: the package's own chrome says "Lifecycle" (ar "دورة الحياة"), never "Workflow".
 * Owner request: a label change only. Frappe's Workflow feature, its API methods (`frappe.model.workflow.*`), fields
 * (`workflow_state`), DocTypes ("Workflow", "Workflow State") and server-sent text are unchanged; message KEYS
 * (`listBulkWorkflow…`) are API and are kept.
 */
import { describe, expect, it } from "vitest";
import { defaultMessages } from "../src/theme/messages";

const OLD_EN = /\bwork\s*flows?\b/i;
// Arabic renderings of "workflow": سير العمل / سير عمل / مسار العمل / مسار عمل / تدفق العمل
const OLD_AR = /(سير|مسار|تدفق|تدفّق)\s+(ال)?عمل/;
/** Keys whose value may legitimately name Frappe's Workflow DocType / server text. Currently none. */
const ALLOW = new Set<string>();

describe("P36B.lifecycle", () => {
  it("P36B.lifecycle.1 no en / ar message value says Workflow (allow-list explicit); the bulk menu says Lifecycle", () => {
    const hits: string[] = [];
    for (const lang of ["en", "ar"] as const) {
      for (const [key, value] of Object.entries(defaultMessages[lang])) {
        if (ALLOW.has(key) || typeof value !== "string") continue;
        if (OLD_EN.test(value) || OLD_AR.test(value)) hits.push(`${lang}.${key}: ${value}`);
      }
    }
    expect(hits).toEqual([]);
    // positive control: the keys are kept, only the values changed
    expect(defaultMessages.en.listBulkWorkflow).toBe("Lifecycle");
    expect(defaultMessages.en.listBulkWorkflowNone).toMatch(/lifecycle/);
    expect(defaultMessages.ar.listBulkWorkflow).toBe("دورة الحياة");
    expect(defaultMessages.ar.listBulkWorkflowNone).toContain("دورة الحياة");
    // negative control: the scanner does catch the old labels
    for (const old of ["Workflow", "No workflow action applies", "سير العمل", "إجراء سير عمل", "مسار العمل"]) {
      expect(OLD_EN.test(old) || OLD_AR.test(old)).toBe(true);
    }
    // and does not flag unrelated words (مساحة العمل = workspace, تعديل)
    for (const ok of [defaultMessages.ar.myWorkspace, "Workspace", "Workflow State".replace("Workflow", "Lifecycle")]) {
      expect(OLD_EN.test(ok) || OLD_AR.test(ok)).toBe(false);
    }
  });
});
