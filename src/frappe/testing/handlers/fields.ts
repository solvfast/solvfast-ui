/**
 * SIMULATED handlers added by the P36d "fields" workstream. Each one cites the Frappe 15.110 source of its response shape
 * (paths relative to `apps/frappe/frappe/`). REQUEST and RESPONSE SHAPES only.
 */
import { toFrappeError } from "../../client";
import type { FixtureContextHandler } from "../fixtureTransport";

const sm = (...messages: Record<string, unknown>[]) => JSON.stringify(messages.map((m) => JSON.stringify(m)));

export const fieldsHandlers: Record<string, FixtureContextHandler> = {
  /**
   * `frappe.desk.search.get_link_title(doctype, docname)` (desk/search.py:327-334): `frappe.get_meta(doctype)` (an unknown
   * DocType → DoesNotExistError), then with `show_title_field_in_link` the title field's value through
   * `frappe.db.get_value` (None for a missing record; NO permission check — db.get_value is not permission-aware), else
   * the docname unchanged.
   */
  "frappe.desk.search.get_link_title": (a, store) => {
    const doctype = String(a.doctype ?? "");
    const docname = String(a.docname ?? "");
    const meta = store.meta[doctype]?.[0];
    if (!meta) {
      throw toFrappeError(404, { exc_type: "DoesNotExistError", _server_messages: sm({ message: `DocType ${doctype} not found`, indicator: "red", raise_exception: 1 }) });
    }
    if (!meta.show_title_field_in_link) return { message: docname };
    const row = store.docs.get(doctype)?.get(docname);
    const tf = meta.title_field || "name";
    return { message: row ? ((row[tf] as string | null | undefined) ?? null) : null };
  },
};
