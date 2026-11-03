/** Foundation feedback (contract §2-3). The Lead re-exports these from src/frappe/index.ts. */
export { FrappeErrorState, describeError } from "./FrappeErrorState";
export type { FrappeErrorStateProps } from "./FrappeErrorState";
export { FrappeMessagesProvider, useFrappeMessages } from "./messages";
export type { FrappeMessagesApi, FrappeMessagesProviderProps } from "./messages";
export { ServerHtml, htmlToText } from "./ServerHtml";
export { indicatorTone } from "./tone";
