/**
 * GeolocationInput — the features of a stored GeoJSON location, as a list (P36e ftypes). PARTIAL: read-only. Drawing
 * and editing need a map library, which this package does not include.
 *
 * Native reference (Frappe 15.110 `form/controls/geolocation.js`):
 * - the value is `JSON.stringify(editableLayers.toGeoJSON())`: a GeoJSON FeatureCollection (:207-223), parsed with
 *   `JSON.parse` on load (:56-73);
 * - circles and circle markers are stored as Points with `properties.point_type` = "circle" / "circlemarker" and
 *   `properties.radius` in metres (:117-139; drawn back by `point_to_layer`, :84-93);
 * - the field shows even when empty (a map), in Read and Write.
 * Here: each feature with its kind and its position (a point: latitude / longitude — GeoJSON stores [lng, lat]; a
 * circle: centre and radius; a line or polygon: its number of points). An empty value says "No location"; a value that
 * is not GeoJSON is reported and shown as text, never thrown. Editable status adds the note that a map is needed.
 */
import * as React from "react";
import { MapPin } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { interpolate } from "./FieldShell";

export type GeoFeatureKind =
  | "point" | "circle" | "circlemarker" | "line" | "polygon" | "multipoint" | "multiline" | "multipolygon" | "collection" | "unknown";

export interface GeoFeatureSummary {
  kind: GeoFeatureKind;
  /** A point / circle centre (GeoJSON order is [lng, lat]). */
  lat?: number;
  lng?: number;
  /** Circle radius in metres (geolocation.js:120-126). */
  radius?: number;
  /** Number of positions of a line / polygon / multi geometry. */
  vertices?: number;
}

export type ParsedGeolocation =
  | { status: "empty" }
  | { status: "invalid"; raw: string }
  | { status: "ok"; features: GeoFeatureSummary[] };

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const isPos = (v: unknown): v is number[] => Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number" && Number.isFinite(v[0]) && Number.isFinite(v[1]);
/** Count positions in nested coordinate arrays (null when malformed). */
function countPositions(c: unknown, depth: number): number | null {
  if (depth === 0) return isPos(c) ? 1 : null;
  if (!Array.isArray(c)) return null;
  let n = 0;
  for (const x of c) { const k = countPositions(x, depth - 1); if (k == null) return null; n += k; }
  return n;
}

function summarize(geometry: unknown, properties: unknown): GeoFeatureSummary {
  if (!isObj(geometry)) return { kind: "unknown" };
  const props = isObj(properties) ? properties : {};
  const c = geometry.coordinates;
  switch (geometry.type) {
    case "Point": {
      if (!isPos(c)) return { kind: "unknown" };
      const pt = props.point_type === "circle" ? "circle" : props.point_type === "circlemarker" ? "circlemarker" : "point";
      const radius = typeof props.radius === "number" && Number.isFinite(props.radius) ? props.radius : undefined;
      return { kind: pt, lng: c[0], lat: c[1], ...(pt !== "point" && radius != null ? { radius } : {}) };
    }
    case "LineString": { const n = countPositions(c, 1); return n == null ? { kind: "unknown" } : { kind: "line", vertices: n }; }
    case "Polygon": { const n = countPositions(c, 2); return n == null ? { kind: "unknown" } : { kind: "polygon", vertices: n }; }
    case "MultiPoint": { const n = countPositions(c, 1); return n == null ? { kind: "unknown" } : { kind: "multipoint", vertices: n }; }
    case "MultiLineString": { const n = countPositions(c, 2); return n == null ? { kind: "unknown" } : { kind: "multiline", vertices: n }; }
    case "MultiPolygon": { const n = countPositions(c, 3); return n == null ? { kind: "unknown" } : { kind: "multipolygon", vertices: n }; }
    case "GeometryCollection": return { kind: "collection" };
    default: return { kind: "unknown" };
  }
}

/** Parse a stored Geolocation value (a JSON string, or an already parsed object) without throwing. */
export function parseGeolocation(value: unknown): ParsedGeolocation {
  if (value == null || value === "") return { status: "empty" };
  let data: unknown = value;
  if (typeof value === "string") {
    if (!value.trim()) return { status: "empty" };
    try { data = JSON.parse(value); } catch { return { status: "invalid", raw: value }; }
  }
  const raw = typeof value === "string" ? value : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
  if (!isObj(data)) return { status: "invalid", raw };
  if (data.type === "FeatureCollection") {
    if (!Array.isArray(data.features)) return { status: "invalid", raw };
    const features = data.features.map((f) => (isObj(f) && f.type === "Feature" ? summarize(f.geometry, f.properties) : { kind: "unknown" as const }));
    return features.length ? { status: "ok", features } : { status: "empty" };
  }
  if (data.type === "Feature") return { status: "ok", features: [summarize(data.geometry, data.properties)] };
  if (typeof data.type === "string" && "coordinates" in data) return { status: "ok", features: [summarize(data, null)] };
  if (data.type === "GeometryCollection") return { status: "ok", features: [{ kind: "collection" }] };
  return { status: "invalid", raw };
}

export interface GeolocationInputProps {
  id?: string;
  value: unknown;
  /** Editable status: adds the "needs a map" note (nothing can be edited here). */
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

/** A number kept left-to-right inside a right-to-left sentence (U+2066 … U+2069 isolate; a minus sign stays in front). */
const ltr = (n: number) => `\u2066${n}\u2069`;

const KIND_KEY = {
  point: "ftGeoPoint", circle: "ftGeoCircle", circlemarker: "ftGeoCircleMarker", line: "ftGeoLine", polygon: "ftGeoPolygon",
  multipoint: "ftGeoMultiPoint", multiline: "ftGeoMultiLine", multipolygon: "ftGeoMultiPolygon", collection: "ftGeoCollection", unknown: "ftGeoUnknown",
} as const;

export function GeolocationInput({ id, value, readOnly, className, ...aria }: GeolocationInputProps) {
  const { t } = useLocale();
  const parsed = React.useMemo(() => parseGeolocation(value), [value]);
  return (
    <div id={id} role="group" {...aria} className={cn("w-full space-y-1.5", className)} data-geolocation={parsed.status}>
      {parsed.status === "empty" ? (
        <div className="flex h-12 w-full items-center gap-2 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground">
          <MapPin className="size-4" aria-hidden />{t("ftGeoEmpty")}
        </div>
      ) : parsed.status === "invalid" ? (
        <div className="space-y-1">
          <p className="text-sm text-destructive" role="note">{t("ftGeoInvalid")}</p>
          <pre dir="ltr" className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 text-start font-mono text-xs" data-geolocation-raw="">{parsed.raw}</pre>
        </div>
      ) : (
        <div className="rounded-md border border-border">
          <p className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">{interpolate(t("ftGeoCount"), { count: parsed.features.length })}</p>
          <ul className="divide-y divide-border">
            {parsed.features.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-1.5 text-sm" data-geo-feature={f.kind}>
                <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-medium">{t(KIND_KEY[f.kind])}</span>
                {f.lat != null && f.lng != null && (
                  <span className="tabular-nums text-muted-foreground">{interpolate(t("ftGeoLatLng"), { lat: ltr(f.lat), lng: ltr(f.lng) })}</span>
                )}
                {f.radius != null && <span className="tabular-nums text-muted-foreground">{interpolate(t("ftGeoRadius"), { radius: Math.round(f.radius * 100) / 100 })}</span>}
                {f.vertices != null && <span className="tabular-nums text-muted-foreground">{interpolate(t("ftGeoVertices"), { count: f.vertices })}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!readOnly && <p className="text-xs text-muted-foreground" data-geolocation-no-map="">{t("ftGeoNoMap")}</p>}
    </div>
  );
}
