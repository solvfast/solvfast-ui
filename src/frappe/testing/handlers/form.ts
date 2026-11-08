/** SIMULATED handlers added by the P35 "form" workstream. Each handler cites the Frappe 15.110 source of its response shape. */
import type { FixtureContextHandler } from "../fixtureTransport";

export const formHandlers: Record<string, FixtureContextHandler> = {
  // ---- P36b attachimage ----
  /**
   * core/api/file.py:86-91 `get_max_file_size()` (whitelisted, any logged-in user): System Settings `max_file_size` (MB)
   * × 1024 × 1024, else the site config's `max_file_size` (bytes), else 25 MiB. The simulator reads the "System Settings"
   * single from its store (`max_file_size`, MB); site config is not simulated. Desk's FileUploader asks for it every time
   * it opens (FileUploader.vue:352-356). Answer: a number of bytes.
   */
  "frappe.core.api.file.get_max_file_size": (_a, store) => {
    const ss = store.docs.get("System Settings")?.get("System Settings") as Record<string, unknown> | undefined;
    const mb = Math.trunc(Number(ss?.max_file_size ?? 0)) || 0;
    return { message: mb * 1024 * 1024 || 25 * 1024 * 1024 };
  },
};
