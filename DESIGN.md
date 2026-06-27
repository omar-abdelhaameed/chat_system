---
version: "alpha"
name: "Real-Time Chat System"
description: "A dark, dense, Spotify-inspired chat workspace for secure rooms, live messaging, and operational state."
colors:
  primary: "#1ED760"
  on-primary: "#000000"
  background: "#121212"
  surface: "#181818"
  surface-raised: "#1F1F1F"
  surface-hover: "#252525"
  outline: "#4D4D4D"
  outline-bright: "#7C7C7C"
  text: "#FFFFFF"
  text-muted: "#B3B3B3"
  success: "#1ED760"
  error: "#F3727F"
  warning: "#FFA42B"
  info: "#539DF5"
  avatar-teal: "#1ED760"
  avatar-blue: "#539DF5"
  avatar-orange: "#FFA42B"
  avatar-red: "#F3727F"
  avatar-gray: "#B3B3B3"
typography:
  display:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "60px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0em"
  display-mobile:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0em"
  headline:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0em"
  title:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0em"
  body:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "0em"
  body-compact:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  body-compact-bold:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0em"
  label:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "1.4px"
  label-wide:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "1.8px"
  caption:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  micro:
    fontFamily: "SpotifyMixUI, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0em"
spacing:
  "0": "0px"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
  "8": "32px"
  "10": "40px"
  "11": "44px"
  "12": "48px"
  "16": "64px"
  panel-padding: "16px"
  page-padding: "32px"
  sidebar-width: "292px"
  inspector-width: "300px"
  room-list-min: "292px"
  room-list-max: "376px"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "18px"
  panel: "22px"
  bubble: "24px"
  hero-media: "28px"
  full: "9999px"
radii:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "18px"
  panel: "22px"
  bubble: "24px"
  hero-media: "28px"
  full: "9999px"
shadows:
  medium: "rgba(0, 0, 0, 0.3) 0px 8px 8px"
  heavy: "rgba(0, 0, 0, 0.5) 0px 8px 24px"
  inset-line: "rgb(18, 18, 18) 0px 1px 0px, rgb(124, 124, 124) 0px 0px 0px 1px inset"
elevation:
  base:
    backgroundColor: "{colors.background}"
    shadow: "none"
  panel:
    backgroundColor: "{colors.surface}"
    shadow: "{shadows.heavy}"
  raised:
    backgroundColor: "{colors.surface-raised}"
    shadow: "{shadows.medium}"
  field:
    backgroundColor: "{colors.surface-raised}"
    shadow: "{shadows.inset-line}"
motion:
  duration-fast: "150ms"
  duration-standard: "200ms"
  duration-slow: "250ms"
  ease-standard: "cubic-bezier(0.4, 0, 0.2, 1)"
  ease-out: "cubic-bezier(0, 0, 0.2, 1)"
  hover-lift-sm: "scale(1.01)"
  hover-lift-md: "scale(1.03)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "0px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "0px 20px"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0px 16px"
  icon-button:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.full}"
    height: "40px"
    width: "40px"
  input-pill:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "12px 20px"
  app-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "16px"
  room-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "12px"
  room-card-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "12px"
  message-bubble-incoming:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    typography: "{typography.body-compact-bold}"
    rounded: "{rounded.bubble}"
    padding: "12px 16px"
  message-bubble-outgoing:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.bubble}"
    padding: "12px 16px"
  bottom-room-pill-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "8px 12px"
---

# Design System: Real-Time Chat System

## Overview

**Creative North Star: "The Dark Signal Room"**

This product is a task-focused chat workspace with a near-black, audio-console atmosphere. The interface should feel quiet, operational, and highly readable: rooms sit in stacked panels, messages travel through a dark transcript, and every bright color communicates state, identity, or action. The system borrows the confidence of Spotify's dark UI without becoming a music app: rounded geometry, dense information, and a single vivid green action language.

The visual identity is immersive rather than decorative. The background is almost black, panels are charcoal, and color appears in controlled bursts: green for primary actions and outgoing messages, red and orange for system risk, blue and teal as room/avatar identity. Heavy shadows make panels read as physical modules in darkness. On mobile, the system collapses into a focused chat surface with a bottom room rail, preserving the same pill controls, green action states, and compact typography.

**Key Characteristics:**
- Near-black canvas with charcoal panels and tile-like hover states.
- One functional primary accent: electric green for actions, active states, unread counts, selections, and outgoing messages.
- Compact, bold product typography with uppercase tracked labels.
- Rounded panels, circular avatars, full-pill buttons, and clipped message bubbles.
- Dense task layout: sidebar, room list, transcript, and inspector on desktop; focused transcript plus bottom room rail on mobile.
- Heavy black shadows and inset field shadows instead of bright borders.

## Colors

The palette is a restrained dark system: deep neutral surfaces carry almost every pixel, while saturated colors are reserved for state and identity.

### Primary
- **Signal Green:** The primary action and success color. Use it for send buttons, creation actions, active room pills, unread badges, connected status, outgoing message bubbles, selection rings, and text selection.
- **Ink Black:** The readable color placed on green actions and outgoing message bubbles. Green should usually carry black text/icons, not white.

### Semantic
- **Recovery Red:** The danger and offline color. Use it for offline banners, destructive actions, failed messages, validation errors, and blocking system states.
- **Queue Orange:** The warning color. Use it for reconnecting, rate-limited, or delayed states where the user can continue but should be aware.
- **Transport Blue:** The informational color. Use it sparingly for avatar gradients and informational accents, not primary actions.

### Neutral
- **Room Ink:** The base page and transcript background. It is the darkest layer and should dominate the surface.
- **Panel Charcoal:** The primary panel layer for sidebars, headers, forms, and inspectors.
- **Raised Charcoal:** The interactive layer for nav items, rows, room cards, inputs, and message bubbles.
- **Hover Tile:** The hover and active-fill layer for raised controls that are not green.
- **Divider Gray:** The subtle separator and scrollbar color. Use it with low opacity on large structural borders.
- **Muted Silver:** Secondary text, metadata, placeholders, inactive navigation, and section labels.
- **Clean White:** Primary text only. Do not use white as a large surface.

### Named Rules

**The Green Means Action Rule.** Signal Green is functional only. It means send, create, connected, selected, unread, or mine. Do not use it as ambient decoration or random emphasis.

**The Dark Theater Rule.** The UI should recede behind conversations. If a surface is brighter than Hover Tile and is not a semantic state, it is probably too loud.

**The Avatar Color Exception.** Room avatars may use green, blue, orange, red, or gray gradients. Those colors identify rooms; they do not authorize broader palette expansion.

## Typography

**Display Font:** SpotifyMixUI with global CircularSp fallbacks, then Helvetica Neue, Helvetica, Arial, sans-serif.
**Body Font:** SpotifyMixUI with the same fallback stack.
**Label Font:** SpotifyMixUI, uppercase, bold, and widely tracked.

The typography is compact and utilitarian. Hierarchy comes from bold weight, tight scale changes, and uppercase tracking rather than ornate display styling. Labels behave like hardware markings on a control surface; message content stays clear and direct.

### Hierarchy
- **Display** (700, 60px, 1 line-height): Use only for the unauthenticated hero message on wide screens.
- **Display Mobile** (700, 36px, 1.15 line-height): Use when the same hero message collapses below desktop width.
- **Headline** (700, 24px, 1.25 line-height): Page titles such as Rooms, Room Info, and inspector names.
- **Title** (700, 18px, 1.35 line-height): Compact content headings, empty states, and important chat headers.
- **Body** (400, 16px, 1.75 line-height): Longer explanatory copy, login page supporting text, and prose-like descriptions.
- **Compact Body** (400, 14px, 1.5 line-height): Default UI text, message composer text, metadata rows, and room descriptions.
- **Compact Bold Body** (700, 14px, 1.35 line-height): Room names, message text emphasis, user names, and row values.
- **Label** (700, 12px, 1.4px tracking, uppercase): Buttons, form labels, section counters, and compact controls.
- **Wide Label** (700, 11px, 1.8px tracking, uppercase): Section kickers such as workspace rooms, chat system, and room summary.
- **Caption** (400, 12px, 1.65 line-height): Metadata, room descriptions, member counts, helper text, and secondary explanations.
- **Micro** (700, 10px, 1 line-height): Sequence numbers, unread counts, receipt chips, and tiny state badges.

### Named Rules

**The Bold Scan Rule.** Product nouns and row values should be bold; explanatory text and metadata should be muted regular weight. This keeps dense panels scannable.

**The Label Hardware Rule.** Buttons and section labels use uppercase tracking. Do not apply this treatment to message content or conversational copy.

## Layout

The desktop layout is a four-region workspace: fixed left sidebar, room list, central chat transcript, and optional right inspector. The room list stays between a narrow and medium width so message reading keeps priority. The inspector is a narrow utility rail, not a full detail page.

Spacing follows a 4px-derived scale with 8px as the practical rhythm. Dense controls use 8px to 16px internal gaps. Panels use 16px to 32px padding depending on their importance. Big empty spaces are rare; the interface should feel occupied and ready for work.

On mobile, the room list and inspector disappear from the first view. The header, transcript, composer, and bottom room rail become the entire experience. The mobile bottom rail uses pill room buttons, not tabs, so each room remains visually tied to its avatar color.

### Layout Tokens
- **Sidebar Width:** A stable 292px rail for navigation, room shortcuts, and user identity.
- **Room List:** A 292px to 376px middle column that can flex but should not swallow the transcript.
- **Inspector Width:** A 300px right rail for room summary and operational status.
- **Panel Padding:** 16px is the default internal panel padding.
- **Page Padding:** 32px is used for spacious settings and form surfaces on large screens.
- **Transcript Rhythm:** Message bubbles should have generous vertical gaps and never span the full width; incoming messages cap near 58 percent on desktop and 84 percent on mobile.

## Elevation & Depth

Depth is created through tonal layers and heavy black shadows. This is a dark product, so subtle light shadows will not read. Panels float on the base canvas with a large ambient shadow; interactive rows and cards use a smaller dense shadow. Text fields use an inset line treatment that feels recessed rather than bordered.

### Shadow Vocabulary
- **Medium Shadow:** Use for room cards, icon buttons, avatars, active pills, and small floating controls.
- **Heavy Shadow:** Use for major panels, auth forms, sidebars, room settings cards, inspectors, and large media blocks.
- **Inset Line Shadow:** Use for inputs, text areas, and file-selection rows. This creates a tactile input edge without a bright outline.

### Named Rules

**The Floating Panel Rule.** Major containers should feel like modules sitting above the dark canvas. If a large panel has no shadow, it will flatten into the transcript.

**The Inset Field Rule.** Text-entry controls are recessed. Use inset-line treatment plus green focus rings; do not replace inputs with plain borders.

## Shapes

The shape language is rounded, tactile, and touch-ready. The system combines very soft rectangular panels with full-pill controls and circular identity marks. Sharp corners should be rare and intentional.

### Radius Vocabulary
- **Tiny Radius:** 4px for bubble tails and small state tags.
- **Small Radius:** 6px for compact cards and legacy rectangular auth elements.
- **Medium Radius:** 8px for simple forms and small utility cards.
- **Row Radius:** 18px for list rows, detail rows, and empty-state boxes.
- **Panel Radius:** 22px for sidebars, room cards, settings cards, and major containers.
- **Bubble Radius:** 24px for message bubbles and text areas.
- **Hero Media Radius:** 28px for large room imagery or inspector media panels.
- **Full Pill:** 9999px for buttons, navigation items, chips, inputs, badges, avatars, and bottom-room pills.

### Named Rules

**The Pill Control Rule.** If an element is a button, chip, tab, nav item, search field, or status badge, it should usually be a pill.

**The Bubble Tail Rule.** Message bubbles stay rounded overall, but the speaker-side bottom corner can tighten to show conversational direction.

## Components

### Buttons

Buttons are bold, uppercase, and pill-shaped. Primary buttons use Signal Green with black text. Secondary buttons use raised charcoal with muted text, becoming white on hover. Destructive buttons use Recovery Red with black text and the same pill geometry as primary actions.

- **Primary:** Signal Green background, black text, 48px height, 20px horizontal padding, uppercase label, full-pill radius.
- **Secondary:** Raised Charcoal background, muted or white text, 40px height, 16px horizontal padding, full-pill radius.
- **Icon:** 40px circular button on Raised Charcoal with muted icon color; hover makes the icon white and slightly larger.
- **Hover / Focus:** Hover uses small scale changes only. Focus uses a visible green outline or green ring.
- **Disabled:** Lower opacity, no bright hover, and no transform.

### Inputs / Fields

Inputs are pill-shaped, dark, and inset. Search fields and message composers sit on Raised Charcoal, use white input text, muted placeholders, and an inset-line shadow. Focus should add a green ring. The composer is taller and uses Bubble Radius, keeping it visually related to message bubbles.

### Navigation

Navigation uses stacked dark panels and full-pill row buttons. Active nav items fill with Raised Charcoal, switch to white text, and use bold weight. Inactive nav items remain Muted Silver and only brighten on hover. Mobile navigation uses a bottom rail of horizontal room pills with avatar dots and truncated room names.

### Room Cards

Room cards are raised charcoal panels with a 22px radius, compact padding, and a medium shadow. The active room gains a subtle green ring and the card fill may brighten to Hover Tile. Room avatars are circular gradients that identify the room independently of unread state.

### Message Bubbles

Incoming bubbles are Raised Charcoal with white text and compact bold sender labels. Outgoing bubbles are Signal Green with black text. Both use Bubble Radius and medium shadows. The speaker-side bottom corner can tighten to 4px to create direction. Receipt chips are tiny full pills and should not overpower the message.

### Status And State Banners

Status chips are compact pills using semantic color only when the state matters. Offline banners may use Recovery Red across the transcript because they interrupt sending. Reconnecting and rate-limit banners use Queue Orange. Success and connected states stay small and green.

### Panels And Inspectors

Panels are rounded charcoal modules with heavy shadows. Inspectors and settings pages use the same surfaces as the chat workspace, not a separate admin theme. Detail rows are Row Radius surfaces on Raised Charcoal with muted labels and bold white values.

### Motion

Motion is short and state-driven. Use 150ms to 250ms transitions for color, opacity, box-shadow, focus rings, and small transform feedback. Hover scale should stay between 1.01 and 1.03. Do not choreograph page entrances; the product should load directly into the task.

## Do's and Don'ts

### Do:
- **Do** keep the base canvas near-black and let panels, messages, and state carry hierarchy.
- **Do** use Signal Green for the most important action or selected state on a screen.
- **Do** keep room avatars colorful, circular, and visually separate from action colors.
- **Do** use bold 14px text for primary row labels and message content in dense UI.
- **Do** use uppercase tracked labels for buttons, section kickers, and compact controls.
- **Do** preserve the desktop structure of sidebar, room list, transcript, and inspector when width allows.
- **Do** preserve the mobile structure of focused transcript plus bottom room rail.
- **Do** use heavy shadows for major panels and inset shadows for fields.
- **Do** maintain accessible contrast: white or muted silver on charcoal, black on green, black on red/orange warning fills.

### Don't:
- **Don't** use green as decoration, background wash, or random emphasis. Green must mean action, selected, unread, connected, success, or mine.
- **Don't** introduce light surfaces for primary screens. White belongs to text, not panels.
- **Don't** replace pill controls with square buttons or sharp tabs.
- **Don't** use pale low-contrast borders as the main depth device. Use tonal layers, shadows, and inset field treatment.
- **Don't** add gradient text, glassmorphism, neon glows, or decorative purple-blue gradients.
- **Don't** over-animate. Hover scale and focus feedback are enough for this product.
- **Don't** turn desktop room lists into card grids. This is a workspace, not a marketing surface.
- **Don't** make message bubbles full-width on desktop; conversation needs visible rhythm and direction.
- **Don't** mix icon styles. Use consistent rounded line icons with compact sizes.
