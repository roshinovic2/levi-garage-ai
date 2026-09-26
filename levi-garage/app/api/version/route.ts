import { NextResponse } from "next/server"

// איזו בנייה רצה עכשיו בשרת. ראו next.config.mjs ו-components/staff/auto-refresh.tsx.
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json({ build: process.env.APP_BUILD ?? "" }, { headers: { "cache-control": "no-store" } })
}
