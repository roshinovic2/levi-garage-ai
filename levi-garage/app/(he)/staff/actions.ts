"use server"

import { randomBytes } from "node:crypto"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getStaff, requireStaff, requireManager } from "@/lib/staff/session"

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

  // מכונאי נוחת ישר על הליפט שלו: זה כל המסך שהוא צריך. דניאל נוחת על הלוח.
  const staff = await getStaff()
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

  await supabase.from("job_cards").update(patch).eq("id", id)

  revalidatePath("/staff")
  revalidatePath("/staff/floor")
  revalidatePath("/staff/lift")
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

/**
 * המסכים התלויים. הטוקן הוא כל ההגנה של מסך חדר ההמתנה, ולכן חייבת להיות
 * דרך לבטל אותו בלחיצה: אם מישהו צילם את הכתובת, או שהמסך הוחלף, דניאל לא
 * אמור לפתוח SQL כדי לסגור אותה.
 */
function newToken() {
  return randomBytes(18).toString("hex")
}

export async function addDisplay(formData: FormData) {
  await requireManager()
  const name = String(formData.get("name") || "").trim()
  if (!name) return

  const supabase = await createClient()
  await supabase.from("displays").insert({ kind: "lobby", name, token: newToken() })

  revalidatePath("/staff/screens")
  revalidatePath("/staff/floor")
}

/** מנפיק קישור חדש. מהרגע הזה הכתובת הישנה מפסיקה לעבוד. */
export async function rotateDisplayToken(formData: FormData) {
  await requireManager()
  const id = Number(formData.get("display_id"))
  if (!id) return

  const supabase = await createClient()
  await supabase.from("displays").update({ token: newToken() }).eq("id", id)

  revalidatePath("/staff/screens")
  revalidatePath("/staff/floor")
}

/** מכבה או מדליק מסך. מסך כבוי מציג "הקישור לא בתוקף". */
export async function setDisplayActive(formData: FormData) {
  await requireManager()
  const id = Number(formData.get("display_id"))
  const active = String(formData.get("active")) === "1"
  if (!id) return

  const supabase = await createClient()
  await supabase.from("displays").update({ active }).eq("id", id)

  revalidatePath("/staff/screens")
  revalidatePath("/staff/floor")
}
