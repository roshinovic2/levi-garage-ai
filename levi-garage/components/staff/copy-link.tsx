"use client"

import { useState } from "react"

// הכתובת ארוכה ואף אחד לא יקליד אותה. הכפתור מעתיק, והשדה עצמו נשאר
// לבחירה ביד למקרה שהדפדפן חוסם את הלוח (זה קורה על מסכים ישנים).
export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false)

  return (
    <div className="copy-link">
      <input readOnly value={url} dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label="הכתובת" />
      <button
        type="button"
        className="btn quiet"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setDone(true)
            setTimeout(() => setDone(false), 2000)
          } catch {
            // אין לוח העתקה: השדה כבר מסומן, ואפשר להעתיק ביד.
          }
        }}
      >
        {done ? "הועתק" : "העתקה"}
      </button>
    </div>
  )
}
