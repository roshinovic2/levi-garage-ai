"use client"

import { useEffect, useState } from "react"

import { elapsed } from "@/lib/staff/format"

// השעון על המסך צריך להתקדם גם כשאף אחד לא נוגע בטלפון: הוא מונח על הדלפק
// ומסתכלים בו מרחוק. הערך הראשון מגיע מהשרת, ולכן אין הבדל בין מה שנשלח
// למה שמוצג; משם והלאה הוא מתעדכן כאן, פעם בדקה, בלי לטעון את הדף מחדש.
export function Since({ iso, initial, className }: { iso: string; initial: string; className?: string }) {
  const [text, setText] = useState(initial)

  useEffect(() => {
    const tick = () => setText(elapsed(iso))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [iso])

  return (
    <span className={className ? `clock ${className}` : "clock"}>
      <bdi>{text}</bdi>
    </span>
  )
}
