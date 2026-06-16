---
name: DevSync Design System
description: Whimsical yet put-together project workspace design themed around the Acorn Stash.
colors:
  primary: "#275c40"
  primary-deep: "#1c4530"
  neutral-bg: "#faf9f5"
  neutral-surface: "#ffffff"
  neutral-sunken: "#f2efe9"
  border-color: "#e5dfd3"
  accent-acorn: "#9c6d48"
  accent-ochre: "#e6b00f"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
typography:
  display:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(2.5rem, 5vw, 3.75rem)'
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: '-0.02em'
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "8px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
---

# Design System: DevSync

## 1. Overview

**Creative North Star: "Acorn Stash"**

The DevSync design system balances a whimsical, warm forest-inspired aesthetic with the clean grids and lightweight utility of a high-performance developer workspace. It bridges the organic feel of nature with the functional focus required for task management.

This system rejects sterile corporate grays and cold drop-shadows. Instead, it leverages warm, tactile board columns, clean outline borders, and a soft sketchbook vibe.

**Key Characteristics:**
*   **Warm Linen Base**: Off-white textured tones that prevent screen fatigue.
*   **Tactile Borders**: Thin, crisp borders defining components without heavy fills.
*   **Whimsical Accents**: Organic icons, warm gold warnings, and round friendly details.

## 2. Colors

The DevSync palette is built on rich foliage greens and warm woodland neutrals.

### Primary
*   **Forest Canopy Green** (#275c40): Used for primary branding elements, active sidebar items, primary call-to-actions, and main interaction states.

### Secondary
*   **Acorn Brown** (#9c6d48): Highlights secondary tags, active warnings, and priority labels.

### Tertiary
*   **Golden Ochre** (#e6b00f): Highlights warning states and specific visual anchors.

### Neutral
*   **Linen Cream** (#faf9f5): Root background color of the application.
*   **Birch Wood** (#f2efe9): Background for sidebars, board columns, and nested page elements.
*   **Stone Border** (#e5dfd3): Subtle border lines separating workspace grids.
*   **Bark Ink** (#2c2922): Primary dark text color.

### Named Rules
**The Rarity Rule.** The Forest Green accent is used on ≤10% of any given screen. Its rarity makes interactive buttons stand out instantly.

## 3. Typography

**Display Font:** Inter (ui-sans-serif, system-ui, sans-serif)
**Body Font:** Inter (ui-sans-serif, system-ui, sans-serif)

The system relies on a single geometric sans-serif family, utilising weight contrast and letter-spacing adjustments to create a modern, put-together editorial look.

### Hierarchy
*   **Display** (700, clamp(2.5rem, 5vw, 3.75rem), 1.08): Hero titles and main landing-page headers.
*   **Headline** (600, 1.5rem, 1.2): Section titles and main workspace headers.
*   **Title** (500, 1.25rem, 1.2): Column headings and modal titles.
*   **Body** (400, 0.875rem, 1.5): Standard task descriptions, chat messages, and details.
*   **Label** (500, 0.75rem, normal): Priority tags, metadata, and buttons.

### Named Rules
**The Text-Wrap Rule.** All display and headline text blocks must use `text-wrap: balance` to maintain pleasant, even line breaks without orphans.

## 4. Elevation

DevSync is flat-by-default. Depth is defined through card-stack layering and border contrast rather than complex gradients or heavy drop-shadows.

### Shadow Vocabulary
*   **Tactile raised** (`0 1px 3px rgba(24, 23, 19, 0.06)`): Default state of task cards.
*   **Sketchbook shadow** (`10px 10px 0px 0px rgba(93, 86, 70, 0.15)`): Offset solid shadow used for hero illustrations and focal points.

### Named Rules
**The Border-Only Rule.** Surface distinction is established using the Stone Border color (#e5dfd3) instead of deep dimensional shadows.

## 5. Components

### Buttons
*   **Shape:** Gently curved corners (6px radius).
*   **Primary:** Forest Canopy background with crisp white label text, padded at 8px vertical and 24px horizontal.
*   **Hover / Focus:** Transitions to Deep Forest (#1c4530) on hover.

### Chips
*   **Style:** Minimal backgrounds tinted with the corresponding priority color, utilizing thin borders and Bark Ink text.

### Cards / Containers
*   **Corner Style:** Smooth rounded corners (12px radius).
*   **Background:** White (#ffffff) on the page grid; Birch Wood (#f2efe9) inside columns.
*   **Border:** Solid 1px Stone Border.
*   **Internal Padding:** Standard 16px (spacing.md).

### Inputs / Fields
*   **Style:** White background, 6px radius, solid border.
*   **Focus:** Border shifts to Forest Canopy Green (#275c40) with a subtle, tight focus ring.

### Navigation
*   **Style:** Clean lists with 6px rounded hover states. Active items are highlighted in light Forest Green (#e2ede7) with Forest Green text.

## 6. Do's and Don'ts

### Do:
*   **Do** keep elements flat with a crisp 1px border (#e5dfd3) rather than deep, dark drop-shadows.
*   **Do** pair the playful squirrel doodle visuals with highly structured, aligned layouts so the app feels clean and put-together.
*   **Do** ensure text on Linen Cream meets contrast ratios of ≥4.5:1.

### Don't:
*   **Don't** use standard sterile SaaS blues and cold corporate grays.
*   **Don't** use busy gradient-text headers or tiny tracked uppercase eyebrows.
*   **Don't** add side-stripe color bars larger than 1px to indicate task priority or status.
