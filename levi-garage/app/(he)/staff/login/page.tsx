import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getStaff } from "@/lib/staff/session"
import { LoginForm } from "@/components/staff/login-form"

export const metadata: Metadata = { title: "כניסת צוות | מוסך לוי ובניו", robots: { index: false, follow: false } }

export default async function LoginPage() {
  if (await getStaff()) redirect("/staff")

  return (
    <main className="staff-login">
      <div className="staff-login-box">
        <h1>כניסת צוות</h1>
        <p>אזור העבודה של המוסך. לקוחות לא צריכים להיכנס לכאן.</p>
        <LoginForm />
      </div>
    </main>
  )
}
