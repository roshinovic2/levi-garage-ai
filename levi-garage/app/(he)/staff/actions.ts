"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getStaff, requireStaff, requireManager, screenPath } from "@/lib/staff/session"
import { notifyReady } from "@/lib/staff/notify"

// כל הפעולות של אזור הצוות עוברות כאן. הן רצות בשרת בזהות של המשתמש המחובר,
// ולכן ה-RLS והפונקציות במסד אוכפים אותן שוב, גם אם מישהו יקרא להן ישירות.

// הטופס עובד גם בלי JavaScript: הוא נשלח לשרת, והשגיאה חוזרת בכתובת.
// זה חשוב במוסך, על טלפון ישן ועל רשת איטית.
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim()
  const password = String(formData.get("password") || "")
  if (!email || !password) redirect("/staff/login?e=1")

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // בלוג של השרת רואים למה באמת. למשתמש אומרים הודעה אחת לכל סוגי הכישלון,
    // כדי לא להסגיר אילו כתובות קיימות.
    console.error("staff sign-in failed:", error.status, error.code, error.message)
    redirect("/staff/login?e=1")
  }

  // מכונאי נוחת ישר על הליפט שלו: זה כל המסך שהוא צריך. דניאל נוחת על הלוח,
  // ומשתמש של מסך תלוי נוחת על המסך שלו ולא זז משם.
  const staff = await getStaff()
  if (staff?.role === "display") redirect(screenPath(staff))
  redirect(staff?.role === "mechanic" ? "/staff/lift" : "/staff")
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
  revalidatePath("/staff/floor")
}

/** מעדכן מצב של כרטיס: בעבודה, ממתין לתשובה, מוכן, נמסר. */
export async function setJobStatus(formData: FormData) {
  await requireStaff()
  const id = Number(formData.get("job_id"))
  const status = String(formData.get("status") || "")
  if (!id || !["in_progress", "waiting_quote", "ready", "delivered", "cancelled"].includes(status)) return

  const supabase = await createClient()
  const patch: Record<string, unknown> = { status }
  if (status === "ready") {
    patch.ready_at = new Date().toISOString()
    // סיום טיפול מפנה את התא. הרכב יוצא לחצר וממתין ללקוח, והליפט חוזר
    // לתור: זה מה שמאפשר לרכב הבא לעלות. בלי זה התא נשאר "תפוס" על הנייר
    // עד שמישהו נזכר לשחרר אותו ידנית, וזה אף פעם לא קורה.
    patch.lift = null
  }
  if (status === "delivered") patch.delivered_at = new Date().toISOString()

  const { error } = await supabase.from("job_cards").update(patch).eq("id", id)

  // הלקוח יודע שהרכב מוכן בלי להתקשר. המסד בודק שוב שהכרטיס באמת "מוכן",
  // שיש הסכמה ושלא נשלח כבר, ולכן אין כאן בדיקות משלנו.
  if (!error && status === "ready") await notifyReady(supabase, id)

  revalidatePath("/staff")
  revalidatePath("/staff/floor")
  revalidatePath("/staff/lift")
  revalidatePath(`/staff/job/${id}`)
}

/** שולח שוב הודעת "מוכן" שנכשלה. המסד מאפשר זאת רק להודעה שנכשלה. */
export async function resendReadyNotice(formData: FormData) {
  await requireStaff()
  const id = Number(formData.get("job_id"))
  if (!id) return

  const supabase = await createClient()
  await notifyReady(supabase, id)

  revalidatePath(`/staff/job/${id}`)
}

/** מעלה רכב שממתין לליפט פנוי, או מוריד אותו ממנו. */
export async function assignLift(formData: FormData) {
  await requireStaff()
  const id = Number(formData.get("job_id"))
  const raw = String(formData.get("lift") || "")
  const lift = raw === "" ? null : Number(raw)
  if (!id || (lift !== null && ![1, 2, 3, 4].includes(lift))) return

  const supabase = await createClient()
  await supabase.from("job_cards").update({ lift }).eq("id", id)

  revalidatePath("/staff")
  revalidatePath("/staff/floor")
  revalidatePath("/staff/lift")
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
  revalidatePath("/staff/floor")
}

/** מכונאי לוקח לליפט שלו רכב שנפתח בלי שיוך. */
export async function takeCar(formData: FormData) {
  const staff = await requireStaff()
  const id = Number(formData.get("job_id"))
  if (!id || !staff.lift) return

  const supabase = await createClient()
  await supabase.from("job_cards").update({ lift: staff.lift }).eq("id", id).is("lift", null)

  revalidatePath("/staff/lift")
  revalidatePath("/staff")
  revalidatePath("/staff/floor")
}

/** המכונאי בוחר איפה הוא עובד עכשיו: ליפט 1 עד 4, או עמדת האבחון. */
export async function setMyLift(formData: FormData) {
  const staff = await requireStaff()
  const raw = String(formData.get("lift") || "")
  const lift = raw === "" ? null : Number(raw)
  if (lift !== null && ![1, 2, 3, 4].includes(lift)) return

  const supabase = await createClient()
  // דרך פונקציה במסד, שנוגעת רק בעמודת העמדה. עדכון ישיר של הטבלה היה מאפשר
  // למכונאי לשנות לעצמו גם את התפקיד.
  await supabase.rpc("set_my_lift", { p_lift: lift })

  revalidatePath("/staff/lift")
  revalidatePath("/staff")
  revalidatePath("/staff/floor")
}
