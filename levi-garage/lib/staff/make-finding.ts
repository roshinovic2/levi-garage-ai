import type { SupabaseClient } from "@supabase/supabase-js"

import { reportFromVoice } from "@/lib/staff/voice-report"

// הקטע המשותף לשני המסלולים: הקלטה חדשה, וניסיון חוזר על הקלטה שכבר שמורה.
//
// הוא יושב כאן ולא בכל אחד מהם, כי ניסיון חוזר שמריץ קוד אחר מההקלטה
// המקורית הוא לא ניסיון חוזר: הוא באג שמחכה לקרות.

type Job = {
  id: number
  plate: string
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  engine_code: string | null
}

/**
 * מריץ את המודל על האודיו, ופותח ממנו טיוטה בכרטיס.
 * `storagePath` מקשר את קובץ ההקלטה לטיוטה שנוצרה ממנו, כדי שאפשר יהיה
 * לדעת אילו הקלטות עדיין בלי תמלול.
 */
export async function createFindingFromAudio({
  supabase,
  job,
  bytes,
  mime,
  staffId,
  storagePath,
}: {
  supabase: SupabaseClient
  job: Job
  bytes: Buffer
  mime: string
  staffId: string
  storagePath: string
}) {
  const report = await reportFromVoice(
    { data: bytes.toString("base64"), mime },
    {
      plate: job.plate,
      make: job.vehicle_make,
      model: job.vehicle_model,
      year: job.vehicle_year,
      engine: job.engine_code,
    },
  )

  const { data: finding, error } = await supabase
    .from("findings")
    .insert({
      job_card_id: job.id,
      source: "voice",
      transcript: report.transcript,
      summary: report.summary,
      customer_text: report.customer_text,
      price_original: report.price_original,
      price_aftermarket: report.price_aftermarket,
      eta: report.eta,
      red_list: report.red_list,
      model: report.model,
      created_by: staffId,
      status: "draft",
    })
    .select("id")
    .single()

  if (error) throw new Error(`finding insert failed: ${error.message}`)

  await supabase.from("media").update({ finding_id: finding.id }).eq("storage_path", storagePath)

  return { finding_id: finding.id as number, report }
}
