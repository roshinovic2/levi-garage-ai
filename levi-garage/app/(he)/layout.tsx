import type { Metadata, Viewport } from "next"
import { Assistant, Frank_Ruhl_Libre } from "next/font/google"

import "../site.css"
import { dicts } from "@/lib/site/dict"

const display = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], weight: ["500", "700", "900"], variable: "--font-display", display: "swap" })
const body = Assistant({ subsets: ["hebrew", "latin"], weight: ["400", "600", "700", "800"], variable: "--font-body", display: "swap" })

const t = dicts.he

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  // אתר הדגמה של עסק בדוי: לא לאנדקס, כדי שלא יתבלבל עם עסקים אמיתיים.
  robots: { index: false, follow: false },
  alternates: { languages: { he: "/", ar: "/ar", ru: "/ru" } },
  openGraph: { title: t.meta.title, description: t.meta.description, images: ["/images/garage-wide.jpg"], locale: "he_IL" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceee9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1612" },
  ],
}

export default function HebrewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
