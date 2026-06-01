import "server-only";

// Gate for the privileged lead endpoints (read / clear / status-change).
// The public funnel only ever POSTs new leads, so POST stays open; everything
// that exposes or mutates captured PII (GET / DELETE / PATCH) must pass this.
//
// The shared secret lives in ADMIN_TOKEN (server-only env). A request proves it
// via either `Authorization: Bearer <token>` or the `sales_token` cookie.
//
// Fail-closed: if ADMIN_TOKEN is unset we deny every privileged request rather
// than silently leaving the lead table world-readable. Set ADMIN_TOKEN in the
// environment (see .env.example) to turn the sales console back on.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function tokenFromRequest(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();

  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)sales_token=([^;]+)/);
  if (m) return decodeURIComponent(m[1]).trim();

  return "";
}

export function isAuthorized(req: Request): boolean {
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return false; // fail-closed when no secret is configured
  const provided = tokenFromRequest(req);
  if (!provided) return false;
  return timingSafeEqual(provided, expected);
}
