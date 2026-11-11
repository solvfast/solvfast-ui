/** Foundation hooks (contract §2). The Lead re-exports these from src/frappe/index.ts. */
export { useMetaBundle, useDoc, useDocInfo, useRefreshDoc, META_STALE_MS, DOC_STALE_MS } from "./useDoc";
export { useSaveDoc, useDocAction } from "./useDocMutations";
export type { SaveDocVars, DocActions, CancelVars, RemoveVars, RenameVars, RunMethodVars, WorkflowVars, AssignVars, UnassignVars, AddCommentVars, CommentVars } from "./useDocMutations";
export { usePermissions } from "./usePermissions";
export type { PermissionsResult } from "./usePermissions";
export { useRealtimeInvalidation } from "./useRealtime";
