"use client"

import { Children, useEffect, useState } from "react"

// הטלוויזיה בסדנה: אף אחד לא נוגע בה, ולכן היא מתחלפת לבד.
//
// עשר שניות ולא שתיים-שלוש. מכונאי שמרים את הראש מהרכב צריך לסרוק לוח שלם
// ולמצוא את הלוחית שלו; טאב שמתחלף מהר יותר מזה גורם לו לחכות סיבוב שלם.
// בדף העבודה בטלפון אין את זה בכלל, כי שם לוחצים.
export function Rotator({ labels, seconds = 10, children }: { labels: string[]; seconds?: number; children: React.ReactNode }) {
  const panels = Children.toArray(children)
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % panels.length), seconds * 1000)
    return () => clearInterval(id)
  }, [panels.length, seconds])

  return (
    <>
      <nav className="wall-tabs" aria-hidden="true">
        {labels.map((l, n) => (
          <span key={l} className={n === i ? "on" : ""}>
            {l}
          </span>
        ))}
      </nav>
      {/* כל הלוחות מוצגים ומוסתרים ב-CSS ולא מוחלפים, כדי שהשעונים ימשיכו
          לרוץ ברקע ושהמעבר לא יהבהב. בלי JavaScript נשאר הראשון, וזה עדיין
          מסך שאומר משהו נכון. */}
      {panels.map((p, n) => (
        <div key={n} className={n === i ? "wall-panel on" : "wall-panel"}>
          {p}
        </div>
      ))}
    </>
  )
}
