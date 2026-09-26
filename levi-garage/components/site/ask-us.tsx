"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircleQuestion, Send } from "lucide-react"

import { bookingLink, whatsappLink, type Dict } from "@/lib/site/dict"

type Turn = { role: "user" | "model"; text: string; action?: "book" | "whatsapp" | "none" }

export function AskUs({ t }: { t: Dict }) {
  const [log, setLog] = useState<Turn[]>([])
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [fabHidden, setFabHidden] = useState(true)
  const box = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // On phones a small button opens this panel from anywhere. Hidden over the hero (it has its own button)
  // and once the panel itself is on screen.
  useEffect(() => {
    const hero = document.querySelector(".hero")
    if (!box.current) return
    const visible = new Map<Element, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visible.set(e.target, e.isIntersecting))
        setFabHidden([...visible.values()].some(Boolean))
      },
      { threshold: 0.15 },
    )
    io.observe(box.current)
    if (hero) io.observe(hero)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log, busy])

  async function ask(question: string) {
    const text = question.trim()
    if (!text || busy) return
    const history = log.map(({ role, text }) => ({ role, text }))
    setLog((l) => [...l, { role: "user", text }])
    setQ("")
    setBusy(true)
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, lang: t.lang, history }),
      })
      const json = await res.json()
      if (res.status === 429) throw new Error("limit")
      if (!res.ok || !json.answer) throw new Error("failed")
      setLog((l) => [...l, { role: "model", text: json.answer, action: json.action }])
    } catch (e) {
      setLog((l) => [...l, { role: "model", text: (e as Error).message === "limit" ? t.ask.limit : t.ask.error, action: "book" }])
    } finally {
      setBusy(false)
    }
  }

  const wa = whatsappLink()

  return (
    <>
      <div className="ask" id="ask" ref={box}>
        <h3>{t.ask.title}</h3>
        <p>{t.ask.sub}</p>
        <div className="ask-log" ref={logRef} aria-live="polite">
          {log.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                {m.role === "user" ? t.ask.you : t.ask.garage}:
              </span>
              {m.text}
              {m.role === "model" && m.action && m.action !== "none" && (
                <div className="acts">
                  {m.action === "book" && <a href={bookingLink({}, t.lang)}>{t.ask.book}</a>}
                  {m.action === "whatsapp" && wa && <a href={wa}>{t.ask.whatsapp}</a>}
                  {m.action === "whatsapp" && !wa && <a href={bookingLink({}, t.lang)}>{t.ask.book}</a>}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble model thinking">{t.ask.thinking}</div>}
        </div>
        {log.length === 0 && (
          <div className="chips">
            {t.ask.suggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
        )}
        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault()
            ask(q)
          }}
        >
          <label htmlFor="ask-q">{t.ask.label}</label>
          <input id="ask-q" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.ask.placeholder} maxLength={400} autoComplete="off" enterKeyHint="send" />
          <button className="btn" type="submit" disabled={busy || !q.trim()} aria-label={t.ask.send}>
            <Send aria-hidden style={{ transform: t.dir === "rtl" ? "scaleX(-1)" : undefined }} />
          </button>
        </form>
        <p className="ask-note">{t.ask.disclaimer}</p>
      </div>
      <a
        className="btn ask-fab"
        href="#ask"
        aria-label={t.ask.open}
        hidden={fabHidden}
        onClick={() => setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 450)}
      >
        <MessageCircleQuestion aria-hidden />
        {t.ask.open}
      </a>
    </>
  )
}
