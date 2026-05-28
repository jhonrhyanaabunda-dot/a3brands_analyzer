// One-shot: copy rows from data/leads.json into the Supabase `leads` table.
// Run once after the schema is created: `npx tsx scripts/backfill-leads.ts`.
// Idempotent via upsert on `id`.

import { config as loadEnv } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const raw = await fs.readFile(path.join(process.cwd(), "data/leads.json"), "utf8");
  const leads = JSON.parse(raw) as Array<Record<string, unknown>>;

  // Schema enforces unique (lower(trim(email))) and unique (lower(trim(name))).
  // Local dev data has dupes — keep the newest row per email and per name.
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
  const byEmail = new Map<string, Record<string, unknown>>();
  for (const l of [...leads].sort((a, b) => Number(b.ts) - Number(a.ts))) {
    const k = norm(l.email);
    if (k && !byEmail.has(k)) byEmail.set(k, l);
  }
  const byName = new Map<string, Record<string, unknown>>();
  const deduped: Array<Record<string, unknown>> = [];
  for (const l of byEmail.values()) {
    const k = norm(l.name);
    if (k && byName.has(k)) continue;
    if (k) byName.set(k, l);
    deduped.push(l);
  }

  const rows = deduped.map((l) => ({
    id: l.id,
    ts: l.ts,
    status: l.status ?? "pending",
    name: l.name,
    dealership: l.dealership,
    email: l.email,
    phone: l.phone,
    url: l.url ?? "",
    city: l.city ?? "",
    make: l.make ?? "",
    city_confidence: l.cityConfidence ?? null,
    estimated_rank: l.estimatedRank,
    monthly_damage: l.monthlyDamage,
    monthly_lost_leads: l.monthlyLostLeads,
    monthly_lost_clicks: l.monthlyLostClicks,
    your_scores: l.yourScores ?? null,
    competitor_scores: l.competitorScores ?? null,
  }));

  const { error } = await sb.from("leads").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`Inserted ${rows.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
