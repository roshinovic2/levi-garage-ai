import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/staff/session"
import { setJobStatus } from "../../actions"
import { DraftForm } from "@/components/staff/draft-form"
import { fmtStamp } from "@/lib/staff/format"
import { TopBar } from "@/components/staff/top-bar"

export const metadata: Metadata = { title: "כרטיס עבודה | מוסך לוי ובניו", robots: { index: false, follow: false } }

const findingStatus: Record<string, string> = {
  draft: "טיוטה, עוד לא נשלחה",
  sent: "נשלחה ללקוח, ממתינים לתשובה",
  approved: "הלקוח אישר",
  declined: "הלקוח דחה",
  cancelled: "בוטלה",
}

export default async function JobCardPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  const { id } = await params
  const jobId = Number(id)
  if (!Number.isFinite(jobId)) notFound()

  const supabase = await createClient()

  const { data: job } = await supabase
    .from("job_cards")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()
  if (!job) notFound()

  const { data: findings } = await supabase
    .from("findings")
    .select("*, approvals(token, decision, decided_at, part_choice, price_chosen, message_text)")
    .eq("job_card_id", jobId)
    .order("created_at", { ascending: false })

  const canSend = staff.role !== "mechanic"

  return (
    <main className="staff-wrap">
      <TopBar staff={staff} current="other" />

      <header className="staff-top">
        <div>
          <Link className="staff-back" href="/staff">חזרה ללוח</Link>
          <h1>
            <span className="plate-chip num" dir="ltr">{job.plate}</span>{" "}
            {[job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ")}
            {job.vehicle_year ? `, ${job.vehicle_year}` : ""}
          </h1>
          <p>
            {job.customer_name || "ללא שם"}
            {job.lift ? ` · ליפט ${job.lift}` : ""}
            {job.engine_code ? ` · מנוע ${job.engine_code}` : ""}
            {job.whatsapp_consent ? " · אישר קבלת וואטסאפ" : " · בלי אישור וואטסאפ"}
          </p>
        </div>
        <div className="job-actions">
          {job.status !== "ready" && job.status !== "delivered" && (
            <form action={setJobStatus}>
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="status" value="ready" />
              <button className="btn" type="submit">הרכב מוכן</button>
            </form>
          )}
          {job.status === "ready" && (
            <form action={setJobStatus}>
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="status" value="delivered" />
              <button className="btn" type="submit">נמסר ללקוח</button>
            </form>
          )}
        </div>
      </header>

      <section className="staff-section" aria-labelledby="findings-title">
        <h2 id="findings-title">מה נמצא ברכב</h2>

        {(findings ?? []).length === 0 ? (
          <p className="staff-empty">
            עוד לא דווח כלום. המכונאי מקליט מ<Link href={`/staff/lift`}>דף הליפט</Link>, והדיווח יופיע כאן כטיוטה.
          </p>
        ) : (
          <ul className="job-findings">
            {(findings ?? []).map((f) => {
              const approval = Array.isArray(f.approvals) ? f.approvals[0] : f.approvals
              return (
                <li key={f.id} className={`job-finding status-${f.status}`}>
                  <div className="job-finding-head">
                    <b>{findingStatus[f.status] ?? f.status}</b>
                    <span className="staff-meta">{fmtStamp(f.created_at)}{f.model ? ` · ${f.model}` : ""}</span>
                    {f.red_list && <span className="job-red">רשימה אדומה: לעצור ולקרוא לאבי</span>}
                  </div>

                  {f.transcript && (
                    <details className="job-transcript">
                      <summary>מה נאמר בהקלטה</summary>
                      <p>{f.transcript}</p>
                    </details>
                  )}

                  {f.status === "draft" ? (
                    canSend ? (
                      <DraftForm
                        findingId={f.id}
                        jobId={job.id}
                        text={f.customer_text ?? ""}
                        priceOriginal={f.price_original}
                        priceAftermarket={f.price_aftermarket}
                        eta={f.eta}
                      />
                    ) : (
                      <p className="job-note">
                        הטיוטה מוכנה. <b>מנהל עבודה או הבעלים שולחים ללקוח</b>, לא מכונאי.
                      </p>
                    )
                  ) : (
                    <>
                      <blockquote className="job-sent">{approval?.message_text ?? f.customer_text}</blockquote>
                      {approval?.decision ? (
                        <p className={`job-decision ${approval.decision}`}>
                          {approval.decision === "approved"
                            ? `הלקוח אישר ${approval.part_choice === "original" ? "חלק מקורי" : "חלק חלופי"}, ${Number(approval.price_chosen).toLocaleString("he-IL")} ש"ח`
                            : "הלקוח דחה את התיקון"}
                          {" · "}
                          {fmtStamp(approval.decided_at)}
                        </p>
                      ) : (
                        approval?.token && (
                          <p className="job-note">
                            ממתינים לתשובה.{" "}
                            <a href={`/approve/${approval.token}`} target="_blank" rel="noreferrer">
                              הקישור שנשלח ללקוח
                            </a>
                          </p>
                        )
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
