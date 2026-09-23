import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

// מי מחובר, ומה מותר לו. שורת ה-staff היא מקור האמת לתפקיד:
// משתמש שנוצר ב-auth אבל אין לו שורה כאן, הוא לא איש צוות.

export type StaffRole = "owner" | "manager" | "mechanic"

export type StaffMember = {
  id: string
  full_name: string
  role: StaffRole
  lift: number | null
  lang: "he" | "ar" | "ru"
  email: string
}

export async function getStaff(): Promise<StaffMember | null> {
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null

  const { data } = await supabase
    .from("staff")
    .select("id, full_name, role, lift, lang, active")
    .eq("id", auth.user.id)
    .maybeSingle()

  if (!data?.active) return null

  return { ...(data as Omit<StaffMember, "email">), email: auth.user.email ?? "" }
}

/** לעמודים שמאחורי ההתחברות. מי שלא מחובר מגיע למסך הכניסה. */
export async function requireStaff(): Promise<StaffMember> {
  const staff = await getStaff()
  if (!staff) redirect("/staff/login")
  return staff
}

/** לפעולות של מנהל עבודה, כמו שליחת מחיר ללקוח. המסד אוכף שוב, זה רק המסך. */
export async function requireManager(): Promise<StaffMember> {
  const staff = await requireStaff()
  if (staff.role === "mechanic") redirect("/staff")
  return staff
}

export const roleLabel: Record<StaffRole, string> = {
  owner: "בעלים",
  manager: "מנהל עבודה",
  mechanic: "מכונאי",
}
