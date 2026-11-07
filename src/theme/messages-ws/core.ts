/** Chrome strings added by the P35 "core" workstream (en + ar; the ar object must have every en key). */
export const coreEn = {
  // LifecycleBar (G7): screen-reader suffix of a skipped / failed state
  coreStepSkipped: "Skipped",
  coreStepFailed: "Failed",
};
export const coreAr: { [K in keyof typeof coreEn]: string } = {
  coreStepSkipped: "تم تخطّيها",
  coreStepFailed: "فشلت",
};
