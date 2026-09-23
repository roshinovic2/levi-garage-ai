"use client"

import { useState } from "react"

import { sendFinding } from "@/app/(he)/staff/actions"

// מסך הטיוטה. זה הרגע היחיד שבו אדם עומד בין המודל לבין הלקוח, ולכן:
// הטקסט פתוח לעריכה, המחירים מודגשים בנפרד מעל, והכפתור אומר בדיוק מה הוא עושה.

export function DraftForm({
  findingId,
  jobId,
  text,
  priceOriginal,
  priceAftermarket,
  eta,
}: {
  findingId: number
  jobId: number
  text: string
  priceOriginal: number | null
  priceAftermarket: number | null
  eta: string | null
}) {
  const [value, setValue] = useState(text)
  const [sending, setSending] = useState(false)

  const money = (n: number | null) =>
    n === null || n === undefined ? "לא נאמר" : `${Number(n).toLocaleString("he-IL")} ש"ח`

  return (
    <form
      className="job-draft"
      action={async (formData) => {
        setSending(true)
        await sendFinding(formData)
        setSending(false)
      }}
    >
      <input type="hidden" name="finding_id" value={findingId} />
      <input type="hidden" name="job_id" value={jobId} />

      <div className="job-prices">
        <div>
          <span>{priceAftermarket === null ? "מחיר" : "חלק מקורי"}</span>
          <b className="num">{money(priceOriginal)}</b>
        </div>
        {priceAftermarket !== null && (
          <div>
            <span>חלק חלופי</span>
            <b className="num">{money(priceAftermarket)}</b>
          </div>
        )}
        <div>
          <span>מוכן</span>
          <b>{eta || "לא נאמר"}</b>
        </div>
      </div>
      <p className="job-check">
        המחירים למעלה הם מה שהמכונאי אמר בהקלטה. <b>תבדוק אותם לפני שליחה</b>, גם כשהתמלול נראה מושלם.
      </p>

      <label htmlFor={`draft-${findingId}`}>ההודעה שתישלח ללקוח</label>
      <textarea
        id={`draft-${findingId}`}
        name="message"
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
      />

      <button className="btn" type="submit" disabled={sending || !value.trim()}>
        {sending ? "שולחים..." : "שליחה ללקוח"}
      </button>
    </form>
  )
}
