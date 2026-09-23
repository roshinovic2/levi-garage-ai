import "server-only"

import { generateJson } from "@/lib/site/gemini"

// הודעה קולית של מכונאי, בערבית מדוברת מעורבבת בעברית, הופכת לטיוטה.
// המודל הוא gemini-2.5-pro, לפי ה-POC: pro נאמן, flash הוסיף משפט שלא נאמר.
//
// שלושה דברים שהמודל לא עושה כאן, במכוון:
//   1. לא ממציא מחיר. אם לא נאמר מחיר, השדה נשאר ריק, ולא "בערך".
//   2. לא מזהה את הרכב מהקול. הרכב מגיע מהכרטיס, ונמסר לו כהקשר בלבד.
//   3. לא שולח כלום. הפלט הוא טיוטה שממתינה לאדם.

const MODEL = "gemini-2.5-pro"

const system = `You receive a voice note from a mechanic in a family car garage in Israel.
He speaks colloquial Levantine Arabic mixed with Hebrew garage terms, often in a noisy workshop.

Your job: turn what he said into a draft for the customer, and nothing more.

Rules:
- transcript: write what was said, as literally as you can, in the language it was said.
- summary: one or two sentences in Hebrew, for the garage staff.
- customer_text: Hebrew, warm and plain, 2 to 4 sentences. Say what was found, why it matters,
  the options with their prices, and when the car will be ready. No lists, no markdown, no emojis.
- Prices: use ONLY numbers that were actually said. If a price was not said, leave the field null.
  Never estimate, never round, never invent. The same goes for the time the car will be ready.
- If he gave one price without distinguishing an original from an aftermarket part, put it in
  price_original and leave price_aftermarket null. Only fill both when he actually named both.
- Do not diagnose beyond what the mechanic said, and do not add safety claims he did not make.
- red_list: true if he describes cutting a wire, disconnecting the car's computer, airbags,
  high voltage systems, or brakes he is unsure about. Those must stop and reach Avi or Alex.
- If the audio is unclear, say so in summary and leave prices null. Never guess a number.
- Keep garage words as spoken: ברקסים, רפידות, משאבת מים, סורק, ליפט, P0301.`

const schema = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    summary: { type: "STRING" },
    customer_text: { type: "STRING" },
    price_original: { type: "NUMBER", nullable: true },
    price_aftermarket: { type: "NUMBER", nullable: true },
    eta: { type: "STRING", nullable: true },
    red_list: { type: "BOOLEAN" },
  },
  required: ["transcript", "summary", "customer_text", "red_list"],
}

export type VoiceReport = {
  transcript: string
  summary: string
  customer_text: string
  price_original: number | null
  price_aftermarket: number | null
  eta: string | null
  red_list: boolean
  model: string
}

export async function reportFromVoice(
  audio: { data: string; mime: string },
  vehicle: { plate: string; make?: string | null; model?: string | null; year?: number | null; engine?: string | null },
): Promise<VoiceReport> {
  const context = [
    `The car on this lift is: ${[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "unknown"}`,
    vehicle.year ? `year ${vehicle.year}` : "",
    vehicle.engine ? `engine code ${vehicle.engine}` : "",
    `Use this car, even if the mechanic names a different one or names none.`,
  ]
    .filter(Boolean)
    .join(". ")

  const out = await generateJson<Omit<VoiceReport, "model">>({
    model: MODEL,
    system,
    contents: [{ role: "user", parts: [{ text: context }, { audio }] }],
    schema,
    temperature: 0.1,
    timeoutMs: 60_000,
    maxOutputTokens: 4000,  // ב-pro גם החשיבה נגרעת מהתקציב הזה
  })

  return {
    ...out,
    price_original: out.price_original ?? null,
    price_aftermarket: out.price_aftermarket ?? null,
    eta: out.eta ?? null,
    model: MODEL,
  }
}
