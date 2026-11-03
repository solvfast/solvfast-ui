/**
 * RealtimePort over an app-injected Socket.IO client (docs 10 §C7). SKELETON — not exercised against a site.
 *
 * The package does not depend on socket.io-client: the app creates the socket (same origin, namespace `/<site>`,
 * `withCredentials: true` — the Node service authenticates with the `sid` cookie) and passes it in. This adapter only
 * speaks Frappe's room protocol (realtime/handlers/frappe_handlers.js):
 *   doc_subscribe(doctype, name) / doc_unsubscribe  → events `doc_update` {doctype, name, modified}, `docinfo_update`
 *   doctype_subscribe(doctype) / doctype_unsubscribe → event `list_update` {doctype, name, user}
 * Rooms are reference-counted so two subscribers of the same document share one subscription. Events of other
 * documents are filtered out. Apply the cache rules with `applyRealtimeEvent` (services/cache.ts).
 * UNVERIFIED: reconnect behaviour (Desk re-subscribes on `connect`; done here too) and payload details beyond the
 * emitters cited in docs 10 §C7.
 */
import type { RealtimeEvent, RealtimePort } from "../contract";

/** The part of a Socket.IO client this adapter uses. */
export interface SocketLike {
  emit(event: string, ...args: unknown[]): unknown;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener: (...args: unknown[]) => void): unknown;
}

type Listener = (e: RealtimeEvent) => void;

export function createSocketRealtime(socket: SocketLike): RealtimePort & { dispose(): void } {
  const docRooms = new Map<string, { doctype: string; name: string; listeners: Set<Listener> }>();
  const doctypeRooms = new Map<string, Set<Listener>>();
  const docKey = (doctype: string, name: string) => `${doctype}\u0000${name}`;

  const onDoc = (event: "doc_update" | "docinfo_update") => (data: unknown) => {
    const d = (data ?? {}) as { doctype?: string; name?: string; doc?: { doctype?: string; name?: string; reference_doctype?: string; reference_name?: string } };
    // docinfo_update carries {doc, key, action}; the doc is a Comment/Communication referencing the record
    const doctype = d.doctype ?? d.doc?.reference_doctype ?? d.doc?.doctype;
    const name = d.name ?? d.doc?.reference_name ?? d.doc?.name;
    if (!doctype || !name) return;
    const room = docRooms.get(docKey(doctype, name));
    if (room) for (const l of [...room.listeners]) l({ event, doctype, name, data });
  };
  const onList = (data: unknown) => {
    const d = (data ?? {}) as { doctype?: string; name?: string };
    if (!d.doctype) return;
    for (const l of [...(doctypeRooms.get(d.doctype) ?? [])]) l({ event: "list_update", doctype: d.doctype, name: d.name, data });
  };
  const resubscribe = () => {
    for (const r of docRooms.values()) socket.emit("doc_subscribe", r.doctype, r.name);
    for (const dt of doctypeRooms.keys()) socket.emit("doctype_subscribe", dt);
  };
  const docUpdate = onDoc("doc_update");
  const docinfoUpdate = onDoc("docinfo_update");
  socket.on("doc_update", docUpdate);
  socket.on("docinfo_update", docinfoUpdate);
  socket.on("list_update", onList);
  socket.on("connect", resubscribe);

  return {
    subscribeDoc(doctype, name, onEvent) {
      const key = docKey(doctype, name);
      let room = docRooms.get(key);
      if (!room) { room = { doctype, name, listeners: new Set() }; docRooms.set(key, room); socket.emit("doc_subscribe", doctype, name); }
      room.listeners.add(onEvent);
      return () => {
        const r = docRooms.get(key);
        if (!r) return;
        r.listeners.delete(onEvent);
        if (!r.listeners.size) { docRooms.delete(key); socket.emit("doc_unsubscribe", doctype, name); }
      };
    },
    subscribeDoctype(doctype, onEvent) {
      let set = doctypeRooms.get(doctype);
      if (!set) { set = new Set(); doctypeRooms.set(doctype, set); socket.emit("doctype_subscribe", doctype); }
      set.add(onEvent);
      return () => {
        const s = doctypeRooms.get(doctype);
        if (!s) return;
        s.delete(onEvent);
        if (!s.size) { doctypeRooms.delete(doctype); socket.emit("doctype_unsubscribe", doctype); }
      };
    },
    dispose() {
      socket.off("doc_update", docUpdate);
      socket.off("docinfo_update", docinfoUpdate);
      socket.off("list_update", onList);
      socket.off("connect", resubscribe);
      docRooms.clear();
      doctypeRooms.clear();
    },
  };
}
