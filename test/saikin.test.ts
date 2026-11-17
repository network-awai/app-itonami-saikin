import { describe, it, beforeEach } from "node:test";
import { expect } from "./expect.mjs";
import { LocalStore } from "../dist/local-store.js";
import { probeEnvironment, formColony, transferSignal, handoffToKi, lyse } from "../dist/domain/index.js";

describe("saikin horizontal transfer", () => {
  let e: any;
  beforeEach(async () => {
    e = new LocalStore({ did: "did:web:saikin.itonami.cloud" });
    await probeEnvironment(e, { probeId: "p1", site: "soil", signals: ["nitrogen", "pH6"] });
    await probeEnvironment(e, { probeId: "p2", site: "leaf", signals: ["light"] });
  });

  it("validates probes and seeds colonies from their site's probes", async () => {
    expect((await probeEnvironment(e, { probeId: "p3", site: "x", signals: [] })).error).toBe("noSignals");
    const c = await formColony(e, { colonyId: "a", site: "soil" });
    expect(c.status).toBe("formed");
    expect(c.signals.join(",")).toBe("nitrogen,pH6");
    expect((await formColony(e, { colonyId: "a", site: "soil" })).status).toBe("alreadyExists");
    expect((await formColony(e, { colonyId: "b", site: "sea" })).error).toBe("siteNotProbed");
  });

  it("transfers a carried signal between living colonies once", async () => {
    await formColony(e, { colonyId: "a", site: "soil" });
    await formColony(e, { colonyId: "b", site: "leaf" });
    const t = await transferSignal(e, { transferId: "t1", fromColony: "a", toColony: "b", signal: "nitrogen" });
    expect(t.status).toBe("transferred");
    expect(t.recipientSignals.join(",")).toBe("light,nitrogen");
    expect((await transferSignal(e, { transferId: "t2", fromColony: "a", toColony: "b", signal: "nitrogen" })).status).toBe("alreadyCarried");
    expect((await transferSignal(e, { transferId: "t3", fromColony: "b", toColony: "a", signal: "uv" })).error).toBe("donorLacksSignal");
    expect((await transferSignal(e, { transferId: "t4", fromColony: "a", toColony: "a", signal: "pH6" })).error).toBe("sameColony");
  });

  it("lysed colonies release signals and stop transferring or handing off", async () => {
    await formColony(e, { colonyId: "a", site: "soil" });
    await formColony(e, { colonyId: "b", site: "leaf" });
    const l = await lyse(e, { colonyId: "a" });
    expect(l.released.length).toBe(2);
    expect((await lyse(e, { colonyId: "a" })).status).toBe("alreadyLysed");
    expect((await transferSignal(e, { transferId: "t1", fromColony: "a", toColony: "b", signal: "pH6" })).error).toBe("colonyLysed");
    expect((await handoffToKi(e, { colonyId: "a" })).error).toBe("colonyLysed");
  });

  it("packages a living colony as a Ki absorb input without sending it", async () => {
    await formColony(e, { colonyId: "a", site: "soil" });
    const h = await handoffToKi(e, { colonyId: "a" });
    expect(h.status).toBe("ready");
    expect(h.kiAbsorbInput.inputKind).toBe("transfer");
    expect(h.kiAbsorbInput.content).toBe("nitrogen\npH6");
    expect((await handoffToKi(e, { colonyId: "zz" })).error).toBe("colonyNotFound");
  });
});
