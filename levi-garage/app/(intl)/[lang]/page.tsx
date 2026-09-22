import { Home } from "@/components/site/home"
import { dicts } from "@/lib/site/dict"

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <Home t={dicts[lang as "ar" | "ru"]} />
}
