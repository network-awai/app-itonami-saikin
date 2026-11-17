/**
 * saikin (細菌, bacteria) — horizontal transfer layer, local domain (AWAI-3079).
 *
 * Designed from the former Worker's method list (probeEnvironment /
 * transferSignal / formColony / handoffToKi / lyse); the original logic ran on
 * a remote LangServer and was not in this repository.
 *
 *   colony    : a living colony at a site, carrying a set of signals (like
 *               plasmids). New colonies start with the signals probed at their
 *               site.
 *   probe     : an environment reading (site + signals) that seeds colonies.
 *   transfer  : horizontal transfer copies one signal from a living donor
 *               colony to a living recipient (conjugation). Each is recorded.
 *   handoff   : packages a colony's signals as a Ki "absorb" input (kind
 *               "transfer"). The app does not send it anywhere; the result is
 *               shown so it can be entered in Ki.
 *   lyse      : the colony dies and releases its signals; it can no longer
 *               transfer or be handed off.
 */
import type { LocalStore } from "../local-store.js";
import { getOne, idSlug, isNonEmpty, listAll, nowISO, put } from "./records.js";

export const COLONY = "cloud.itonami.apps.saikin.colony";
export const PROBE = "cloud.itonami.apps.saikin.probe";
export const TRANSFER = "cloud.itonami.apps.saikin.transfer";

export interface Colony { colonyId: string; site: string; signals: string[]; state: "alive" | "lysed"; createdAt: string; lysedAt?: string; released?: string[] }
export interface Probe { probeId: string; site: string; signals: string[]; probedAt: string }

export interface ProbeEnvironmentInput { probeId: string; site: string; signals: string[] }
export interface FormColonyInput { colonyId: string; site: string }
export interface TransferSignalInput { transferId: string; fromColony: string; toColony: string; signal: string }
export interface HandoffToKiInput { colonyId: string }
export interface LyseInput { colonyId: string }

const colonyKey = (id: string) => `colony-${idSlug(id)}`;
const clean = (xs: unknown) => (Array.isArray(xs) ? [...new Set(xs.map((x) => String(x).trim()).filter(Boolean))].sort() : []);

export async function probeEnvironment(e: LocalStore, input: ProbeEnvironmentInput) {
  const signals = clean(input.signals);
  if (!isNonEmpty(input.probeId) || !isNonEmpty(input.site)) return { status: "rejected", error: "missingRequiredFields" };
  if (signals.length === 0) return { status: "rejected", error: "noSignals" };
  const probe: Probe = { probeId: input.probeId, site: input.site.trim(), signals, probedAt: nowISO() };
  await put(e, PROBE, `probe-${idSlug(input.probeId)}`, probe);
  return { status: "probed", site: probe.site, signals };
}

export async function formColony(e: LocalStore, input: FormColonyInput) {
  if (!isNonEmpty(input.colonyId) || !isNonEmpty(input.site)) return { status: "rejected", error: "missingRequiredFields" };
  if (await getOne(e, COLONY, colonyKey(input.colonyId))) return { status: "alreadyExists" };
  const site = input.site.trim();
  const probes = (await listAll<Probe>(e, PROBE)).map((r) => r.value).filter((p) => p.site === site);
  if (probes.length === 0) return { status: "rejected", error: "siteNotProbed" };
  const colony: Colony = { colonyId: input.colonyId, site, signals: clean(probes.flatMap((p) => p.signals)), state: "alive", createdAt: nowISO() };
  return { status: "formed", colonyUri: await put(e, COLONY, colonyKey(input.colonyId), colony), signals: colony.signals };
}

export async function transferSignal(e: LocalStore, input: TransferSignalInput) {
  if (![input.transferId, input.fromColony, input.toColony, input.signal].every(isNonEmpty)) return { status: "rejected", error: "missingRequiredFields" };
  if (input.fromColony === input.toColony) return { status: "rejected", error: "sameColony" };
  const donor = await getOne<Colony>(e, COLONY, colonyKey(input.fromColony));
  const recipient = await getOne<Colony>(e, COLONY, colonyKey(input.toColony));
  if (!donor || !recipient) return { status: "rejected", error: "colonyNotFound" };
  if (donor.value.state !== "alive" || recipient.value.state !== "alive") return { status: "rejected", error: "colonyLysed" };
  const signal = input.signal.trim();
  if (!donor.value.signals.includes(signal)) return { status: "rejected", error: "donorLacksSignal" };
  const already = recipient.value.signals.includes(signal);
  if (!already) await put(e, COLONY, colonyKey(input.toColony), { ...recipient.value, signals: clean([...recipient.value.signals, signal]) });
  await put(e, TRANSFER, `transfer-${idSlug(input.transferId)}`, { ...input, signal, newToRecipient: !already, transferredAt: nowISO() });
  return { status: already ? "alreadyCarried" : "transferred", signal, recipientSignals: already ? recipient.value.signals : clean([...recipient.value.signals, signal]) };
}

export async function handoffToKi(e: LocalStore, input: HandoffToKiInput) {
  const colony = isNonEmpty(input.colonyId) ? await getOne<Colony>(e, COLONY, colonyKey(input.colonyId)) : null;
  if (!colony) return { status: "rejected", error: "colonyNotFound" };
  if (colony.value.state !== "alive") return { status: "rejected", error: "colonyLysed" };
  if (colony.value.signals.length === 0) return { status: "rejected", error: "noSignals" };
  return {
    status: "ready",
    note: "Ki の「吸収する (absorb)」に入力できる形です。この app からは送信しません。",
    kiAbsorbInput: { absorbId: `saikin-${idSlug(input.colonyId)}`, sourceVertexId: `saikin:${input.colonyId}`, inputKind: "transfer", content: colony.value.signals.join("\n") },
  };
}

export async function lyse(e: LocalStore, input: LyseInput) {
  const colony = isNonEmpty(input.colonyId) ? await getOne<Colony>(e, COLONY, colonyKey(input.colonyId)) : null;
  if (!colony) return { status: "rejected", error: "colonyNotFound" };
  if (colony.value.state === "lysed") return { status: "alreadyLysed" };
  await put(e, COLONY, colonyKey(input.colonyId), { ...colony.value, state: "lysed", lysedAt: nowISO(), released: colony.value.signals });
  return { status: "lysed", released: colony.value.signals };
}
