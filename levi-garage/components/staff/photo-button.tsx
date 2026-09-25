"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

// "המכונאי מצלם ומקליט" — זה הצד השני של ההבטחה, וזה מה שדניאל והלקוח
// רואים כשהם שואלים "מה בדיוק שחוק".
//
// `capture="environment"` פותח את המצלמה האחורית ישירות בטלפון, ובמחשב
// הוא פשוט נופל לבוחר קבצים. בלי getUserMedia, בלי תצוגה מקדימה, בלי
// הרשאות: לחיצה אחת, צילום, ונגמר. לידיים עם כפפות זה ההבדל.

type State = "idle" | "working" | "done" | "error"

// המוסך על רשת חלשה, וצילום מהטלפון הוא 4 מגה. הקטנה כאן חוסכת דקה
// של העלאה על כל תמונה, ו-1600 פיקסלים מספיקים בהרבה כדי לראות רפידה שחוקה.
const MAX_EDGE = 1600
const QUALITY = 0.82

async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1_500_000) return file

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY))
    // אם ההקטנה לא הועילה, שולחים את המקור. עדיף גדול מאשר פגום.
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export function PhotoButton({ jobId }: { jobId: number }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<State>("idle")
  const [message, setMessage] = useState("")

  async function send(list: FileList) {
    setState("working")
    setMessage("")
    const form = new FormData()
    form.append("job_id", String(jobId))
    for (const file of Array.from(list).slice(0, 6)) {
      const blob = await shrink(file)
      form.append("photo", blob, "photo.jpg")
    }

    try {
      const res = await fetch("/api/staff/photo", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setState("error")
        setMessage("התמונה לא נשמרה. כדאי לנסות שוב.")
        return
      }
      setState("done")
      setMessage(json.saved === 1 ? "תמונה נוספה לכרטיס." : `${json.saved} תמונות נוספו לכרטיס.`)
      router.refresh()
    } catch {
      setState("error")
      setMessage("אין חיבור כרגע. התמונה לא נשלחה.")
    } finally {
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div className="voice">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => e.target.files?.length && send(e.target.files)}
      />
      <button
        type="button"
        className={`voice-btn photo ${state}`}
        onClick={() => input.current?.click()}
        disabled={state === "working"}
      >
        <span className="voice-dot" aria-hidden />
        {state === "working" ? "מעלים..." : state === "done" ? "עוד תמונה" : "צילום"}
      </button>
      {message && (
        <p className={`voice-msg ${state}`} role="status">
          {message}
        </p>
      )}
    </div>
  )
}
