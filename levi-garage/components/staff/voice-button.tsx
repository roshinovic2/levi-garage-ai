"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

// כפתור אחד, לידיים מלוכלכות: לוחצים, מדברים, לוחצים שוב.
// ההקלטה נשלחת לשרת, שם היא נשמרת, מתומללת, והופכת לטיוטה בכרטיס.

type State = "idle" | "recording" | "sending" | "done" | "error"

export function VoiceButton({ jobId }: { jobId: number }) {
  const router = useRouter()
  const [state, setState] = useState<State>("idle")
  const [seconds, setSeconds] = useState(0)
  const [message, setMessage] = useState("")
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current)
      recorder.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function start() {
    setMessage("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data)
      rec.onstop = () => send(new Blob(chunks.current, { type: rec.mimeType }))
      rec.start()
      recorder.current = rec
      setSeconds(0)
      setState("recording")
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setState("error")
      setMessage("הדפדפן לא נתן גישה למיקרופון. צריך לאשר אותה בהגדרות.")
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current)
    recorder.current?.stop()
    recorder.current?.stream.getTracks().forEach((t) => t.stop())
    setState("sending")
  }

  async function send(blob: Blob) {
    const form = new FormData()
    form.append("audio", blob, "note.webm")
    form.append("job_id", String(jobId))
    try {
      const res = await fetch("/api/staff/voice", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setState("error")
        setMessage(
          json?.saved
            ? "ההקלטה נשמרה, אבל התמלול נכשל. דניאל יכול לנסות שוב מהכרטיס."
            : "לא הצלחנו לשמור את ההקלטה. כדאי לנסות שוב.",
        )
        return
      }
      setState("done")
      setMessage(json.red_list ? "נרשם. שים לב: זה סומן כרשימה אדומה, תקרא לאבי." : `נרשם: ${json.summary}`)
      router.refresh()
    } catch {
      setState("error")
      setMessage("אין חיבור כרגע. ההקלטה לא נשלחה.")
    }
  }

  const label =
    state === "recording"
      ? `עצירה (${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")})`
      : state === "sending"
        ? "מתמללים..."
        : state === "done"
          ? "עוד דיווח"
          : "דיווח קולי"

  return (
    <div className="voice">
      <button
        type="button"
        className={`voice-btn ${state}`}
        onClick={state === "recording" ? stop : start}
        disabled={state === "sending"}
        aria-live="polite"
      >
        <span className="voice-dot" aria-hidden />
        {label}
      </button>
      {message && (
        <p className={`voice-msg ${state}`} role="status">
          {message}
        </p>
      )}
    </div>
  )
}
