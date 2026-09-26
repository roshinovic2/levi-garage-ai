"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// המסך הזה מונח על הדלפק ופתוח כל היום, ומישהו אחר לוחץ על הכפתורים.
// בלי רענון עצמי, דניאל רואה תמונה מלפני שעתיים ומאמין לה. הרענון מושך
// מהשרת ולא טוען את הדף מחדש, ולכן המיקום בגלילה נשמר.
//
// חריג אחד: אם השרת הוחלף בגרסה חדשה מאז שהדף נטען, רענון רך מערבב קוד ישן
// שבדפדפן עם תוכן מהגרסה החדשה, ו-React נופל (שגיאה #418). זה בדיוק מה שקרה
// אחרי פריסה, על מסך שנשאר פתוח. לכן לפני כל רענון בודקים את גרסת השרת,
// וכשהיא השתנתה — טוענים את הדף מחדש, פעם אחת.
const BUILD = process.env.APP_BUILD ?? ""

export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter()

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" })
        const { build } = (await res.json()) as { build?: string }
        if (BUILD && build && build !== BUILD) {
          window.location.reload()
          return
        }
      } catch {
        // השרת לא ענה — בדרך כלל כי הוא בדיוק מתחלף. לא מרעננים עכשיו: רענון
        // מול שרת שלא עונה הוא בדיוק מה שמפיל את React. ננסה בפעם הבאה.
        return
      }
      router.refresh()
    }
    const id = setInterval(tick, seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])

  return null
}
