import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic, Noto_Sans, Noto_Serif } from "next/font/google"

import "../../site.css"
import { themeScript } from "@/components/site/theme-toggle"
import { dicts } from "@/lib/site/dict"

// Arabic and Russian need faces that carry their scripts; the Hebrew pair has no Arabic or Cyrillic glyphs.
const arDisplay = Noto_Naskh_Arabic({ subsets: ["arabic"], weight: ["500", "700"], variable: "--font-display", display: "swap" })
const arBody = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" })
const ruDisplay = Noto_Serif({ subsets: ["cyrillic", "latin"], weight: ["500", "700"], variable: "--font-display", display: "swap" })
const ruBody = Noto_Sans({ subsets: ["cyrillic", "latin"], weight: ["400", "600", "700", "800"], variable: "--font-body", display: "swap" })

export const dynamicParams = false
export function generateStaticParams() {
  return [{ lang: "ar" }, { lang: "ru" }]
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = dicts[lang as "ar" | "ru"]
  if (!t) return {}
  return {
    title: t.meta.title,
    description: t.meta.description,
    robots: { index: false, follow: false },
    alternates: { languages: { he: "/", ar: "/ar", ru: "/ru" } },
  }
}

export default async function IntlLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (lang !== "ar" && lang !== "ru") notFound()
  const fonts = lang === "ar" ? `${arDisplay.variable} ${arBody.variable}` : `${ruDisplay.variable} ${ruBody.variable}`
  return (
    <html lang={lang} dir={dicts[lang].dir} className={fonts} suppressHydrationWarning>
      <head>
        {/* לפני הציור הראשון, כדי שלא יהיה הבהוב של הצבע הלא נכון. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
