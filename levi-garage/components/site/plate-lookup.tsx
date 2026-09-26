"use client"

import { useEffect, useRef, useState } from "react"

import { bookingLink, siteConfig, type Dict } from "@/lib/site/dict"

type Vehicle = {
  plate: string; make: string | null; model: string | null; year: number | null
  fuel: string | null; engine: string | null; tires: string | null; testUntil: string | null
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "msg"; text: string }
  | { kind: "found"; v: Vehicle }

const DEMO = "82-153-76"

function formatPlate(digits: string) {
  const d = digits.slice(0, 8)
  if (d.length <= 7) return [d.slice(0, 2), d.slice(2, 5), d.slice(5)].filter(Boolean).join("-")
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5)].filter(Boolean).join("-")
}

function monthsUntil(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
}

function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}.${m}.${y}`
}

export function PlateLookup({ t }: { t: Dict }) {
  const [value, setValue] = useState("")
  const [state, setState] = useState<State>({ kind: "idle" })
  const input = useRef<HTMLInputElement>(null)
  const typed = useRef(false)

  async function lookup(raw: string) {
    const digits = raw.replace(/\D/g, "")
    if (digits.length < 7 || digits.length > 8) return setState({ kind: "msg", text: t.plate.invalid })
    setState({ kind: "loading" })
    try {
      const res = await fetch(`/api/plate?n=${digits}`)
      const json = await res.json()
      if (!res.ok) return setState({ kind: "msg", text: json.error === "invalid" ? t.plate.invalid : t.plate.error })
      if (!json.found) return setState({ kind: "msg", text: t.plate.notFound })
      setState({ kind: "found", v: json })
    } catch {
      setState({ kind: "msg", text: t.plate.error })
    }
  }

  // Demo: when the plate first scrolls into view, it types a real example and looks it up.
  useEffect(() => {
    const el = input.current
    if (!el) return
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || typed.current) return
        typed.current = true
        io.disconnect()
        if (el.value || document.activeElement === el) return // the visitor got here first
        if (reduce) {
          setValue(DEMO)
          lookup(DEMO)
          return
        }
        let i = 0
        const tick = () => {
          if (document.activeElement === el) return // the visitor started typing: stop the demo
          i += 1
          setValue(DEMO.slice(0, i))
          if (i < DEMO.length) setTimeout(tick, DEMO[i] === "-" ? 60 : 105)
          else setTimeout(() => document.activeElement !== el && lookup(DEMO), 250)
        }
        setTimeout(tick, 450)
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const v = state.kind === "found" ? state.v : null
  const months = v?.testUntil ? monthsUntil(v.testUntil) : null
  const nextText = months === null ? t.plate.testOk : months < 0 ? t.plate.testExpired : months <= 1 ? t.plate.testSoon : months <= 4 ? t.plate.testIn.replace("{m}", String(months)) : t.plate.testOk
  const service = months !== null && months <= 4 ? siteConfig.serviceValues.test : siteConfig.serviceValues.periodic

  return (
    <div>
      <h2 className="sec-title">{t.plate.title}</h2>
      <p className="sec-sub">{t.plate.sub}</p>
      <form
        className="plate-form"
        onSubmit={(e) => {
          e.preventDefault()
          lookup(value)
        }}
      >
        <label className="plate">
          <span className="il" aria-hidden="true">IL</span>
          <input
            ref={input}
            value={value}
            onChange={(e) => {
              setValue(formatPlate(e.target.value.replace(/\D/g, "")))
              // A new number: the previous result no longer applies.
              if (state.kind !== "loading") setState({ kind: "idle" })
            }}
            inputMode="numeric"
            autoComplete="off"
            aria-label={t.plate.label}
            placeholder="000-00-000"
            maxLength={10}
            dir="ltr"
          />
        </label>
        <button className="btn" type="submit" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? t.plate.loading : t.plate.submit}
        </button>
      </form>
      <p className="plate-hint">{t.plate.privacy}</p>

      <div aria-live="polite">
        {state.kind === "msg" && <p className="plate-msg">{state.text}</p>}
        {v && (
          <div className="plate-card">
            <h3>{[v.make, v.model].filter(Boolean).join(" ")}{v.year ? `, ${v.year}` : ""}</h3>
            <dl>
              {v.fuel && (<><dt>{t.plate.fields.fuel}</dt><dd>{v.fuel}</dd></>)}
              {v.engine && (<><dt>{t.plate.fields.engine}</dt><dd><span className="ltr">{v.engine}</span></dd></>)}
              {v.tires && (<><dt>{t.plate.fields.tires}</dt><dd><span className="ltr num">{v.tires}</span></dd></>)}
              {v.testUntil && (<><dt>{t.plate.fields.test}</dt><dd className="num">{formatDate(v.testUntil)}</dd></>)}
            </dl>
            <div className="plate-next">
              <p>{nextText}</p>
              <a className="btn" href={bookingLink({ plate: v.plate, service }, t.lang)}>{t.plate.book}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
