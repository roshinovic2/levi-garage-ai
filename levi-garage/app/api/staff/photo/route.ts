import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getStaff } from "@/lib/staff/session"

// תמונה מהכרטיס. אותו מסלול של ההקלטה, בלי מודל: מצלמים, נשמר, מופיע בכרטיס.
//
// למה אין כאן ניתוח AI של התמונה: מה שהובטח ללקוח הוא "המכונאי מצלם ומקליט",
// כדי **שדניאל והלקוח יראו** את הרפידה השחוקה. אבחון מהתמונה הוא הבטחה אחרת
// לגמרי, ומי שמבטיח אותה צריך גם לקחת אחריות על טעות. לכן לא כאן.

export const maxDuration = 30

const MAX_BYTES = 12 * 1024 * 1024
const ALLOWED = ["image/jpeg", "image/png", "image/webp"]

export async function POST(req: Request) {
  const staff = await getStaff()
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const jobId = Number(form?.get("job_id"))
  const files = (form?.getAll("photo") ?? []).filter((f): f is File => f instanceof File)

  if (!Number.isFinite(jobId) || files.length === 0) {
    return NextResponse.json({ error: "bad" }, { status: 400 })
  }
  if (files.length > 6) return NextResponse.json({ error: "too many" }, { status: 400 })

  const supabase = await createClient()

  const { data: job } = await supabase.from("job_cards").select("id").eq("id", jobId).maybeSingle()
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 })

  let saved = 0
  for (const file of files) {
    // אותו סיפור כמו באודיו: הדלי משווה מחרוזת מדויקת, ויש מכשירים ששולחים
    // "image/jpg" או mime עם פרמטרים.
    const base = (file.type || "").split(";")[0].trim().toLowerCase()
    const mime = base === "image/jpg" ? "image/jpeg" : base || "image/jpeg"
    if (!ALLOWED.includes(mime)) continue
    if (file.size === 0 || file.size > MAX_BYTES) continue

    const bytes = Buffer.from(await file.arrayBuffer())
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"
    const path = `job-${job.id}/photo-${Date.now()}-${saved}.${ext}`

    const upload = await supabase.storage.from("job-media").upload(path, bytes, { contentType: mime, upsert: false })
    if (upload.error) {
      console.error("photo upload failed:", upload.error.message)
      continue
    }

    const { error } = await supabase.from("media").insert({
      job_card_id: job.id,
      kind: "photo",
      storage_path: path,
      mime,
      bytes: bytes.length,
      created_by: staff.id,
    })
    if (error) {
      console.error("photo row failed:", error.message)
      continue
    }
    saved++
  }

  if (saved === 0) return NextResponse.json({ error: "none" }, { status: 502 })
  return NextResponse.json({ ok: true, saved })
}
