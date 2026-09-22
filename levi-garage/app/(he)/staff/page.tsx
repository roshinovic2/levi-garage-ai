import type { Metadata } from "next"

import { LegalShell } from "@/components/site/legal-shell"

export const metadata: Metadata = { title: "כניסת צוות | מוסך לוי ובניו" }

// אזור הצוות (לוח התורים, כרטיס העבודה ואישורי תיקון) נבנה בפתרון 4, באותה אפליקציה.
export default function StaffPage() {
  return (
    <LegalShell title="כניסת צוות">
      <p>אזור הצוות בבנייה. כאן יופיעו לוח התורים של היום, כרטיסי העבודה ואישורי התיקון.</p>
    </LegalShell>
  )
}
