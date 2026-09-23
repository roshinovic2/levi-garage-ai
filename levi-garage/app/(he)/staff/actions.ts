"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requireStaff, requireManager } from "@/lib/staff/session"

// כל הפעולות של אזור הצוות עוברות כאן. הן רצות בשרת בזהות של המשתמש המחובר,
// ולכן ה-RLS והפונקציות במסד אוכפים אותן שוב, גם אם מישהו יקרא להן ישירות.

export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim()
  const password = String(formData.get("password") || "")
  if (!email || !password) return { error: "צריך אימייל וסיסמה." }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // בלוג של השרת רואים למה באמת. למשתמש אומרים הודעה אחת לכל סוגי הכישלון,
    // כדי לא להסגיר אילו כתובות קיימות.
    console.error("staff sign-in failed:", error.status, error.code, error.message)
    return { error: "האימייל או הסיסמה לא נכונים." }
  }

  redirect("/staff")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/staff/login")
}

/** פותח כרטיס עבודה לרכב שהגיע, מתוך תור קיים. */
export async function openJobCard(formData: FormData) {
  const staff = await requireStaff()
  const bookingId = Number(formData.get("booking_id"))
  const lift = Number(formData.get("lift")) || null
  if (!bookingId) return

  const supabase = await createClient()
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, plate, customer_name, customer_phone, whatsapp_consent, vehicle_make, vehicle_model, vehicle_year, engine_code, fuel")
    .eq("id", bookingId)
    .maybeSingle()
  if (!booking) return

  await supabase.from("job_cards").insert({
    booking_id: booking.id,
    plate: booking.plate,
    vehicle_make: booking.vehicle_make,
    vehicle_model: booking.vehicle_model,
    vehicle_year: booking.vehicle_year,
    engine_code: booking.engine_code,
    fuel: booking.fuel,
    customer_name: booking.customer_name,
    customer_phone: booking.customer_phone,
    whatsapp_consent: booking.whatsapp_consent ?? false,
    lift,
    status: "in_progress",
    opened_by: staff.id,
  })

  await supabase.from("bookings").update({ status: "arrived" }).eq("id", booking.id)

  revalidatePath("/staff")
}

/** מעדכן מצב של כרטיס: בעבודה, מוכן, נמסר. */
export async function setJobStatus(formData: FormData) {
  await requireStaff()
  const id = Number(formData.get("job_id"))
  const status = String(formData.get("status") || "")
  if (!id || !["in_progress", "ready", "delivered", "cancelled"].includes(status)) return

  const supabase = await createClient()
  const patch: Record<string, unknown> = { status }
  if (status === "ready") patch.ready_at = new Date().toISOString()
  if (status === "delivered") patch.delivered_at = new Date().toISOString()

  await supabase.from("job_cards").update(patch).eq("id", id)

  revalidatePath("/staff")
  revalidatePath(`/staff/job/${id}`)
}

/** שולח ממצא ללקוח. המסד בודק שוב שהשולח הוא מנהל עבודה או בעלים. */
export async function sendFinding(formData: FormData) {
  await requireManager()
  const findingId = Number(formData.get("finding_id"))
  const message = String(formData.get("message") || "").trim()
  const jobId = Number(formData.get("job_id"))
  if (!findingId || !message) return

  const supabase = await createClient()

  // הנוסח שאדם ראה ואישור הוא הנוסח שנשמר, ולכן מעדכנים גם את הטיוטה.
  await supabase.from("findings").update({ customer_text: message }).eq("id", findingId)
  await supabase.rpc("send_finding", { p_finding_id: findingId, p_message: message, p_channel: "link" })

  revalidatePath(`/staff/job/${jobId}`)
  revalidatePath("/staff")
}
