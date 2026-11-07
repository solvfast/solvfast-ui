/**
 * Generic field controls (0.4.0) — Frappe-free, value in / value out. The Frappe wrappers live in src/frappe/form.
 * The Lead re-exports this barrel from the core entry (src/index.ts).
 */
export { FieldShell, FIELD_INPUT, FIELD_INVALID } from "./FieldShell";
export type { FieldShellProps } from "./FieldShell";
export { NumberInput } from "./NumberInput";
export type { NumberInputProps, NumberKind } from "./NumberInput";
export { TimeInput } from "./TimeInput";
export type { TimeInputProps } from "./TimeInput";
export { DurationInput } from "./DurationInput";
export type { DurationInputProps } from "./DurationInput";
export { ReadOnlyValue } from "./ReadOnlyValue";
export type { ReadOnlyValueProps } from "./ReadOnlyValue";
export { LinkInput } from "./LinkInput";
export type { LinkInputProps } from "./LinkInput";
export { TagInput } from "./TagInput";
export type { TagInputProps } from "./TagInput";
export type { Suggestion, SuggestionAction, SearchFn } from "./autocomplete";
export { DataGrid } from "./DataGrid";
export type { DataGridProps, DataGridColumn } from "./DataGrid";
export { Rating } from "./Rating";
export type { RatingProps } from "./Rating";
export { ColorInput, isHexColor } from "./ColorInput";
export type { ColorInputProps } from "./ColorInput";
export {
  numberFormatInfo, parseLocaleNumber, formatLocaleNumber, roundNumber, evaluateArithmetic, normalizeDigits,
  DEFAULT_NUMBER_FORMAT,
} from "./lib/number";
export type { NumberFormatInfo, RoundingMethod } from "./lib/number";
export { parseTimeText, toTimeString, formatTimeText, secondsToDuration, durationToSeconds, formatDuration } from "./lib/time";
export type { TimeParts, DurationParts, DurationOptions, DurationUnits } from "./lib/time";
// P35 core
export { FileDropzone, fileMatchesAccept, formatFileSize, validateFiles } from "./FileDropzone";
export type { FileDropzoneProps, FileDropzoneLabels, FileRejection, FileRejectionReason } from "./FileDropzone";
