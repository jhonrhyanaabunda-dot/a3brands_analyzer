import { NextResponse } from "next/server";
import { updateLead, LEAD_STATUSES, type LeadStatus } from "@/app/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const status = body?.status;
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { ok: false, error: "invalid_status", allowed: LEAD_STATUSES },
      { status: 422 },
    );
  }

  try {
    const lead = await updateLead(id, { status: status as LeadStatus });
    if (!lead) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    console.error("PATCH /api/leads/[id] failed:", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
}
