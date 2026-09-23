"use client"

import { useActionState } from "react"

import { signIn } from "@/app/(he)/staff/actions"

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null as { error?: string } | null)

  return (
    <form action={action} className="staff-form">
      <label htmlFor="email">אימייל</label>
      <input id="email" name="email" type="email" autoComplete="username" dir="ltr" required />

      <label htmlFor="password">סיסמה</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />

      {state?.error && <p className="staff-error" role="alert">{state.error}</p>}

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "נכנסים..." : "כניסה"}
      </button>
    </form>
  )
}
