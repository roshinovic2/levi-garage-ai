---
name: מוסך לוי ובניו
description: Public site of a family garage in the Krayot. Heritage photographic hero, forest green and amber, Hebrew-first RTL with Arabic and Russian.
colors:
  bg: { light: "#eceee9", dark: "#0f1612" }
  surface: { light: "#f7f8f5", dark: "#16201a" }
  sunk: { light: "#e2e6df", dark: "#121b16" }
  ink: { light: "#1b2620", dark: "#e8ece8" }
  muted: { light: "#4f5b54", dark: "#a8b3ac" }
  line: { light: "#d3d8d1", dark: "#26332b" }
  forest: { light: "#1f3b2d", dark: "#9cc2ab" }
  band: { light: "#1f3b2d", dark: "#16291f" }
  amber: "#d6932a"
  amber-ink: "#1a1408"
  plate: "#f2c230"
  on-photo: "#f4f2ec"
typography:
  display: { he: "Frank Ruhl Libre 500/700/900", ar: "Noto Naskh Arabic 500/700", ru: "Noto Serif 500/700" }
  body: { he: "Assistant 400/600/700/800", ar: "IBM Plex Sans Arabic 400-700", ru: "Noto Sans 400-800" }
  scale: { hero: "clamp(2.7rem, 6.2vw, 5.4rem)", section: "clamp(2rem, 3.8vw, 3.1rem)", body: "17px / 1.65" }
rounded: { card: "14px", panel: "20px", button: "999px", plate: "9px" }
spacing: { section: "104px desktop, 68px mobile", gutter: "28px desktop, 20px mobile", max-width: "1240px" }
components: [site-header, hero, plate-lookup, promise-list, steps, price-board, test-card, family, fleet-band, visit-grid, faq, ask-us, footer]
---

# Design

## Overview
**Creative North Star: "The garage at seven in the morning."** A real family workshop, photographed honestly, speaking plainly. Trust first (the photo, 1998, three generations), then action (the plate, booking). Every promise on the page is something the garage's systems actually do.

## Colors
One palette, locked. Forest green carries identity (headings, the promise band, the assistant's voice). Amber is the only action color: every primary button, nothing else. The license-plate yellow appears only on the plate itself, as a real object, never as a second accent. Neutrals are cool bone and ink, not warm cream. Dark mode keeps the hierarchy: the promise band stays a deep green instead of flipping light. All text pairs pass WCAG AA (lowest measured: 6.08:1).

## Typography
- **Display:** Frank Ruhl Libre. A serif is justified here: a heritage family business since 1998. Headlines only, weight 700; the brand at 900.
- **Body:** Assistant, 17px, line-height 1.65, 55-70 characters per line.
- **Named rule, Hebrew has no tracking:** no letter-spacing anywhere on Hebrew text.
- **Named rule, no fake italic:** emphasis by weight or color only.
- **Named rule, numbers keep their direction:** times, phones, prices, tire sizes and engine codes sit in `dir="ltr"` isolates with tabular figures.
- Arabic and Russian swap to faces that carry their scripts (the Hebrew pair has neither).

## Layout
Max width 1240px. Sections vary their layout family: full-bleed photo hero, split plate lookup, full-width dark band list, sticky photo plus timeline, three-column price board, inset card with photo, split family portrait, full-bleed fleet band, three-column visit grid, FAQ beside the assistant. **Named rule, logical properties only:** `inline-start/end`, `padding-inline`, never left/right; flex and grid flip with `dir`.

## Elevation & Depth
Two levels. Flat sections on the page background; raised surfaces (plate card, test card, assistant) use one tinted shadow `0 12px 32px -12px` of the ink color. Photos carry depth through scrims, not shadows.

## Shapes
Buttons are full pills; cards 14px; the assistant panel and test card 20px; the plate 9px, like a real plate. Timeline markers are the only circles.

## Components
- **Hero:** full-bleed photo, bottom-anchored headline in two masked lines, the one authored motion moment (photo settles from scale 1.09 over 2.4s while lines rise, cubic-bezier(0.16,1,0.3,1)).
- **Plate lookup:** yellow plate input with the IL strip; types a real example when first scrolled into view (stops if the visitor focuses it); result card with a prefilled booking link.
- **Promise list:** complaint (struck through in amber) beside the promise.
- **Price board:** grouped columns, "from" prices only where the persona states them.
- **Ask us:** assistant panel in the FAQ area plus a mobile floating button hidden over the hero and while the panel is visible.

## Do's and Don'ts
- Do answer the reason for a call instead of hiding the phone.
- Do keep every number traceable to the persona.
- Don't use eyebrows, section numbers, em-dashes, gradient text or decorative dots.
- Don't show invented reviews, ratings or customer counts.
- Don't animate anything else on entrance; the hero is the one moment.
