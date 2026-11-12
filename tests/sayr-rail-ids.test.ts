/** 0.8.0-dev.1: the Sayr rail's card-id type is `SayrRailCardId`; `RecordRailCard` stays as a deprecated alias (typecheck
 *  covers the assignments below — tests/ is in tsconfig). The core `RecordRailCard` is the CRM rail's card component. */
import { describe, expect, it } from "vitest";
import { RECORD_RAIL_CARDS, railOrder, type RecordRailCard, type SayrRailCardId } from "../src/sayr";
import { RecordRailCard as CoreRecordRailCard } from "../src";

describe("Sayr rail card ids", () => {
  it("SayrRailCardId and the deprecated RecordRailCard alias are the same type", () => {
    const id: SayrRailCardId = "playbook";
    const legacy: RecordRailCard = id;
    const back: SayrRailCardId = legacy;
    const all: readonly SayrRailCardId[] = RECORD_RAIL_CARDS;
    expect(all).toContain(back);
    expect(railOrder()).toEqual([...RECORD_RAIL_CARDS]);
  });
  it("the core RecordRailCard is a component (a different entry, a different thing)", () => {
    expect(typeof CoreRecordRailCard).toBe("function");
  });
});
