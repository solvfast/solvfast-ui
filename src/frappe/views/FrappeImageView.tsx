/**
 * FrappeImageView — Desk's Image view (frappe/public/js/frappe/views/image/image_view.js) over a DocType: the Core
 * `ImageView` fed by `frappe.desk.reportview.get`, with the DocType's `image_field` and `title_field` (image_view.js:21-29
 * requests name, the in_list_view fields, the title field and the image field), the first non-empty list field as the
 * detail line (`item_details_html`, :68-85), and the list's filters, search, sort and paging.
 *
 * Not reproduced from Desk: the photo gallery / zoom (PhotoSwipe, :140-196, and the `get_attached_images` lookup of
 * every attachment), the Like heart on the card, the "Images" page title.
 */
import * as React from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { ImageView, type ImageViewProps } from "../../list/views/ImageView";
import { FrappeProvider } from "../FrappeProvider";
import type { FrappeClient } from "../client";
import type { FrappeFilter } from "../query";
import type { ListQueryState } from "../../list/useListState";
import { useFrappeMeta } from "../useFrappeList";
import { useFrappeViewList } from "./useFrappeViewList";

type Row = Record<string, unknown>;
type Managed = "rows" | "columns" | "rowKey" | "mode" | "total" | "onStateChange" | "loading" | "error" | "onRetry" | "image" | "title"
  | "filterFields" | "groupByOptions" | "pageSize" | "totalLabel" | "hasMore" | "selectionScope";

export interface FrappeImageViewProps extends Omit<ImageViewProps<Row>, Managed> {
  doctype: string;
  client?: FrappeClient;
  baseFilters?: FrappeFilter[];
  /** Default 20. */
  pageSize?: number;
  /** Default: the DocType's `image_field`. */
  imageField?: string;
  /** Default: the DocType's `title_field`, else `name`. */
  titleField?: string;
  /** Turn a stored file URL (`/files/x.png`) into an `<img src>` (e.g. prefix the site URL). Default: as stored. */
  imageUrl?: (fileUrl: string) => string;
  /** The applied list state, after each change (to carry filters / sort to another view). */
  onQueryStateChange?: (state: ListQueryState) => void;
}

export function FrappeImageView(props: FrappeImageViewProps) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner({ doctype, client, baseFilters, pageSize, imageField, titleField, imageUrl, onQueryStateChange, ...rest }: FrappeImageViewProps) {
  const doc = useFrappeMeta(doctype, { client }).doc as { image_field?: string; title_field?: string } | undefined;
  const image = imageField ?? doc?.image_field;
  const titleKey = titleField ?? (doc?.title_field || "name");
  const v = useFrappeViewList({ doctype, client, baseFilters, pageSize, scope: "image", extraFields: [image, titleKey].filter((f): f is string => !!f) });
  const { listProps } = v;
  const onState = listProps.onStateChange;
  const onStateChange = React.useCallback((s: ListQueryState) => { onState(s); onQueryStateChange?.(s); }, [onState, onQueryStateChange]);
  const detailKeys = React.useMemo(() => (v.state?.visible ?? []).filter((k) => k !== titleKey && k !== image && k !== "name"), [v.state, titleKey, image]);
  return (
    <ImageView<Row>
      key={v.ready ? "ready" : "meta"}
      viewKey={`${doctype}:image`}
      emptyMessage={rest.emptyMessage}
      {...rest}
      {...listProps}
      quickFilterFields={rest.quickFilterFields ?? listProps.quickFilterFields}
      loadOptions={rest.loadOptions ?? listProps.loadOptions}
      onStateChange={onStateChange}
      onRetry={v.refetch}
      image={(row) => { const u = image ? row[image] : null; return typeof u === "string" && u ? (imageUrl ? imageUrl(u) : u) : null; }}
      title={(row) => String(row[titleKey] ?? row.name ?? "")}
      detail={rest.detail ?? ((row) => { const k = detailKeys.find((x) => row[x] !== null && row[x] !== undefined && row[x] !== ""); return k ? String(row[k]) : null; })}
    />
  );
}
