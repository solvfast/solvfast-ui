/**
 * FrappeDocTags — the form sidebar's "Tags" section (Frappe 15.110 `form_sidebar.html:95-104`, `ui/tag_editor.js`,
 * `ui/tags.js`) over the package client: the tags of `docinfo.tags` (the shared docinfo query, `useDocInfo`) in Desk's
 * order; "+" opens a box that suggests existing tags (`get_tags`) and adds the typed one on Enter / leaving the box
 * (`add_tag`); a pill's "×" removes it (`remove_tag`). The docinfo is re-read after each server answer. Not shown for a
 * Single DocType (form_sidebar.js:146-150) nor an unsaved document.
 *
 * Rights: `add_tag` / `remove_tag` need `write` on the document (they end in `update_tags` → `check_permission("write")`,
 * tag.py:114-116, 147-152), so add / remove are offered with `write` only — Desk's editor is always shown and the
 * server refuses (difference listed in docs/components/record.md "Form Sidebar").
 */
import * as React from "react";
import { Tag } from "lucide-react";
import { SidebarSection } from "../../record/SidebarSection";
import { TagList } from "../../record/TagList";
import { Skeleton } from "../../primitives/skeleton";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeDoc, MetaBundle } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { useDoc, useDocInfo, useMetaBundle } from "../hooks";
import { usePermissions } from "../hooks/usePermissions";
import { docTags, sanitizeTag } from "./tags";
import { searchTags, useFormSidebarActions } from "./useFormSidebarActions";

export interface FrappeDocTagsProps {
  doctype: string;
  name: string;
  readOnly?: boolean;
  doc?: FrappeDoc;
  bundle?: MetaBundle;
  className?: string;
}

export function FrappeDocTags({ doctype, name, readOnly, doc: givenDoc, bundle: givenBundle, className }: FrappeDocTagsProps) {
  const { t } = useLocale();
  const api = useFrappeApi();
  const docQ = useDoc(givenDoc ? undefined : doctype, givenDoc ? undefined : name);
  const metaQ = useMetaBundle(givenBundle ? undefined : doctype);
  const doc = givenDoc ?? docQ.data?.doc;
  const bundle = givenBundle ?? metaQ.data;
  const infoQ = useDocInfo(doc && !doc.__islocal ? doctype : undefined, name);
  const info = infoQ.data;
  const perms = usePermissions(bundle, doc, info);
  const actions = useFormSidebarActions();
  const [adding, setAdding] = React.useState(false);
  const raw = info?.tags;
  const tags = React.useMemo(() => docTags(raw), [raw]);
  const search = React.useCallback(async (txt: string) => (await searchTags(api, doctype, txt)).map((value) => ({ value })), [api, doctype]);

  if (doc?.__islocal || Number(bundle?.meta.issingle ?? 0)) return null;
  const canEdit = !readOnly && perms.can("write");
  const ref = { doctype, name };
  return (
    <SidebarSection id="tags" label={t("sbTags")} icon={Tag} busy={infoQ.isFetching} className={className}
      action={canEdit ? { label: t("sbTagAdd"), onClick: () => setAdding(true) } : undefined}>
      {!info && infoQ.isLoading ? <Skeleton className="h-6 w-24" /> : infoQ.error && !info ? (
        <p role="alert" className="text-xs text-destructive">{infoQ.error.message || t("sbLoadFailed")}</p>
      ) : (
        <TagList tags={tags} adding={canEdit && adding} onAddingChange={setAdding} search={search} sanitize={sanitizeTag}
          onAdd={canEdit ? (tag) => actions.addTag.mutateAsync({ ...ref, tag }) : undefined}
          onRemove={canEdit ? (tag) => actions.removeTag.mutateAsync({ ...ref, tag }) : undefined} />
      )}
    </SidebarSection>
  );
}
