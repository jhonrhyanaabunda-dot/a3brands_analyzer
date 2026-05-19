// JSON-file-backed lead store.
//
// Phase 1: single-process dev server, single JSON file. Survives across
// browsers and across sales-rep machines (anyone hitting this server).
// Phase 2 swap: replace the four exported functions with a Supabase
// client and nothing else has to change — the route + UI keep working.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type LeadStatus = "pending" | "confirmed" | "cancelled";
export const LEAD_STATUSES: readonly LeadStatus[] = ["pending", "confirmed", "cancelled"] as const;

export type Lead = {
  id: string;
  ts: number;
  status: LeadStatus;
  // Contact (from the lead-cap form)
  name: string;
  dealership: string;
  email: string;
  phone: string;
  // Audit context (carried from earlier in the funnel)
  url: string;
  city: string;
  make: string;
  // Outcome snapshot (so sales can sort/filter without re-running the audit)
  estimatedRank: number | null;
  monthlyDamage: number | null;
  monthlyLostLeads: number | null;
  monthlyLostClicks: number | null;
  yourScores: unknown;
  competitorScores: unknown;
};

const DATA_DIR = path.join(process.cwd(), "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

// Minimal in-process mutex so concurrent POSTs don't clobber each other.
// For one process this is enough; for multi-instance we'd move to a DB anyway.
let writeChain: Promise<void> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(LEADS_FILE);
  } catch {
    await fs.writeFile(LEADS_FILE, "[]", "utf8");
  }
}

async function readAll(): Promise<Lead[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(LEADS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch (err) {
    console.warn("leads.json read/parse failed, returning empty list:", err);
    return [];
  }
}

async function writeAll(list: Lead[]): Promise<void> {
  await ensureFile();
  const tmp = LEADS_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, LEADS_FILE);
}

export type DuplicateField = "email" | "name";

// Case-insensitive duplicate check against the existing leads list.
// Returns which field collided so the UI can show a specific message.
export async function findDuplicateLead(email: string, name: string): Promise<DuplicateField | null> {
  const list = await readAll();
  const e = email.trim().toLowerCase();
  const n = name.trim().toLowerCase();
  for (const l of list) {
    if (e && (l.email || "").trim().toLowerCase() === e) return "email";
  }
  for (const l of list) {
    if (n && (l.name || "").trim().toLowerCase() === n) return "name";
  }
  return null;
}

export async function listLeads(): Promise<Lead[]> {
  const list = await readAll();
  // Backfill status for any rows written before the status field existed.
  const normalized = list.map((l) => ({ ...l, status: l.status ?? "pending" }));
  return [...normalized].sort((a, b) => b.ts - a.ts);
}

export async function addLead(input: Omit<Lead, "id" | "ts" | "status"> & { status?: LeadStatus }): Promise<Lead> {
  return withLock(async () => {
    const list = await readAll();
    const lead: Lead = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      status: input.status ?? "pending",
      ...input,
    };
    list.unshift(lead);
    if (list.length > 1000) list.length = 1000;
    await writeAll(list);
    return lead;
  });
}

export async function updateLead(id: string, patch: Partial<Pick<Lead, "status">>): Promise<Lead | null> {
  return withLock(async () => {
    const list = await readAll();
    const idx = list.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const next: Lead = { ...list[idx], ...patch };
    list[idx] = next;
    await writeAll(list);
    return next;
  });
}

export async function clearLeads(): Promise<void> {
  return withLock(async () => {
    await writeAll([]);
  });
}
