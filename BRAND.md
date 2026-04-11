# Sayso Brand Guidelines

> The voice is the form.

Sayso replaces typed forms with voice conversations. The brand should feel **human, editorial, and confident** — like a well-designed magazine that happens to talk.

---

## Voice & Tone

**Personality**: Calm authority. Sayso knows what it is and doesn't oversell. Think *Stripe's clarity* meets *a podcast host's warmth*.

| Do | Don't |
|----|-------|
| "Respondents talk. You get structured data." | "Revolutionary AI-powered voice form solution!" |
| "Ship in an afternoon." | "Easily build forms in minutes with our platform." |
| "Forms that listen." | "Smart forms that leverage cutting-edge AI." |
| Use short, declarative sentences | Use filler words (just, simply, easily, seamlessly) |
| Address the reader directly (you/your) | Use passive voice or corporate jargon |
| Be specific about what happens | Make vague promises about productivity |

**Copy rules**:
- Headlines: short, punchy, lowercase except proper nouns. Fraunces italic for emphasis words.
- Body: conversational but precise. One idea per sentence.
- CTAs: action-first ("Try a live demo", "Start the conversation"), never "Learn more" or "Click here".
- Kickers/labels: uppercase, wide letter-spacing (`tracking-[0.28em]`+), prefixed with `§` or `●` for editorial feel.

---

## Logo

The Sayso logo is a **wordmark + pulse dot**.

- **Wordmark**: "sayso" in Fraunces, semibold (`font-display text-2xl font-semibold tracking-tight`), always lowercase.
- **Pulse dot**: A small filled circle to the left of the wordmark (`h-2 w-2 rounded-full`). In motion contexts, it pulses (scale 1 → 1.4 → 1, 1.8s loop). In static contexts, it's a solid dot.
- **Minimum spacing**: The dot + wordmark should have `gap-2.5` between them.

**Usage**:
- On light backgrounds: black dot + black text
- On dark backgrounds: white dot + white text
- Never use coral/color for the logo — it's always monochrome
- Never add a tagline directly next to the logo; use it separately

**Favicon**: Use the pulse dot alone (filled circle) as the favicon. Black on white for light mode, white on black for dark mode.

---

## Color Palette

### Primary Colors

| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| **Black** | `#000000` | `black` | Primary text, borders, buttons, landing page background sections |
| **White** | `#FFFFFF` | `white` | Backgrounds, text on dark, landing page base |
| **Cream** | `#FFF8F0` | `cream` | App background (dashboard, editor, form detail) |

### Accent Colors

| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| **Coral** | `#FF6B5A` | `coral` | Interactive accents in the app: active states, highlights, progress indicators |
| **Coral Light** | `#FF8A7A` | `coral-light` | Hover states on coral elements |
| **Coral Dark** | `#E5554A` | `coral-dark` | Pressed states on coral elements |

### Neutral Tints (via Tailwind opacity)

| Token | Usage |
|-------|-------|
| `black/60` | Secondary text |
| `black/50` | Kicker/label text |
| `black/40` | Tertiary text, meta info |
| `black/20` | Borders, dividers |
| `black/10` | Subtle borders, section dividers |
| `black/[0.03]` | Tinted backgrounds (cards, bubbles) |
| `white/60` | Secondary text on dark |
| `white/40` | Meta text on dark |
| `white/10` | Borders on dark |

### Two Palettes

The brand operates in **two modes**:

1. **Editorial (landing page)**: Black/white only. High contrast, no cream or coral. This is the public face — sharp, typographic, magazine-like.
2. **Product (app)**: Cream background with coral accents. Warmer, softer. This is where people work — approachable and functional.

Never mix the two. The landing page should never use cream/coral. The app should never use the black/white editorial inversions.

---

## Typography

### Font Stack

| Role | Font | CSS Variable | Fallback |
|------|------|-------------|----------|
| **Display** | Fraunces | `--font-display` / `font-display` | Georgia, serif |
| **Body** | DM Sans | `--font-body` / `font-body` | system-ui, sans-serif |

Both loaded from Google Fonts with `display=swap`.

### Type Scale

| Element | Class | Font | Weight |
|---------|-------|------|--------|
| Hero headline | `font-display text-[18vw] md:text-[14vw] font-semibold leading-[0.85] tracking-[-0.04em]` | Fraunces | 600 |
| Section heading | `font-display text-6xl md:text-8xl font-semibold leading-[0.95] tracking-tight` | Fraunces | 600 |
| Sub-heading | `font-display text-3xl font-semibold` | Fraunces | 600 |
| Large body | `font-display text-2xl md:text-3xl leading-[1.2]` | Fraunces | 400 |
| Body text | `text-lg leading-8` or `text-base leading-7` | DM Sans | 400 |
| Small text | `text-sm leading-7` | DM Sans | 400 |
| Kicker/label | `text-[10px] uppercase tracking-[0.28em]` or `text-[11px] uppercase tracking-[0.32em]` | DM Sans | 400 |
| Button | `text-sm font-medium` or `text-base font-medium` | DM Sans | 500 |

### Typography Rules

- Emphasis words in headlines use `<em className="italic">` (Fraunces italic).
- Body text color: `#231f1b` (warm dark, not pure black).
- Never bold body text — use font-medium (500) at most.
- Kickers are always uppercase with wide tracking and reduced opacity (`text-black/50`).

---

## Layout & Spacing

| Token | Value | Usage |
|-------|-------|-------|
| Max width | `max-w-[1600px]` | Main content container |
| Page padding | `px-8` (32px) | Horizontal gutters |
| Section spacing | `py-32` (128px) | Vertical space between sections |
| Grid gaps | `gap-8` to `gap-16` | Between grid items |
| Content max-width | `max-w-md` to `max-w-5xl` | Text blocks within sections |

---

## Borders & Shadows

| Element | Style |
|---------|-------|
| Section dividers | `border-t border-black/10` |
| Card borders | `border border-black` (editorial) or `border border-black/10` (product) |
| Product mock shadow | `shadow-[16px_16px_0_0_rgba(0,0,0,1)]` — hard offset, no blur |
| Rounded cards | `rounded-[2rem]` or `rounded-[2.5rem]` |
| Buttons | `rounded-full` (always pill-shaped) |

The hard drop shadow is a signature element. No soft/blurry shadows — everything is flat and graphic.

---

## Motion

Built on Framer Motion. Animation is **purposeful, not decorative**.

| Pattern | Config | Usage |
|---------|--------|-------|
| Reveal on scroll | `initial={{ opacity: 0, y: 40 }}`, once, margin `-80px` | Section content entrance |
| Easing | `[0.22, 1, 0.36, 1]` | Default ease for all transitions |
| Stagger | `delay: i * 0.08` to `i * 0.15` | Lists and grid items |
| Hover lift | `whileHover={{ y: -4 }}` or `whileHover={{ rotate: -0.5 }}` | Cards and interactive elements |
| Parallax | `useTransform(scrollYProgress, ...)` | Hero section only |
| Pulse | `animate={{ scale: [1, 1.4, 1] }}`, 1.8s repeat | Logo dot, status indicators |
| Float | `animate={{ y: [0, -8, 0] }}`, 6s repeat | Product mock |
| Marquee | `animate={{ x: ["0%", "-50%"] }}`, linear, 30s | Scrolling text strips |

**Rules**:
- Duration: 0.4s–1s for UI, up to 6s for ambient motion.
- Never use `ease-in` — always use the custom bezier or `easeInOut`.
- Scroll-triggered animations fire once (`once: true`).
- Spring physics for interactive elements (stiffness: 300, damping: 20).

---

## Buttons

| Variant | Classes |
|---------|---------|
| **Primary** | `rounded-full bg-black px-7 py-4 text-sm font-medium text-white` + arrow `→` |
| **Primary (dark bg)** | `rounded-full bg-white px-10 py-6 text-base font-medium text-black` + arrow `→` |
| **Secondary** | `rounded-full border border-black/20 px-7 py-4 text-sm font-medium text-black` |
| **Secondary (dark bg)** | `rounded-full border border-white/30 px-10 py-6 text-base font-medium text-white` |
| **Nav CTA** | `rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white` with slide-reveal hover |

All buttons are pill-shaped (`rounded-full`). Primary buttons include a `→` arrow that translates on hover. No coral-colored buttons on the landing page.

---

## Iconography

Sayso uses **typographic symbols** instead of icon libraries:

- `→` for CTAs and navigation
- `✦` as a decorative separator (marquee, background)
- `●` as a status/live indicator
- `§` as a section prefix in kickers

No icon library (no Lucide, no Heroicons). Keep it typographic.

---

## Grain Texture

A subtle noise overlay covers the entire landing page:

```css
opacity: 0.04;
mix-blend-mode: multiply;
background-image: SVG fractal noise (feTurbulence, baseFrequency 0.9, 3 octaves);
```

This is fixed-position and pointer-events-none. It adds analog warmth to the digital surface. Use it on the landing page only, not in the app.

---

## Missing Assets (TODO)

- [ ] SVG logo file (wordmark + dot, light and dark variants)
- [ ] Favicon set (favicon.ico, apple-touch-icon.png, favicon-32x32.png, favicon-16x16.png)
- [ ] OG image (1200x630px) for social sharing
- [ ] site.webmanifest
- [ ] Brand color in manifest (`#000000` for landing, `#FFF8F0` for app)
