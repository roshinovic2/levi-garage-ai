import Link from "next/link"

import type { Dict } from "@/lib/site/dict"

export function SiteFooter({ t }: { t: Dict }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot">
          <div>
            <span className="brand"><b>{t.lang === "he" ? "מוסך לוי ובניו" : t.lang === "ar" ? "كراج ليفي وأبناؤه" : "Гараж Леви и сыновья"}</b></span>
            <p>{t.footer.tagline}</p>
          </div>
          <ul>
            <li><Link href="/privacy">{t.footer.privacy}</Link></li>
            <li><Link href="/accessibility">{t.footer.accessibility}</Link></li>
            <li><Link href="/terms">{t.footer.terms}</Link></li>
            <li><Link href="/staff">{t.footer.staff}</Link></li>
          </ul>
        </div>
        <p className="demo-note">{t.footer.demo}</p>
      </div>
    </footer>
  )
}
