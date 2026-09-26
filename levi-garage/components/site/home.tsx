import Image from "next/image"
import { Check, Plus, ShieldCheck } from "lucide-react"

import { AskUs } from "@/components/site/ask-us"
import { SiteFooter } from "@/components/site/footer"
import { SiteHeader } from "@/components/site/header"
import { PlateLookup } from "@/components/site/plate-lookup"
import { bookingLink, siteConfig, whatsappLink, type Dict } from "@/lib/site/dict"

export function Home({ t }: { t: Dict }) {
  const wa = whatsappLink()
  return (
    <>
      <SiteHeader t={t} />
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-bg">
            <Image src="/images/garage-wide.jpg" alt={t.hero.imgAlt} fill priority sizes="100vw" />
          </div>
          <div className="wrap hero-body">
            <div>
              <h1 id="hero-title">
                <span className="l"><span>{t.hero.l1}</span></span>
                <span className="l"><span>{t.hero.l2}</span></span>
              </h1>
              <p className="sub">{t.hero.sub}</p>
              <div className="ctas">
                <a className="btn" href={bookingLink({}, t.lang)}>{t.nav.book}</a>
                <a className="btn on-photo" href={wa ?? "#ask"}>{wa ? "WhatsApp" : t.hero.ask}</a>
              </div>
            </div>
            <p className="since"><b className="num">1998</b>{t.hero.sinceLabel}</p>
          </div>
        </section>

        <section id="plate" className="sec wrap plate-sec" aria-label={t.plate.title}>
          <PlateLookup t={t} />
          <figure className="plate-photo" style={{ margin: 0 }}>
            <Image src="/images/plate-detail.jpg" alt={t.plate.imgAlt} width={1024} height={1024} sizes="(max-width: 900px) 100vw, 45vw" />
          </figure>
        </section>

        <section id="promise" className="sec promise" aria-labelledby="promise-title">
          <div className="wrap">
            <h2 id="promise-title" className="sec-title">{t.promise.title}</h2>
            <p className="sec-sub">{t.promise.sub}</p>
            <ul className="promise-list">
              {t.promise.items.map((p) => (
                <li key={p.title}>
                  <blockquote><s>&quot;{p.complaint}&quot;</s></blockquote>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="sec wrap how" aria-labelledby="how-title">
          <figure className="how-photo" style={{ margin: 0 }}>
            <Image src="/images/hands.jpg" alt={t.how.imgAlt} width={928} height={1152} sizes="(max-width: 900px) 100vw, 38vw" />
          </figure>
          <div>
            <h2 id="how-title" className="sec-title">{t.how.title}</h2>
            <ol className="steps">
              {t.how.steps.map((s) => (
                <li key={s.title}>
                  <span className="when"><span className="ltr num">{s.when}</span></span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
            <a className="btn" href={bookingLink({}, t.lang)}>{t.nav.book}</a>
          </div>
        </section>

        <section id="services" className="sec wrap" aria-labelledby="services-title">
          <h2 id="services-title" className="sec-title">{t.services.title}</h2>
          <p className="sec-sub">{t.services.sub}</p>
          <div className="board">
            {t.services.groups.map((g) => (
              <div key={g.name}>
                <h3>{g.name}</h3>
                <ul>
                  {g.items.map((it) => (
                    <li key={it.name}>
                      <div className="board-row">
                        <span className="board-name">{it.name}</span>
                        {it.price && (
                          <span className="price">{t.services.from}<b className="num">{it.price}</b> ₪</span>
                        )}
                      </div>
                      <p className="board-desc">{it.desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="board-note">
            <p><ShieldCheck aria-hidden />{t.services.note}</p>
            <a className="btn" href={bookingLink({}, t.lang)}>{t.nav.book}</a>
          </div>
        </section>

        <section id="test" className="wrap" aria-labelledby="test-title">
          <div className="test">
            <div className="test-text">
              <h2 id="test-title" className="sec-title">{t.test.title}</h2>
              <p className="sec-sub">{t.test.body}</p>
              <ul>
                {t.test.points.map((p) => (<li key={p}><Check aria-hidden />{p}</li>))}
              </ul>
              <a className="btn" href={bookingLink({ service: siteConfig.serviceValues.test }, t.lang)}>{t.test.cta}</a>
            </div>
            <div className="test-photo">
              <Image src="/images/test-prep.jpg" alt={t.test.imgAlt} width={928} height={1152} sizes="(max-width: 900px) 100vw, 50vw" />
            </div>
          </div>
        </section>

        <section id="family" className="sec wrap family" aria-labelledby="family-title">
          <figure style={{ margin: 0 }}>
            <Image src="/images/family.jpg" alt={t.family.imgAlt} width={928} height={1152} sizes="(max-width: 900px) 100vw, 42vw" />
          </figure>
          <div>
            <h2 id="family-title" className="sec-title">
              {t.family.title.split(/(?<=\.) /).map((s) => (<span key={s} className="ln">{s} </span>))}
            </h2>
            <p>{t.family.p1}</p>
            <p>{t.family.p2}</p>
            <div className="gens">
              {t.family.people.map((p) => (<div key={p.name}><b>{p.name}</b><span>{p.role}</span></div>))}
            </div>
          </div>
        </section>

        <section id="fleet" className="fleet" aria-labelledby="fleet-title">
          <Image src="/images/fleet.jpg" alt={t.fleet.imgAlt} fill sizes="100vw" />
          <div className="wrap">
            <div className="fleet-box">
              <h2 id="fleet-title">{t.fleet.title}</h2>
              <p>{t.fleet.body}</p>
              <p className="fleet-who">{t.fleet.who}</p>
              <dl className="fleet-stats">
                {t.fleet.stats.map((s) => (
                  <div key={s.l}><dt className="num"><span className="ltr">{s.n}</span></dt><dd>{s.l}</dd></div>
                ))}
              </dl>
              <ul>
                {t.fleet.points.map((p) => (<li key={p}><Check aria-hidden />{p}</li>))}
              </ul>
              <a className="btn" href={wa ?? "#ask"}>{t.fleet.cta}</a>
            </div>
          </div>
        </section>

        <section id="visit" className="sec wrap" aria-labelledby="visit-title">
          <h2 id="visit-title" className="sec-title">{t.visit.title}</h2>
          <div className="visit-grid">
            <div>
              <h3>{t.visit.hoursTitle}</h3>
              <dl className="hours">
                {t.visit.hours.map((h) => (<div key={h.d} style={{ display: "contents" }}><dt>{h.d}</dt><dd><span className="ltr num">{h.h}</span></dd></div>))}
              </dl>
              <p className="visit-note">{t.visit.dropoff}</p>
            </div>
            <div>
              <h3>{t.visit.whereTitle}</h3>
              <p>{t.visit.where}</p>
              <p style={{ marginTop: 16 }}><a className="btn quiet" href={siteConfig.wazeUrl} target="_blank" rel="noopener">{t.visit.waze}</a></p>
            </div>
            <div>
              <h3>{t.visit.phoneTitle}</h3>
              <a className="phone" href={`tel:${siteConfig.phone}`}><span className="ltr num">{siteConfig.phone}</span></a>
              <p className="visit-note">{t.visit.phoneNote}</p>
            </div>
          </div>

          <div className="faq-ask">
            <div className="faq">
              <h3>{t.visit.faqTitle}</h3>
              {t.visit.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}<Plus aria-hidden /></summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <AskUs t={t} />
          </div>
        </section>
      </main>
      <SiteFooter t={t} />
    </>
  )
}
