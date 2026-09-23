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
