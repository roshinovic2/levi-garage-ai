import { SiteFooter } from "@/components/site/footer"
import { SiteHeader } from "@/components/site/header"
import { dicts } from "@/lib/site/dict"

export function LegalShell({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  const t = dicts.he
  return (
    <>
      <SiteHeader t={t} overPhoto={false} />
      <main id="main" className="wrap legal">
        <h1>{title}</h1>
        {updated && <p className="updated">עודכן לאחרונה: {updated}</p>}
        {children}
      </main>
      <SiteFooter t={t} />
    </>
  )
}
