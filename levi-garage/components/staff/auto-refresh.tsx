"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// המסך הזה מונח על הדלפק ופתוח כל היום, ומישהו אחר לוחץ על הכפתורים.
// בלי רענון עצמי, דניאל רואה תמונה מלפני שעתיים ומאמין לה. הרענון מושך
// מהשרת ולא טוען את הדף מחדש, ולכן המיקום בגלילה נשמר.
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])

  return null
}
