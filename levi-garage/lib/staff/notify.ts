import type { SupabaseClient } from "@supabase/supabase-js"

// "הרכב מוכן": ההודעה שמחליפה את 25–35 שיחות "מתי מוכן" ביום.
//
// רק הבוט מחזיק את קו הוואטסאפ, ולכן האתר לא שולח בעצמו — הוא מבקש מהבוט.
// הבוט מחליט על הנוסח, ושולח רק למספרים ברשימה שלו (ראו lib/garage.js במאגר
// של הבוט). כאן: לתפוס את ההודעה במסד, לבקש, ולרשום מה קרה.
//
// כלום כאן לא זורק. כישלון בשליחה לא אמור לבטל את זה שהרכב מוכן: הכרטיס
// זז, והצוות רואה בכרטיס שההודעה לא יצאה ולמה.

const TIMEOUT_MS = 10_000

/** 050-1234567 או +972 50 123 4567 → 972501234567. כל דבר אחר: null. */
export function toWaNumber(phone: string | null | undefined): string | null {
  const d = String(phone ?? "").replace(/\D/g, "")
  if (/^0\d{8,9}$/.test(d)) return `972${d.slice(1)}`
  if (/^972\d{8,9}$/.test(d)) return d
  return null
}

type Claim = {
  id: number
  send: boolean
  phone?: string | null
  name?: string | null
  make?: string | null
  model?: string | null
  plate?: string | null
}

type Outcome = { status: "sent" | "failed" | "skipped"; reason?: string }

async function ask(claim: Claim, to: string): Promise<Outcome> {
  const url = process.env.GARAGE_NOTIFY_URL
  const token = process.env.GARAGE_NOTIFY_TOKEN
  if (!url || !token) return { status: "skipped", reason: "not_wired" }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-garage-notify-token": token },
      body: JSON.stringify({
        kind: "ready",
        to,
        // שם פרטי בלבד. ההודעה לא צריכה יותר, והבוט לא צריך לדעת יותר.
        name: String(claim.name ?? "").trim().split(/\s+/)[0] || "",
        car: [claim.make, claim.model].filter(Boolean).join(" "),
        plateTail: String(claim.plate ?? "").replace(/\D/g, "").slice(-3),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const json = (await res.json().catch(() => null)) as { sent?: boolean; reason?: string } | null
    if (res.ok && json?.sent) return { status: "sent" }
    if (res.ok && json?.reason) return { status: "skipped", reason: json.reason }
    return { status: "failed", reason: json?.reason || `http_${res.status}` }
  } catch {
    return { status: "failed", reason: "unreachable" }
  }
}

/** אחרי שכרטיס עבר ל"מוכן". בטוח לקרוא פעמיים: המסד תופס פעם אחת. */
export async function notifyReady(supabase: SupabaseClient, jobId: number): Promise<void> {
  // לא מחובר עדיין: לא תופסים כלום, כדי שכשיחברו, הכרטיס הבא יישלח כרגיל.
  if (!process.env.GARAGE_NOTIFY_URL || !process.env.GARAGE_NOTIFY_TOKEN) return

  const { data, error } = await supabase.rpc("claim_ready_notice", { p_job_id: jobId })
  if (error) {
    console.error("claim_ready_notice failed:", error.code, error.message)
    return
  }
  const claim = data as Claim | null
  if (!claim || !claim.send) return

  const to = toWaNumber(claim.phone)
  const outcome: Outcome = to ? await ask(claim, to) : { status: "skipped", reason: "bad_phone" }

  const { error: finishError } = await supabase.rpc("finish_notice", {
    p_id: claim.id,
    p_status: outcome.status,
    p_reason: outcome.reason ?? null,
  })
  if (finishError) console.error("finish_notice failed:", finishError.code, finishError.message)
}

/** מה הצוות רואה בכרטיס. */
export function noticeLabel(n: { status: string; reason: string | null } | null | undefined): string | null {
  if (!n) return null
  if (n.status === "sent") return "נשלחה ללקוח הודעת וואטסאפ שהרכב מוכן"
  if (n.status === "pending") return "שולחים ללקוח הודעה שהרכב מוכן…"
  const why: Record<string, string> = {
    no_consent: "הלקוח לא אישר וואטסאפ",
    no_phone: "אין טלפון בכרטיס",
    bad_phone: "הטלפון בכרטיס לא תקין",
    not_allowed: "המספר לא ברשימת ההדגמה",
    not_wired: "השליחה עוד לא מחוברת",
    send_failed: "הוואטסאפ לא קיבל את ההודעה",
    unreachable: "הבוט לא ענה",
  }
  const reason = (n.reason && why[n.reason]) || "תקלה בשליחה"
  return n.status === "failed" ? `ההודעה ללקוח לא יצאה: ${reason}` : `לא נשלחה הודעה ללקוח: ${reason}`
}
