/** T3 (0.8.0-dev.3): the record page parts' messages moved from the internal module `recordPageCrm` to `recordPageParts`.
 *  Keys and wording are unchanged (the 0.8.0-dev.2 values, verbatim), so hosts overriding them through ThemeProvider
 *  messages or `labels` are unaffected. */
import { describe, expect, it } from "vitest";
import { recordPagePartsAr, recordPagePartsEn } from "../src/theme/messages-ws/recordPageParts";
import { wsAr, wsEn } from "../src/theme/messages-ws";

const DEV2_EN = {
  resNotSaved: "Not saved",
  resSave: "Save",
  resSaving: "Saving…",
  resSaved: "Saved",
  resSaveFailed: "Couldn't save. Try again.",
  resEdit: "Edit",
  resCancel: "Cancel",
  resUnsavedTitlePage: "You have unsaved changes",
  resUnsavedTitleCard: "Unsaved changes",
  resUnsavedBodyPage: "You have unsaved changes on this record.",
  resUnsavedBodyCard: "You have unsaved changes in {0}.",
  resSaveAndLeave: "Save and leave",
  resKeepEditing: "Keep editing",
  resStay: "Stay",
  resDiscard: "Discard",
  rpgInteractions: "Recent Interactions",
  rpgInbound: "Inbound",
  rpgOutbound: "Outbound",
  rpgNoInteractions: "No interactions yet",
};
const DEV2_AR = {
  resNotSaved: "غير محفوظ",
  resSave: "حفظ",
  resSaving: "جارٍ الحفظ…",
  resSaved: "تم الحفظ",
  resSaveFailed: "تعذّر الحفظ. حاول مرة أخرى.",
  resEdit: "تعديل",
  resCancel: "إلغاء",
  resUnsavedTitlePage: "لديك تغييرات غير محفوظة",
  resUnsavedTitleCard: "تغييرات غير محفوظة",
  resUnsavedBodyPage: "لديك تغييرات غير محفوظة في هذا السجل.",
  resUnsavedBodyCard: "لديك تغييرات غير محفوظة في {0}.",
  resSaveAndLeave: "حفظ ومغادرة",
  resKeepEditing: "متابعة التعديل",
  resStay: "البقاء",
  resDiscard: "تجاهل",
  rpgInteractions: "التفاعلات الأخيرة",
  rpgInbound: "واردة",
  rpgOutbound: "صادرة",
  rpgNoInteractions: "لا توجد تفاعلات بعد",
};

describe("recordPageParts messages (renamed from recordPageCrm)", () => {
  it("en and ar are the 0.8.0-dev.2 objects, key for key and value for value", () => {
    expect(recordPagePartsEn).toEqual(DEV2_EN);
    expect(recordPagePartsAr).toEqual(DEV2_AR);
  });
  it("the merged catalogue still carries every key with the same value", () => {
    for (const [k, v] of Object.entries(DEV2_EN)) expect((wsEn as Record<string, string>)[k]).toBe(v);
    for (const [k, v] of Object.entries(DEV2_AR)) expect((wsAr as Record<string, string>)[k]).toBe(v);
  });
});
