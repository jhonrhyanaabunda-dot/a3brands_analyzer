// Supabase-backed lead store.
//
// The public surface (Lead, LeadStatus, LEAD_STATUSES, DuplicateField,
// listLeads, addLead, updateLead, findDuplicateLead, clearLeads) is the
// same one the JSON-file version exposed, so the API routes and UI need
// zero changes.

import { supabase } from "./supabase";

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
  // Captured on the interactive intro (Stage 2). Optional for backward compat
  // with rows written before these columns existed.
  goal?: string;
  rival?: string;
  // Sales-side QA hint: did the user confirm an auto-extracted city, edit
  // one, or type from scratch? Optional for backward compat with old rows.
  cityConfidence?: "high" | "mid" | "low" | "manual";
  // Outcome snapshot (so sales can sort/filter without re-running the audit)
  estimatedRank: number | null;
  monthlyDamage: number | null;
  monthlyLostLeads: number | null;
  monthlyLostClicks: number | null;
  yourScores: unknown;
  competitorScores: unknown;
};

export type DuplicateField = "email" | "name";

type Row = {
  id: string;
  ts: number;
  status: LeadStatus;
  name: string;
  dealership: string;
  email: string;
  phone: string;
  url: string;
  city: string;
  make: string;
  goal: string | null;
  rival: string | null;
  city_confidence: Lead["cityConfidence"] | null;
  estimated_rank: number | null;
  monthly_damage: number | null;
  monthly_lost_leads: number | null;
  monthly_lost_clicks: number | null;
  your_scores: unknown;
  competitor_scores: unknown;
};

function rowToLead(r: Row): Lead {
  return {
    id: r.id,
    ts: Number(r.ts),
    status: r.status,
    name: r.name,
    dealership: r.dealership,
    email: r.email,
    phone: r.phone,
    url: r.url,
    city: r.city,
    make: r.make,
    goal: r.goal ?? undefined,
    rival: r.rival ?? undefined,
    cityConfidence: r.city_confidence ?? undefined,
    estimatedRank: r.estimated_rank,
    monthlyDamage: r.monthly_damage,
    monthlyLostLeads: r.monthly_lost_leads,
    monthlyLostClicks: r.monthly_lost_clicks,
    yourScores: r.your_scores,
    competitorScores: r.competitor_scores,
  };
}

type InsertRow = Omit<Row, "id">;

function leadToInsert(input: Omit<Lead, "id" | "ts" | "status"> & { status?: LeadStatus }): InsertRow {
  return {
    ts: Date.now(),
    status: input.status ?? "pending",
    name: input.name,
    dealership: input.dealership,
    email: input.email,
    phone: input.phone,
    url: input.url,
    city: input.city,
    make: input.make,
    goal: input.goal ?? null,
    rival: input.rival ?? null,
    city_confidence: input.cityConfidence ?? null,
    estimated_rank: input.estimatedRank,
    monthly_damage: input.monthlyDamage,
    monthly_lost_leads: input.monthlyLostLeads,
    monthly_lost_clicks: input.monthlyLostClicks,
    your_scores: input.yourScores,
    competitor_scores: input.competitorScores,
  };
}

// Case-insensitive duplicate check against the existing leads list.
// Returns which field collided so the UI can show a specific message.
// Backed by the partial unique indexes on lower(trim(email)) / lower(trim(name)).
export async function findDuplicateLead(email: string, name: string): Promise<DuplicateField | null> {
  const e = email.trim().toLowerCase();
  const n = name.trim().toLowerCase();
  if (e) {
    const { data, error } = await supabase.from("leads").select("id").eq("email_lc", e).limit(1);
    if (error) throw error;
    if (data && data.length) return "email";
  }
  if (n) {
    const { data, error } = await supabase.from("leads").select("id").eq("name_lc", n).limit(1);
    if (error) throw error;
    if (data && data.length) return "name";
  }
  return null;
}

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("ts", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => rowToLead(r as Row));
}

export async function addLead(input: Omit<Lead, "id" | "ts" | "status"> & { status?: LeadStatus }): Promise<Lead> {
  const row = leadToInsert(input);
  const { data, error } = await supabase.from("leads").insert(row).select("*").single();
  if (error) throw error;
  return rowToLead(data as Row);
}

export async function updateLead(id: string, patch: Partial<Pick<Lead, "status">>): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .update({ status: patch.status })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLead(data as Row) : null;
}

export async function clearLeads(): Promise<void> {
  const { error } = await supabase.from("leads").delete().not("id", "is", null);
  if (error) throw error;
}
