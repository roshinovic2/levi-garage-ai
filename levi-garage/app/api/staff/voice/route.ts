import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getStaff } from "@/lib/staff/session"
import { createFindingFromAudio } from "@/lib/staff/make-finding"

// ההודעה הקולית של המכונאי, מהכפתור בדף הליפט ועד טיוטה בכרטיס.
//
// הרכב לא נלקח מההקלטה אלא מהכרטיס (ממצא 2 ב-POC), ולכן הקלט היחיד שמגיע
// מהדפדפן הוא מזהה הכרטיס והאודיו. כל השאר נקרא מהמסד.

export const maxDuration = 90

const MAX_BYTES = 20 * 1024 * 1024

// הדלי משווה mime כמחרוזת מדויקת, והדפדפן שולח "audio/webm;codecs=opus".
// בלי הניקוי הזה ההעלאה נדחית, המכונאי רואה "לא הצלחנו לשמור", ומה שאמר
// באמת אובד — בדיוק המקרה שכל המסלול נבנה כדי למנוע.
const ALLOWED_AUDIO = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"]

function audioMime(raw: string) {
  const base = (raw || "").split(";")[0].trim().toLowerCase()
  if (ALLOWED_AUDIO.includes(base)) return base
  // כינויים שמכשירים שולחים לאותם פורמטים בדיוק.
  if (base === "audio/x-m4a" || base === "audio/aac" || base === "audio/m4a") return "audio/mp4"
  if (base === "audio/x-wav" || base === "audio/wave") return "audio/wav"
  if (base === "audio/mp3") return "audio/mpeg"
  return "audio/webm"
}

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
  const mime = audioMime(file.type)
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

  try {
    const { finding_id, report } = await createFindingFromAudio({
      supabase,
      job,
      bytes,
      mime,
      staffId: staff.id,
      storagePath: path,
    })
    return NextResponse.json({
      ok: true,
      finding_id,
      summary: report.summary,
      red_list: report.red_list,
      price_original: report.price_original,
      price_aftermarket: report.price_aftermarket,
    })
  } catch (e) {
    console.error("voice report failed:", (e as Error).message)
    // ההקלטה שמורה, ולכן אפשר לנסות שוב מהכרטיס בלי לבקש מהמכונאי לדבר שוב.
    return NextResponse.json({ error: "model", saved: true }, { status: 502 })
  }
}
