# Phase 3: Datasets Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 03-datasets-page
**Areas discussed:** List page cards, Editor page chrome, Hardcoded colors, Empty states & motion
**Pre-discussion:** Frontend-design skill visual audit + Playwright MCP screenshots in light/dark mode

---

## List Page Cards

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Phase 2 exactly | Hover lift, border-l accent (color by data source type), icon container, same spacing/shadow | ✓ |
| Light upgrade only | Hover lift + icon container, skip border-l accent | |
| Richer than Phase 2 | Phase 2 treatment + column count badge, last-run timestamp, SQL preview snippet | |

**User's choice:** Mirror Phase 2 exactly
**Notes:** Consistency across pages is the priority

---

### Card Content

| Option | Description | Selected |
|--------|-------------|----------|
| Current info is enough | Name, description, database, column count, relative time | |
| Add SQL snippet preview | First ~80 chars of SQL in monospace block on card | |
| Add column type badges | Show 2-3 role badges as colored pills below database name | ✓ |

**User's choice:** Add column type badges
**Notes:** None

---

### Row View Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Match card treatment | Hover lift, border-l accent, icon container, column role badges | ✓ |
| Keep rows minimal | Compact scan items with hover highlight only | |

**User's choice:** Match card treatment
**Notes:** None

---

### Toolbar

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is, just colorize | Apply palette tokens to match Phase 2 | ✓ |
| Add dataset count badge | Show "12 datasets" count next to search | |
| You decide | Claude's discretion | |

**User's choice:** Keep as-is, just colorize
**Notes:** None

---

### View Toggle Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Crossfade transition | AnimatePresence with 200ms opacity crossfade | ✓ |
| Instant swap is fine | Current behavior | |
| Layout animation | motion layoutId morphing | |

**User's choice:** Crossfade transition
**Notes:** None

---

### Card Load Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Stagger entrance | Cards fade+slide in with 50ms stagger delay | ✓ |
| Simple fade-in | All cards appear at once | |
| You decide | Claude's discretion | |

**User's choice:** Stagger entrance
**Notes:** None

---

### Filtered Empty State

| Option | Description | Selected |
|--------|-------------|----------|
| Use Empty component | Wrap in Empty with search icon | ✓ |
| Keep as plain text | Simple centered text line | |
| You decide | Claude's discretion | |

**User's choice:** Use Empty component
**Notes:** None

---

## Editor Page Chrome

### Section Headers

| Option | Description | Selected |
|--------|-------------|----------|
| Add section icons + subtle accent | Lucide icons + primary-tinted left border/underline | ✓ |
| Keep minimal with icon only | Icons but no color accents | |
| You decide | Claude's discretion | |

**User's choice:** Add section icons + subtle accent
**Notes:** None

---

### SQL Toolbar

**User's choice:** Free-text response — "it has a run button. but i think we can add a format button. the UX around the run button needs enhancement obviously"
**Notes:** User confirmed existing Run button is there, wants a Format button added and the Run UX to be enhanced

---

### Run Button UX

| Option | Description | Selected |
|--------|-------------|----------|
| Connection test-style state machine | Phase 2 pattern: Idle → Running → Success/Error with animations | ✓ |
| Simple loading state | Spinner while running, toast on result | |
| You decide | Claude's discretion | |

**User's choice:** Connection test-style state machine
**Notes:** None

---

### Mode Badge

| Option | Description | Selected |
|--------|-------------|----------|
| Add mode badge | "New" primary accent / "Editing" muted badge | ✓ |
| Button text is enough | Save button text differentiates | |
| You decide | Claude's discretion | |

**User's choice:** Add mode badge
**Notes:** None

---

### Column Metadata Coloring

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded role + type badges | Dimension=blue, measure=emerald, time=amber; string=slate, number=violet, date=amber, currency=emerald | ✓ |
| Color-coded roles only | Role column colored, type stays plain | |
| You decide | Claude's discretion | |

**User's choice:** Color-coded role + type badges
**Notes:** None

---

### Preview Panel Stats

| Option | Description | Selected |
|--------|-------------|----------|
| Add execution stats bar | Row count, column count, execution time as styled chips | ✓ |
| Keep current layout | Row count text + toggle is sufficient | |
| Add column type indicators | Colored dots in grid column headers | |

**User's choice:** Add execution stats bar
**Notes:** None

---

### Row Status Visual

| Option | Description | Selected |
|--------|-------------|----------|
| Colored left-border + subtle bg | Green border/tint for new, red border/tint for missing, strikethrough on missing names | ✓ |
| Just fix to CSS vars | Replace hardcoded rgba with Tailwind classes | |
| You decide | Claude's discretion | |

**User's choice:** Option 1 + "Discard all missing columns" button
**Notes:** User additionally requested a bulk discard button for missing columns so user doesn't have to remove them one by one

---

### Discard All Missing Button Placement

| Option | Description | Selected |
|--------|-------------|----------|
| In Column Metadata header bar | Destructive-variant small button, appears conditionally | ✓ |
| As a banner above the grid | Warning banner with Discard All button | |
| You decide | Claude's discretion | |

**User's choice:** In Column Metadata header bar
**Notes:** None

---

### Column Metadata Guidance

**User's choice:** Free-text — "can we do a combination of 1 and 3 dude ?"
**Notes:** User wants BOTH inline tooltips on column headers AND a full side panel (Sheet) with comprehensive reference. Tooltips for quick in-flow context, Sheet for deep understanding.

---

### Help Sheet Content

| Option | Description | Selected |
|--------|-------------|----------|
| Full field reference | Role with chart examples, Type with format implications, Aggregation explained, Format presets with live examples | ✓ |
| Quick cheat sheet | Compact table | |
| You decide | Claude's discretion | |

**User's choice:** Full field reference
**Notes:** User specifically requested "entire side panel with full explanation and understanding"

---

### Auto vs User Detection Distinction

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle indicator | Auto-detected lighter/italic, user-edited bold/normal | |
| No distinction needed | Users scan and fix, distinction adds clutter | ✓ |
| You decide | Claude's discretion | |

**User's choice:** No distinction needed
**Notes:** None

---

## Hardcoded Colors

### Shared Constants Location

| Option | Description | Selected |
|--------|-------------|----------|
| lib/style-constants.ts | Broad name for all cross-page style maps | ✓ |
| lib/theme-helpers.ts | Implies helper functions too | |
| You decide | Claude's discretion | |

**User's choice:** lib/style-constants.ts
**Notes:** User suggested naming broader to hold more constants across pages

---

### SQL Re-run Banner Colors

| Option | Description | Selected |
|--------|-------------|----------|
| Keep amber | Semantic warning convention from Phase 2, proper dark: variants | ✓ |
| Swap to destructive token | bg-destructive/10 + text-destructive | |

**User's choice:** Keep amber
**Notes:** User initially unfamiliar with when the banner appears; clarified it shows when SQL is modified but not re-executed

---

## Empty States & Motion

### "No datasets yet" Empty State

| Option | Description | Selected |
|--------|-------------|----------|
| Animated icon + subtitle | Scale + fade entrance, subtitle delay, CTA pulse | ✓ |
| Keep static, just colorize | Apply tokens but no motion | |
| You decide | Claude's discretion | |

**User's choice:** Animated icon + subtitle
**Notes:** None

---

### Editor Empty States

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle idle animation | Play icon pulse/bounce, Columns3 shimmer | ✓ |
| Static is fine | Transient states, animation wasted | |
| You decide | Claude's discretion | |

**User's choice:** Subtle idle animation
**Notes:** None

---

### Page Entrance

| Option | Description | Selected |
|--------|-------------|----------|
| Fade + slide up | Title first, toolbar with delay, content last. 200ms staggered. | ✓ |
| Keep current fade-in | Simple opacity transition | |
| You decide | Claude's discretion | |

**User's choice:** Fade + slide up
**Notes:** None

---

## Claude's Discretion

- Exact animation timing and easing curves
- Icon choices for section headers
- Help sheet content organization and depth
- Execution stats chip placement in Preview header
- SQL Format button implementation approach

## Deferred Ideas

None — discussion stayed within phase scope.
