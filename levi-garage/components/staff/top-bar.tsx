import Link from "next/link"

import { signOut } from "@/app/(he)/staff/actions"
import { roleLabel, type StaffMember } from "@/lib/staff/session"

// פס עליון אחד לכל מסכי הצוות, כדי שתמיד יהיה ברור מי מחובר ואיך חוזרים.
// המכונאי לא צריך ציים ומדדים, ולכן הוא לא רואה אותם.

export function TopBar({ staff, current }: { staff: StaffMember; current: "board" | "lift" | "fleets" | "dashboard" | "other" }) {
  const links: { href: string; label: string; key: string }[] = [
    { href: "/staff", label: "לוח היום", key: "board" },
    ...(staff.role === "mechanic" ? [{ href: "/staff/lift", label: "הליפט שלי", key: "lift" }] : []),
    ...(staff.role !== "mechanic"
      ? [
          { href: "/staff/fleets", label: "ציים", key: "fleets" },
          { href: "/staff/dashboard", label: "מדדים", key: "dashboard" },
        ]
      : []),
  ]

  return (
    <div className="topbar">
      <nav className="topbar-links" aria-label="ניווט אזור הצוות">
        {links.map((l) => (
          <Link key={l.key} href={l.href} aria-current={current === l.key ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="topbar-me">
        <span>
          {staff.full_name}
          <small>
            {roleLabel[staff.role]}
            {staff.role === "mechanic" ? (staff.lift ? ` · ליפט ${staff.lift}` : " · עמדת אבחון") : ""}
          </small>
        </span>
        <form action={signOut}>
          <button type="submit">יציאה</button>
        </form>
      </div>
    </div>
  )
}
