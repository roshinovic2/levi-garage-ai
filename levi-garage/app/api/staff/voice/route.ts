import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getStaff } from "@/lib/staff/session"
import { reportFromVoice } from "@/lib/staff/voice-report"

// ההודעה הקולית של המכונאי, מהכפתור בדף הליפט ועד טיוטה בכרטיס.
//
// הרכב לא נלקח מההקלטה אלא מהכרטיס (ממצא 2 ב-POC), ולכן הקלט היחיד שמגיע
// מהדפדפן הוא מזהה הכרטיס והאודיו. כל השאר נקרא מהמסד.

export const maxDuration = 90

const MAX_BYTES = 20 * 1024 * 1024

export async function POST(req: Request) {
  const staff = await getStaff()
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("audio")
  const jobId = Number(form?.get("job_id"))

  if (!(file instanceof Blob) || !Number.isFinite(jobId)) {
    return NextResponse.json({ error: "bad" }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "size" }, { status: 400 })
  }

  const supabase = await createClient()

  // RLS כבר חוסם כרטיס שלא שייך לצוות, אבל בלי הכרטיס אין הקשר לרכב.
  const { data: job } = await supabase
    .from("job_cards")
    .select("id, plate, vehicle_make, vehicle_model, vehicle_year, engine_code")
    .eq("id", jobId)
    .maybeSingle()
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 })

  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = file.type || "audio/webm"
  const path = `job-${job.id}/${Date.now()}.${mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm"}`

  // ההקלטה נשמרת לפני הניתוח: גם אם המודל ייפול, מה שהמכונאי אמר לא אובד.
  const upload = await supabase.storage.from("job-media").upload(path, bytes, { contentType: mime, upsert: false })
  if (upload.error) {
    console.error("voice upload failed:", upload.error.message)
    return NextResponse.json({ error: "upload" }, { status: 502 })
  }

  await supabase.from("media").insert({
    job_card_id: job.id,
    kind: "audio",
    storage_path: path,
    mime,
    bytes: bytes.length,
    created_by: staff.id,
  })

  let report
  try {
    report = await reportFromVoice(
      { data: bytes.toString("base64"), mime },
      {
        plate: job.plate,
        make: job.vehicle_make,
        model: job.vehicle_model,
        year: job.vehicle_year,
        engine: job.engine_code,
      },
    )
  } catch (e) {
    console.error("voice report failed:", (e as Error).message)
    // ההקלטה שמורה, ולכן אפשר לנסות שוב בלי לבקש מהמכונאי לדבר שוב.
    return NextResponse.json({ error: "model", saved: true }, { status: 502 })
  }

  const { data: finding, error } = await supabase
    .from("findings")
    .insert({
      job_card_id: job.id,
      source: "voice",
      transcript: report.transcript,
      summary: report.summary,
      customer_text: report.customer_text,
      price_original: report.price_original,
      price_aftermarket: report.price_aftermarket,
      eta: report.eta,
      red_list: report.red_list,
      model: report.model,
      created_by: staff.id,
      status: "draft",
    })
    .select("id")
    .single()

  if (error) {
    console.error("finding insert failed:", error.message)
    return NextResponse.json({ error: "save" }, { status: 502 })
  }

  await supabase.from("media").update({ finding_id: finding.id }).eq("storage_path", path)

  return NextResponse.json({
    ok: true,
    finding_id: finding.id,
    summary: report.summary,
    red_list: report.red_list,
    price_original: report.price_original,
    price_aftermarket: report.price_aftermarket,
  })
}
