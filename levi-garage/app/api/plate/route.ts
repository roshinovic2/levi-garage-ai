import { NextResponse } from "next/server"

// בדיקת רכב לפי מספר רישוי, ממאגר כלי הרכב הציבורי של משרד התחבורה (data.gov.il).
// המספר לא נשמר ולא נרשם בלוג. מחזירים רק את השדות שהאתר מציג.

const RESOURCE = "053cea08-09bc-40ec-8f7a-156f0677aff3"

// המאגר הממשלתי איטי: תשובה ראשונה לוקחת 20 עד 30 שניות. התשובה נשמרת ליממה,
// ולכן רק הבקשה הראשונה לכל מספר משלמת את ההמתנה.
export const maxDuration = 45

export async function GET(req: Request) {
  const plate = (new URL(req.url).searchParams.get("n") ?? "").replace(/\D/g, "")
  if (plate.length < 7 || plate.length > 8) {
    return NextResponse.json({ error: "invalid" }, { status: 400 })
  }

  const url = new URL("https://data.gov.il/api/3/action/datastore_search")
  url.searchParams.set("resource_id", RESOURCE)
  url.searchParams.set("filters", JSON.stringify({ mispar_rechev: Number(plate) }))
  url.searchParams.set("limit", "1")

  try {
    const res = await fetch(url, {
      headers: { "user-agent": "levi-garage-site/1.0 (+https://levi-garage.vercel.app)" },
      signal: AbortSignal.timeout(35000),
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(String(res.status))
    const record = (await res.json())?.result?.records?.[0]
    if (!record) return NextResponse.json({ found: false })

    return NextResponse.json({
      found: true,
      plate,
      make: record.tozeret_nm ?? null,
      model: record.kinuy_mishari ?? null,
      year: record.shnat_yitzur ?? null,
      fuel: record.sug_delek_nm ?? null,
      engine: record.degem_manoa ?? null,
      tires: record.zmig_kidmi ?? null,
      testUntil: record.tokef_dt ?? null,
    })
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 })
  }
}
