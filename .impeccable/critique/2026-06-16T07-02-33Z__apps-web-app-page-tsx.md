---
target: apps/web/app/page.tsx
total_score: 23
p0_count: 0
p1_count: 1
timestamp: 2026-06-16T07-02-33Z
slug: apps-web-app-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading states on landing; badge pulse is the only dynamic signal |
| 2 | Match System / Real World | 3 | Forest metaphors land well; "Stash your team" is slightly opaque |
| 3 | User Control and Freedom | 3 | Clear nav, back to home; no hamburger menu on mobile |
| 4 | Consistency and Standards | 3 | Token system is solid; feature cards are uniform — see P2 below |
| 5 | Error Prevention | 2 | No visible form validation on landing CTAs; login/register are separate pages |
| 6 | Recognition Rather Than Recall | 3 | Nav labels are text-based; icons have titles in feature cards |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts, skip-to-content, or anchor jump affordances |
| 8 | Aesthetic and Minimalist Design | 3 | Clean overall; feature card grid is the weakest section (identical card grid) |
| 9 | Error Recovery | 2 | Landing page itself has no error states to test; auth pages show generic "Something went wrong" |
| 10 | Help and Documentation | 1 | No help, no tooltips, no contextual guidance anywhere |
| **Total** | | **23/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: The page does NOT read as obviously AI-generated. The split-layout hero with the hand-drawn doodle illustration is distinctive and personal. The warm linen/forest palette avoids generic SaaS blues. However, the **feature card grid** (6 identical icon+title+description cards in a 3×2 grid) is the single biggest AI-slop tell on the page — it's the exact template every generator reaches for. The stats bar ("< 50ms", "∞", "4", "100%") is also very close to the hero-metric template banned in the design system.

**Deterministic scan**: `detect.mjs` returned zero findings on `page.tsx`. No gradient text, no side-stripe borders, no sketchy SVGs, no repeating-linear-gradient stripes detected.

## Overall Impression

The landing page has genuine personality — the squirrel doodle, the warm oatmeal backgrounds, and the forest-green CTA create an identity that's clearly not another generic SaaS template. The biggest opportunity is **breaking the monotony in the middle of the page**: the features section and stats bar use formulaic layouts that undercut the distinctive hero.

## What's Working

1. **The split hero with sketchbook doodle** is the strongest section. The tilted frame, offset shadow, and italic caption create a memorable, on-brand first impression that no competitor would have.
2. **The Kanban preview mockup** below the hero is excellent social proof — it shows the actual product UI with fake browser chrome and sidebar, giving visitors an immediate sense of what they'll get.
3. **The warm color system** (linen bg, forest green accents, stone borders) is cohesive and carries through every section without feeling forced.

## Priority Issues

### [P1] Feature cards are an identical card grid
- **What**: Six FeatureCards with the exact same structure (icon box → title → paragraph) in a 3×2 grid. This is the "identical card grid" anti-pattern explicitly banned in DESIGN.md.
- **Why it matters**: It's the single biggest tell that undermines the otherwise distinctive page. Users skim past identical grids; the information doesn't stick.
- **Fix**: Break the grid. Use 2–3 different visual treatments: lead with one "hero feature" (Kanban Boards) at full-width with an inline illustration, then a 2-column layout for secondary features, then a compact list for the rest. Vary the hierarchy so the eye stops.
- **Suggested command**: `$impeccable layout app/page.tsx` (target the features section)

### [P2] Stats bar uses the hero-metric template
- **What**: The stats bar (< 50ms, ∞, 4, 100%) is four big numbers with small labels in a grid — the exact SaaS cliché called out in SKILL.md's absolute bans.
- **Why it matters**: It reads as filler content. "4 permission levels" and "∞ boards" aren't compelling stats; they feel padded.
- **Fix**: Either remove this section entirely (it adds little value) or integrate the genuinely interesting stat (< 50ms latency) into the hero or features section as a proof point. Drop the others.
- **Suggested command**: `$impeccable distill app/page.tsx`

### [P2] No mobile hamburger menu
- **What**: The nav links ("Features", "How it works") are `hidden md:flex`, meaning they disappear on mobile with no hamburger replacement. Mobile visitors see only the logo, "Sign in", and "Get started free".
- **Why it matters**: Mobile visitors can't navigate to features or how-it-works sections.
- **Fix**: Add a simple hamburger toggle for the nav links below `md` breakpoint.
- **Suggested command**: `$impeccable adapt app/page.tsx`

### [P2] "Built on a modern stack" section is flat
- **What**: Eight tech names in gray text with no logos, no links, no visual weight. The section has very low information density and no visual interest.
- **Why it matters**: It reads as pure padding. Developers already know these tools; listing text names adds nothing.
- **Fix**: Either add small monochrome logos/icons for each tech, or collapse this into a single line in the footer. As-is, it wastes a full viewport section.
- **Suggested command**: `$impeccable distill app/page.tsx`

### [P3] CTA subtext contrast on dark green background
- **What**: The subtext in the final CTA ("Create your digital nest in 30 seconds...") uses `--ds-blue-200` (#c3dbce) on `--ds-blue-700` (#275c40). The contrast ratio is approximately 3.8:1 — below the WCAG AA 4.5:1 requirement for body text.
- **Why it matters**: PRODUCT.md explicitly requires ≥4.5:1 contrast. This is a stated accessibility commitment.
- **Fix**: Lighten the subtext to pure white or `--ds-blue-50` (#f2f7f4) on the dark green background.
- **Suggested command**: `$impeccable audit app/page.tsx`

## Persona Red Flags

**Jordan (First-Timer)**: The "Gather. Stash. Sync" tagline badge uses metaphorical language that may not immediately communicate what the product does. "Start gathering free" as the primary CTA is less clear than "Get started free" — Jordan might not understand what "gathering" means in this context. The sketchbook doodle is charming but doesn't explain the product; the Kanban preview below the fold is the real explainer, and Jordan might not scroll to it.

**Riley (Stress Tester)**: The "DONE" column in the Kanban preview is clipped ("Set up..." is cut off), which looks unfinished. The footer copyright shows the current year dynamically, which is good. No visible 404 or error handling on the landing page. The doodle image loads as a PNG with no lazy-loading attribute.

**Casey (Mobile User)**: No hamburger menu means navigation is inaccessible on mobile. The split hero layout will stack on mobile (the doodle image above or below the copy), which could push the CTA buttons below the fold. The sketchbook frame's `max-w-[400px]` will likely render well, but the Kanban preview's horizontal scroll on mobile needs testing.

## Minor Observations

- The `font-serif` on the sketchbook caption ("Observing and stashing tasks in the wild") is the only serif usage on the entire page. It works as a deliberate accent but should be noted as a one-off.
- The "How it works" numbered circles (1, 2, 3) are fine here since the content IS a genuine sequential process — this is an earned use of numbered markers per the design spec.
- The hero subtext line length is well within the 65–75ch guideline.
- No `skip-to-content` link exists for keyboard/screen-reader users.
- The sticky nav uses `backdrop-blur-sm` which is a nice touch but needs `@supports` or fallback for older browsers.

## Questions to Consider

- "What if the features section told a story instead of listing boxes?"
- "Does the stats bar earn its real estate, or is it compensating for a lack of social proof?"
- "What would happen if the Kanban preview were the hero instead of the doodle?"
