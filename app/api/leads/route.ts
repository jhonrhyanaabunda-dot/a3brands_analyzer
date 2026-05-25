import { NextResponse } from "next/server";
import { addLead, clearLeads, findDuplicateLead, listLeads, LEAD_STATUSES, type LeadStatus } from "@/app/lib/storage";

// Force this route to run in the Node runtime (we need fs).
export const runtime = "nodejs";
// Always re-evaluate — this is mutable data.
export const dynamic = "force-dynamic";

function s(v: unknown, max = 500): string {
  return String(v ?? "").trim().slice(0, max);
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const leads = await listLeads();
    return NextResponse.json({ ok: true, leads });
  } catch (err) {
    console.error("GET /api/leads failed:", err);
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Minimal validation. The client already validates; we just refuse empty contact info.
  const name = s(body.name);
  const dealership = s(body.dealership);
  const email = s(body.email);
  const phone = s(body.phone);
  if (!name || !dealership || !email || !phone) {
    return NextResponse.json(
      { ok: false, error: "missing_contact_fields" },
      { status: 422 },
    );
  }

  const requestedStatus = (LEAD_STATUSES as readonly string[]).includes(body.status)
    ? (body.status as LeadStatus)
    : undefined;

  const dup = await findDuplicateLead(email, name);
  if (dup) {
    return NextResponse.json(
      { ok: false, error: "duplicate", field: dup },
      { status: 409 },
    );
  }

  const CITY_CONFIDENCE_VALUES = ["high", "mid", "low", "manual"] as const;
  type CityConfidence = (typeof CITY_CONFIDENCE_VALUES)[number];
  const cityConfidence = CITY_CONFIDENCE_VALUES.includes(body.cityConfidence as CityConfidence)
    ? (body.cityConfidence as CityConfidence)
    : undefined;

  try {
    const lead = await addLead({
      name,
      dealership,
      email,
      phone,
      url: s(body.url, 1000),
      city: s(body.city, 200),
      make: s(body.make, 80),
      estimatedRank: num(body.estimatedRank),
      monthlyDamage: num(body.monthlyDamage),
      monthlyLostLeads: num(body.monthlyLostLeads),
      monthlyLostClicks: num(body.monthlyLostClicks),
      yourScores: body.yourScores ?? null,
      competitorScores: Array.isArray(body.competitorScores) ? body.competitorScores : [],
      status: requestedStatus,
      cityConfidence,
    });
    return NextResponse.json({ ok: true, lead }, { status: 201 });
  } catch (err) {
    console.error("POST /api/leads failed:", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearLeads();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/leads failed:", err);
    return NextResponse.json({ ok: false, error: "clear_failed" }, { status: 500 });
  }
}
