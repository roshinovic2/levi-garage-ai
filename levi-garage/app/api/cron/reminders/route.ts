import { NextResponse } from "next/server"

import { sendDueReminders } from "@/lib/staff/notify"

// המשימה היומית של Vercel (vercel.json): תזכורת בוואטסאפ לכל מי שיש לו תור
// מחר. Vercel שולח את CRON_SECRET בכותרת; בלעדיו, או בלי המשתנה, הדלת סגורה.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return NextResponse.json(await sendDueReminders())
}
