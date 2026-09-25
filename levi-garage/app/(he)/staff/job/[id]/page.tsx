import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/staff/session"
import { resendQuoteNotice, resendReadyNotice, setJobStatus } from "../../actions"
import { noticeLabel } from "@/lib/staff/notify"
import { DraftForm } from "@/components/staff/draft-form"
import { RetryButton } from "@/components/staff/retry-button"
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

// האם הקישור לאישור יצא ללקוח בוואטסאפ. בלי שורה בכלל: השליחה עוד לא
// מחוברת, או שהממצא נשלח לפני שהיא חוברה — והקישור עדיין מועתק ביד.
function QuoteNoticeLine({
  notice,
  findingId,
  jobId,
  canSend,
}: {
  notice: { status: string; reason: string | null; sent_at: string | null } | undefined
  findingId: number
  jobId: number
  canSend: boolean
}) {
  const text = noticeLabel(notice, "quote")
  if (!notice || !text) return null
  return (
    <div className={`staff-note notice-${notice.status}`} role="status">
      {text}
      {notice.status === "sent" && notice.sent_at ? ` · ${fmtStamp(notice.sent_at)}` : ""}
      {notice.status === "failed" && canSend && (
        <form action={resendQuoteNotice} className="notice-retry">
          <input type="hidden" name="finding_id" value={findingId} />
          <input type="hidden" name="job_id" value={jobId} />
          <button className="btn quiet" type="submit">לשלוח שוב</button>
        </form>
      )}
    </div>
  )
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

  const { data: media } = await supabase
    .from("media")
    .select("id, kind, storage_path, mime, finding_id, created_at")
    .eq("job_card_id", jobId)
    .order("created_at", { ascending: false })

  // מה יצא ללקוח בוואטסאפ, ואם לא, למה. "הרכב מוכן" אחד לכרטיס, והקישור
  // לאישור אחד לכל קישור (ref הוא הטוקן שלו). מסך תלוי לא מגיע לכאן.
  const { data: notices } = await supabase
    .from("customer_notices")
    .select("kind, ref, status, reason, sent_at")
    .eq("job_card_id", jobId)
  const notice = (notices ?? []).find((n) => n.kind === "ready") ?? null
  const noticeText = noticeLabel(notice)
  const quoteNotice = new Map((notices ?? []).filter((n) => n.kind === "quote").map((n) => [n.ref, n]))

  const photos = (media ?? []).filter((m) => m.kind === "photo")
  // הקלטה ששמורה ואין לה טיוטה: המודל נפל, ומה שנאמר עדיין כאן.
  const orphanAudio = (media ?? []).filter((m) => m.kind === "audio" && !m.finding_id)

  // הדלי פרטי, ולכן כל קובץ מקבל כתובת חתומה לשעה. אין כתובת קבועה שאפשר
  // להעביר הלאה, וזה בכוונה: אלה תמונות של רכב של לקוח.
  const signed = new Map<string, string>()
  const toSign = [...photos, ...orphanAudio].map((m) => m.storage_path)
  if (toSign.length) {
    const { data: urls } = await supabase.storage.from("job-media").createSignedUrls(toSign, 3600)
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl)
  }

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

      {noticeText && (
        <div className={`staff-note notice-${notice?.status}`} role="status">
          {noticeText}
          {notice?.status === "sent" && notice.sent_at ? ` · ${fmtStamp(notice.sent_at)}` : ""}
          {notice?.status === "failed" && job.status === "ready" && (
            <form action={resendReadyNotice} className="notice-retry">
              <input type="hidden" name="job_id" value={job.id} />
              <button className="btn quiet" type="submit">לשלוח שוב</button>
            </form>
          )}
        </div>
      )}

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
                          <>
                            <p className="job-note">
                              ממתינים לתשובה.{" "}
                              <a href={`/approve/${approval.token}`} target="_blank" rel="noreferrer">
                                הקישור שנשלח ללקוח
                              </a>
                            </p>
                            <QuoteNoticeLine
                              notice={quoteNotice.get(approval.token)}
                              findingId={f.id}
                              jobId={job.id}
                              canSend={canSend}
                            />
                          </>
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

      {orphanAudio.length > 0 && (
        <section className="staff-section" aria-labelledby="orphan-title">
          <h2 id="orphan-title">הקלטות שלא תומללו</h2>
          <p className="staff-meta">
            המכונאי דיווח, והמודל נפל. ההקלטה עצמה שמורה — אפשר להאזין לה, או לנסות לתמלל שוב.
            <b> אף אחד לא צריך לדבר שוב.</b>
          </p>
          <ul className="job-orphans">
            {orphanAudio.map((m) => (
              <li key={m.id}>
                <span className="staff-meta">{fmtStamp(m.created_at)}</span>
                {signed.get(m.storage_path) && (
                  <audio controls preload="none" src={signed.get(m.storage_path)}>
                    הדפדפן לא יודע לנגן את ההקלטה.
                  </audio>
                )}
                <RetryButton mediaId={m.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section className="staff-section" aria-labelledby="photos-title">
          <h2 id="photos-title">תמונות</h2>
          <p className="staff-meta">מה שהמכונאי צילם. הקישורים פגים אחרי שעה, ולכן אי אפשר להעביר אותם הלאה.</p>
          <ul className="job-photos">
            {photos.map((m) => {
              const url = signed.get(m.storage_path)
              return (
                <li key={m.id}>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`תמונה מהכרטיס, ${fmtStamp(m.created_at)}`} loading="lazy" />
                    </a>
                  ) : (
                    <span className="staff-meta">התמונה לא נטענה</span>
                  )}
                  <span className="staff-meta">{fmtStamp(m.created_at)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}
