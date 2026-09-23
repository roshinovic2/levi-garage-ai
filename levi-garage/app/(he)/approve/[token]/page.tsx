import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { ApproveForm } from "@/components/staff/approve-form"
import { fmtStamp } from "@/lib/staff/format"

export const metadata: Metadata = {
  title: "אישור תיקון | מוסך לוי ובניו",
  robots: { index: false, follow: false },
}

// דף האישור של הלקוח. אין כאן התחברות ואין חשבון: הקישור עצמו הוא המפתח.
// הדף רואה רק את מה שנשלח לאותו קישור, ולא את שאר הלקוחות (RPC approval_view).

type View = {
  message_text: string
  price_original: number | null
  price_aftermarket: number | null
  eta: string | null
  decision: string | null
  decided_at: string | null
  part_choice: string | null
  expired: boolean
  plate_last3: string | null
  vehicle: string | null
}

export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc("approval_view", { p_token: token })
  const view = (Array.isArray(data) ? data[0] : null) as View | null

  if (!view) {
    return (
      <main className="approve">
        <div className="approve-box">
          <h1>הקישור לא בתוקף</h1>
          <p>יכול להיות שהוא כבר שימש, או שעברו יותר משבוע. אפשר להתקשר אלינו ונסדר את זה.</p>
          <a className="btn" href="tel:040000000">התקשרות למוסך</a>
        </div>
      </main>
    )
  }

  const decided = Boolean(view.decision)

  return (
    <main className="approve">
      <div className="approve-box">
        <p className="approve-from">מוסך לוי ובניו</p>
        <h1>
          {view.vehicle || "הרכב שלך"}
          {view.plate_last3 ? (
            <>
              {" "}
              <span className="approve-plate num" dir="ltr">···{view.plate_last3}</span>
            </>
          ) : null}
        </h1>

        <p className="approve-message">{view.message_text}</p>

        {view.expired && !decided && (
          <p className="approve-note">הקישור פג. אפשר להתקשר אלינו ונסדר את זה בטלפון.</p>
        )}

        {decided ? (
          <div className={`approve-done ${view.decision}`}>
            {view.decision === "approved" ? (
              <>
                <b>קיבלנו את האישור שלך.</b>
                <p>
                  {view.part_choice === "original" ? "חלק מקורי" : "חלק חלופי"}
                  {view.eta ? ` · הרכב יהיה מוכן ${view.eta}` : ""}
                </p>
              </>
            ) : (
              <>
                <b>רשמנו שאתה לא מאשר את התיקון.</b>
                <p>נמשיך רק במה שסוכם קודם, ונעדכן כשהרכב מוכן.</p>
              </>
            )}
            <p className="approve-stamp">נרשם אצלנו בכתב, {fmtStamp(view.decided_at)}</p>
          </div>
        ) : view.expired ? null : (
          <ApproveForm
            token={token}
            priceOriginal={view.price_original}
            priceAftermarket={view.price_aftermarket}
          />
        )}

        <p className="approve-small">
          המחירים כוללים מע"מ. בלי האישור שלך לא נוגעים ברכב. אם משהו לא ברור, אנחנו כאן: 04-0000000.
        </p>
      </div>
    </main>
  )
}
