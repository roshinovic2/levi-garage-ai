import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BookFlow } from "@/components/site/book"
import { SiteFooter } from "@/components/site/footer"
import { SiteHeader } from "@/components/site/header"
import { dicts } from "@/lib/site/dict"

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = dicts[lang as "ar" | "ru"]
  return t ? { title: `${t.book.title} | ${t.meta.title}`, robots: { index: false, follow: false } } : {}
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ plate?: string; service?: string }>
}) {
  const { lang } = await params
  if (lang !== "ar" && lang !== "ru") notFound()
  const { plate, service } = await searchParams
  const t = dicts[lang]
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
