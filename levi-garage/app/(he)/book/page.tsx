import type { Metadata } from "next"

import { BookFlow } from "@/components/site/book"
import { SiteFooter } from "@/components/site/footer"
import { SiteHeader } from "@/components/site/header"
import { dicts } from "@/lib/site/dict"

export const metadata: Metadata = { title: "קביעת תור | מוסך לוי ובניו" }

export default async function BookPage({ searchParams }: { searchParams: Promise<{ plate?: string; service?: string }> }) {
  const { plate, service } = await searchParams
  const t = dicts.he
  return (
    <>
      <SiteHeader t={t} overPhoto={false} />
      <main id="main" className="wrap legal booked book-page">
        <BookFlow t={t} plate={plate?.slice(0, 12)} service={service?.slice(0, 60)} />
      </main>
      <SiteFooter t={t} />
    </>
  )
}
