import type { Metadata } from "next"

import { SiteFooter } from "@/components/site/footer"
import { SiteHeader } from "@/components/site/header"
import { dicts, siteConfig, whatsappLink } from "@/lib/site/dict"

export const metadata: Metadata = {
  title: "התור נקבע | מוסך לוי ובניו",
  robots: { index: false, follow: false },
}

// לכאן Cal.com מעביר את הלקוח אחרי שקבע תור.
//
// הבוט שולח הודעות רק למי שכתב למוסך בוואטסאפ, כדי שמספר שמישהו הקליד
// בטעות (או בכוונה) לא יקבל הודעות מאיתנו. לכן הדף הזה מבקש הודעה אחת: היא
// כבר כתובה, רק לשלוח. הבוט עונה עליה עם אישור התור, ומאותו רגע אפשר לשלוח
// ללקוח תזכורת והודעה כשהרכב מוכן.
const MESSAGE = "שלום, קבעתי עכשיו תור 🙂 אשמח לקבל תזכורת ועדכון כשהרכב מוכן"

export default function BookedPage() {
  const t = dicts.he
  const wa = whatsappLink(MESSAGE)

  return (
    <>
      <SiteHeader t={t} overPhoto={false} />
      <main id="main" className="wrap legal booked">
        <h1>התור נקבע ✅</h1>
        <p>
          קיבלנו את התור. פרטי הרכב כבר נשלפו ממאגר משרד התחבורה, כך שהמכונאי יודע מה מגיע עוד לפני שתגיעו.
        </p>

        <section className="booked-step" aria-labelledby="booked-wa">
          <h2 id="booked-wa">צעד אחרון: הודעה אחת בוואטסאפ</h2>
          <p>
            כדי שנוכל לשלוח לכם <strong>תזכורת יום לפני</strong>, ואת ההודעה <strong>שהרכב מוכן</strong>, צריך שתכתבו לנו פעם אחת
            מהמספר שמסרתם בטופס. ההודעה כבר כתובה, רק לשלוח. נענה לכם עם אישור התור.
          </p>
          {wa ? (
            <a className="btn" href={wa} target="_blank" rel="noreferrer">
              שליחת הודעה בוואטסאפ
            </a>
          ) : (
            <p>
              אפשר גם להתקשר: <a href={`tel:${siteConfig.phone}`}>{siteConfig.phone}</a>
            </p>
          )}
          <p className="booked-note">
            לא חובה. בלי ההודעה התור קיים כרגיל, רק לא נוכל לעדכן אתכם בוואטסאפ.
          </p>
        </section>
      </main>
      <SiteFooter t={t} />
    </>
  )
}
