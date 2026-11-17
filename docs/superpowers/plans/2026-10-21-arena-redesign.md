# GameON inclusive games redesign

**Goal:** Revamp the existing registration, live board, rules, login and organiser UI with a coherent gaming identity and better usability.

**Architecture:** Keep the React/TypeScript application, API contracts, event data and registration logic. Add shared presentation components and a cohesive theme. Use local fonts, SVG artwork and transform/opacity animation without a heavy rendering library.

**Design decisions (amended after user feedback):** Present GameON as a charity games gathering for retro, social, board and cyber play. Warm navy backgrounds, amber actions and equal pastel illustration tiles for carrom, cards, chess and a controller replace the cyber-heavy hero. Lead with “Play your way. Do good.” Use welcoming wording, condensed display type with readable sans-serif forms, tactile controls, clear focus rings and responsive grids. Decorative movement stops for reduced motion and can be paused.

## Implementation

- [x] Shared brand, public navigation, motion preference and original mixed-game illustrations.
- [x] Registration hero, event information strip, clearer package cards and selection guidance.
- [x] Live board hero, readable game filters, accessible display mode and game rules.
- [x] Organiser dashboard, login and common tables/forms/cards in the same theme; mobile navigation focus management.
- [x] Verify existing test suite, production build, browser interactions and responsive layouts at 375, 768, 1024 and 1440 pixels.

## Review focus

- Preserve all existing registration request/recovery behavior, actual prices and availability.
- No fabricated event statistics, prizes, dates or games.
- Public live board stays read-only and has no organiser navigation.
- Keyboard users can exit mobile navigation and restore focus; filters expose selected states.
- Motion pause is persistent, reduced-motion is respected, content remains visible without animation.
- No document overflow on mobile; tables and brackets scroll within their containers.
- Existing server on port 4310 continues to use the real event; browser mutation checks use a separate temporary sample event.

## Evidence

The prior revamp baseline had 101 tests across 13 files. Its esports direction was corrected after the user noted that it underrepresented retro, social and board games. UI/UX Pro Max search `playful vibrant` in the style domain matched Vibrant & Block-based; use its playful shapes and balanced colour blocks with warmer colours chosen for this event. CSS/SVG remains the lightweight implementation.

Current verification: 103 tests pass across 14 files. The live filter test now uses UNO, which exists in the demo roster; the rules banner is restored to the top of the live board. Registration selection and prices remain unchanged.

The final production build passes. Browser checks at 375, 768, 1024 and 1440 pixels show no horizontal page overflow. Social Bundle selection resolves to UNO, Pictionary and Charades at LKR 1,200. Display mode and navigation work; pausing motion stops all four illustration tiles. Final preview: `.superpowers/gameon-inclusive-desktop.jpg`. The separate review agent was unavailable after two service errors; local diff inspection and browser verification found and resolved the inherited rules-banner flex sizing issue.
