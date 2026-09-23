"use client"

import { useEffect, useState } from "react"

// כפתור תאורה.
//
// עד כאן התאורה נקבעה רק לפי מה שהמכשיר מבקש, ולא הייתה דרך לעקוף אותה.
// זה נשבר בדיוק במקום שבו זה הכי מפריע: טלוויזיה שהגיעה עם מצב כהה דלוק
// מהיצרן, תלויה בחדר המתנה מואר, ואי אפשר לעשות עם זה כלום.
//
// הבחירה נשמרת במכשיר עצמו ולא בחשבון, כי היא תכונה של המסך ולא של האדם:
// אותו משתמש יושב על טלפון בסדנה ועל מסך על הקיר, ולכל אחד מהם תאורה אחרת.

const KEY = "theme"

export function ThemeToggle({
  compact = false,
  labels,
}: {
  compact?: boolean
  /** האתר הציבורי בשלוש שפות, ולכן התוויות מגיעות מהמילון. אזור הצוות בעברית. */
  labels?: { light: string; dark: string }
}) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null)

  // עד שהרכיב עולה, לא יודעים מה נבחר: הסקריפט ב-head כבר קבע את זה על
  // ה-html, וכאן רק קוראים בחזרה. בלי זה היה הבדל בין השרת ללקוח.
  useEffect(() => {
    const current = document.documentElement.dataset.theme
    if (current === "light" || current === "dark") setTheme(current)
    else setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  }, [])

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    setTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // דפדפן שחוסם אחסון: התאורה תעבוד עד הרענון הבא, וזה עדיין עדיף מכלום.
    }
  }

  const dark = theme === "dark"
  const label = dark ? (labels?.light ?? "תאורה בהירה") : (labels?.dark ?? "תאורה כהה")

  return (
    <button type="button" className="theme-toggle" onClick={flip} aria-label={label} title={label}>
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinejoin="round" />
        </svg>
      )}
      {!compact && <span>{label}</span>}
    </button>
  )
}

/**
 * רץ ב-head לפני הציור הראשון, ולכן אין הבהוב של הצבע הלא נכון.
 * הוא לא נוגע בכלום אם המשתמש לא בחר: אז ההעדפה של המכשיר ממשיכה לקבוע.
 */
export const themeScript = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`
