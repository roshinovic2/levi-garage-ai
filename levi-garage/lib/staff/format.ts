// תאריכים ושעות בשעון ישראל, תמיד.
//
// זה לא קישוט: המסכים האלה נבנים בשרת, וב-Vercel השרת רץ ב-UTC. בלי אזור זמן
// מפורש, תור של 07:45 מוצג לדניאל כ-04:45. נתפס בפועל בצילום מסך מהייצור.

const TZ = "Asia/Jerusalem"

const timeFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
const dateFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" })
const stampFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false })

export const fmtTime = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : "")
export const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "")
export const fmtStamp = (iso: string | null) => (iso ? stampFmt.format(new Date(iso)) : "")
export const hourInIsrael = (iso: string) => Number(hourFmt.format(new Date(iso)))

// ----- שעון עצור: כמה זמן רכב כבר עומד -----
//
// המספר הזה נקרא במבט חטוף, בין שני רכבים, ולכן הוא קצר: "40 דק׳" או
// "3:20 שע׳". הוא לא מדויק לשנייה בכוונה, כי אף אחד לא מנהל מוסך בשניות.

export const minutesSince = (iso: string, now: number = Date.now()) =>
  Math.round((now - new Date(iso).getTime()) / 60000)

export function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} דק׳`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}:${String(m % 60).padStart(2, "0")} שע׳`
  const d = Math.round(h / 24)
  return d === 1 ? "יום" : d === 2 ? "יומיים" : `${d} ימים`
}

export const elapsed = (iso: string | null, now: number = Date.now()) =>
  iso ? fmtMinutes(minutesSince(iso, now)) : ""
