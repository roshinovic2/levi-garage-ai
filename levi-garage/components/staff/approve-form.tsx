"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

// שתי בחירות ושתי לחיצות. ההכרעה נשמרת דרך RPC, ולכן גם אם מישהו יתעסק עם
// הדפדפן, הוא לא יכול לכתוב שום דבר אחר במסד.

export function ApproveForm({
  token,
  priceOriginal,
  priceAftermarket,
}: {
  token: string
  priceOriginal: number | null
  priceAftermarket: number | null
}) {
  const router = useRouter()
  const [choice, setChoice] = useState<"original" | "aftermarket">(
    priceAftermarket !== null ? "aftermarket" : "original"
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const money = (n: number) => `${Number(n).toLocaleString("he-IL")} ש"ח`

  async function decide(decision: "approved" | "declined") {
    setBusy(true)
    setError("")
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc("approval_decide", {
      p_token: token,
      p_decision: decision,
      p_part_choice: decision === "approved" ? choice : null,
    })
    setBusy(false)
    if (rpcError || data === "unavailable") {
      setError("לא הצלחנו לשמור את התשובה. אפשר להתקשר אלינו: 04-0000000")
      return
    }
    router.refresh()
  }

  const options = [
    { key: "original" as const, label: "חלק מקורי", price: priceOriginal },
    { key: "aftermarket" as const, label: "חלק חלופי", price: priceAftermarket },
  ].filter((o) => o.price !== null && o.price !== undefined)

  return (
    <div className="approve-choice">
      {options.length > 1 && (
        <fieldset>
          <legend>איזה חלק להזמין?</legend>
          {options.map((o) => (
            <label key={o.key} className={choice === o.key ? "picked" : ""}>
              <input
                type="radio"
                name="part"
                value={o.key}
                checked={choice === o.key}
                onChange={() => setChoice(o.key)}
              />
              <span>{o.label}</span>
              <b className="num">{money(o.price!)}</b>
            </label>
          ))}
        </fieldset>
      )}

      {options.length === 1 && (
        <p className="approve-single">
          {options[0].label}: <b className="num">{money(options[0].price!)}</b>
        </p>
      )}

      {error && <p className="staff-error" role="alert">{error}</p>}

      <div className="approve-buttons">
        <button className="btn" type="button" disabled={busy} onClick={() => decide("approved")}>
          {busy ? "רגע..." : "מאשר, תתקנו"}
        </button>
        <button className="btn quiet" type="button" disabled={busy} onClick={() => decide("declined")}>
          לא מאשר
        </button>
      </div>
    </div>
  )
}
