// בודק ששינוי מועד מבטל את התור הקודם (sql/005), ורק אותו.
//
//   node --env-file=levi-garage/.env.local 03-rollout/solution-3-agent/test/reschedule.mjs

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

let pass = 0
let fail = 0
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++
    console.log(`PASS  ${name}`)
  } else {
    fail++
    console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`)
  }
}

const service = (path, init = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json", prefer: "return=representation", ...(init.headers || {}) },
  })

const day = 24 * 60 * 60 * 1000
const created = { bookings: [], jobs: [] }
async function booking(uid, fields) {
  const [row] = await (
    await service(`/rest/v1/bookings`, {
      method: "POST",
      body: JSON.stringify({ cal_uid: uid, status: "booked", plate: "8215376", customer_phone: "050-0000000", drop_off_at: new Date(Date.now() + 3 * day).toISOString(), ...fields }),
    })
  ).json()
  created.bookings.push(row.id)
  return row
}
const statusOf = async (id) => (await (await service(`/rest/v1/bookings?id=eq.${id}&select=status`)).json())[0]?.status
const pause = () => new Promise((r) => setTimeout(r, 1100))

try {
  // המספר נרשם אחרת בכל תור: מקפים, קידומת מדינה. זה עדיין אותו אדם.
  const oldOne = await booking("test-rs-old", {})
  const otherPhone = await booking("test-rs-otherphone", { customer_phone: "050-0000009" })
  const otherCar = await booking("test-rs-othercar", { plate: "74815302" })
  const arrived = await booking("test-rs-arrived", {})
  const [job] = await (await service(`/rest/v1/job_cards`, { method: "POST", body: JSON.stringify({ booking_id: arrived.id, plate: "8215376", status: "in_progress", notes: "בדיקת שינוי מועד" }) })).json()
  created.jobs.push(job.id)

  await pause()
  const moved = await booking("test-rs-new", { status: "rescheduled", customer_phone: "+972-50-000-0000", drop_off_at: new Date(Date.now() + 5 * day).toISOString() })

  ok("שינוי מועד: התור הקודם של אותו רכב ואותו טלפון בוטל", (await statusOf(oldOne.id)) === "cancelled")
  ok("…והתור החדש נשאר", (await statusOf(moved.id)) === "rescheduled")
  ok("תור של אותו רכב עם טלפון אחר לא נוגעים בו", (await statusOf(otherPhone.id)) === "booked")
  ok("תור של רכב אחר של אותו לקוח לא נוגעים בו", (await statusOf(otherCar.id)) === "booked")
  ok("תור שכבר נפתח לו כרטיס לא מבוטל", (await statusOf(arrived.id)) === "booked")

  // שינוי מועד שני: החדש מחליף את הקודם, שהוא בעצמו 'rescheduled'.
  await pause()
  const movedAgain = await booking("test-rs-new2", { status: "rescheduled", drop_off_at: new Date(Date.now() + 6 * day).toISOString() })
  ok("שינוי מועד שני: גם תור שכבר הוזז מבוטל", (await statusOf(moved.id)) === "cancelled" && (await statusOf(movedAgain.id)) === "rescheduled")

  const noPhone = await booking("test-rs-nophone", { customer_phone: null })
  await pause()
  await booking("test-rs-nophone-new", { status: "rescheduled", customer_phone: null })
  ok("בלי טלפון לא מנחשים: שום דבר לא מבוטל", (await statusOf(noPhone.id)) === "booked")
} finally {
  for (const id of created.jobs) await service(`/rest/v1/job_cards?id=eq.${id}`, { method: "DELETE" })
  for (const id of created.bookings) await service(`/rest/v1/bookings?id=eq.${id}`, { method: "DELETE" })
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
