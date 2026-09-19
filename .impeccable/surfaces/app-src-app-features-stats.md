# 기록 지도 실험실

## Current authority — user attachment, direct 2.5D implementation

Supersedes all prior Higgsfield and low-height refinements below. No image generation. Follow the supplied reference: thick white cube land, discrete green aggregate stacks, blue sea, directional/contact shadows, dark green pins with white labels, raised frequency legend at lower right. Keep common PageBar, repository totals and keyboard list. 14km verified land sampling retains all 17 regions (513 cells). Clusters are aggregate symbols, not place coordinates or administrative-area choropleths; white means base terrain. Scene rendering remains on demand with one instanced block mesh. Map-specific palette lives in theme.css. Validated 74 unit tests, production build (existing warnings), mobile 360/720 and desktop 1280, cube picking/zoom/pan/reset/keyboard/empty/error recovery. Captures: output/playwright/map2-reference-{360,720,1280}.png. Full lint still has two unrelated pre-existing stats boundary violations.

## Historical design iterations

- Primary target: `app/src/app/features/voxel-map`
- Route: `/lab/map2`
- Mode: Experience, with accessible region selection and frequency reading.
- Authority: user-supplied white voxel South Korea / emerald visit frequency reference. Product truth remains in docs/design/PRODUCT.md; existing app typography is inherited.
- Surface-specific palette: pale blue sea, white unvisited land, five greens from #c8efd5 to #075a43. The palette visualizes counts, not a global brand replacement.
- Data: existing LocalVisitStats; source-labelled 2013 province geometry. Demo is opt-in and never saved.
- Controls: pan, zoom, reset, region labels, equivalent visit list. No continuous animation.
- Verification: test build and 43 targeted tests passed; desktop and 360px browser captures inspected. No horizontal overflow in mobile. Higgsfield generation is pending tool availability; current renderer is Three.js.

## Latest surface contract

Map only beneath common PageBar. No marketing intro or demo toggle. Region totals live in collapsed details. CSS uses app tokens exclusively; renderer reads panel/ok-tint/ok-ink and the legend shares its sRGB five-step scale. Rounded boxes retain the source geometry. Browser verified at 1280×900 and 360×740 using isolated synthetic trips through the real repository, then restored storage. Build and 44 tests passed. Latest screenshots: output/playwright/map2-tokens-desktop.png and map2-tokens-mobile.png. This contract supersedes the earlier opt-in demo and surface-specific palette.

## Higgsfield refinement (2026-09-18, supersedes prior layout)

Mode: Operate — read visited-region statistics on the map. Existing app authority: docs/design/DESIGN.md and theme.css. Reference generated through Higgsfield/Recraft V4.1 and stored at docs/design/references/map2-higgsfield.png; prompt and provenance are in its sibling Markdown document. Generated geography and numbers are not product data.

Use common PageBar, UiButton, IconComponent, UiSpinner and Tailwind without screen CSS. Neutral ground-2 map canvas, white unvisited cells, ok-tint to ok-ink visit scale, accent-deep interaction. Shorter, gently raised map, quiet labels, horizontal legend beneath the canvas. Visited province count and cumulative entries appear above the map; selected province/count remain below it while panning and zooming. Complete region list remains collapsed. Explain past-trip place/stay entry counts, duplicates and unclassified exclusions.

Verification: 69 related unit tests and test build passed; independent review found no important defects. Browser verified 360, 720 and 1280px widths, 44px controls, no overflow, empty state, 6/17 provinces with 118 visits and one unclassified test entry, keyboard selection and load retry. Test storage restored. Captures: output/playwright/map2-higgsfield-{360,720,1280}.png and map2-higgsfield-empty.png. Mechanical detector returned []. Full lint retains two existing stats utility-to-data dependency violations. Final build status is maintained in openspec/changes/add-voxel-visit-map/tasks.md.

## Latest authority: visit volume brief (2026-09-18)

Supersedes map-only/blue-sea and relative-frequency contracts above. Operate mode. User-supplied text pins a white/light-gray mobile travel record screen with mint-to-green rounded square volume clusters, absolute visit bands 1–2/3–5/6–10/11–20/21+, region/filter controls, numerical legend, monthly and recent-place detail, and local bottom navigation. Inherit app typography and common controls. Real province counts only; no fake visits or place coordinates. Saved itinerary kinds drive filters; culture classification and automatic district zoom remain explicitly unsupported. District navigation uses existing Seoul stats. See OpenSpec latest tasks for verification.

## Current authority: fitted terrain and saved pins (2026-09-19)

User supplied a fresh map reference and explicitly limited this revision to the map. Preserve surrounding UI. Replace separate square plates with exact shared-edge irregular extruded terrain, white land, varied green columns, pale blue sea, and contact shadows. Keep existing absolute visit bands and past-trip aggregation. Default pins represent only saved verified coordinates, including future itinerary items; group exact duplicates. Anchor pin tips at projected coordinates. Clicking terrain activates one ephemeral unsaved marker. Do not infer names, addresses, or saved coordinates. Edge-aware scrollable popovers remain inside the map. Latest verification: 320 unit tests, 146 boundary modules, production build, 360/1280px real browser checks, no overflow/page errors, test storage restored. Current captures: output/playwright/map2-fitted-map-{360,1280}.png. Details and retained warnings: OpenSpec tasks.

## Current surface: /stats (2026-09-19)

The former map2 now lives in features/stats/feature/visit-map. Both laboratory map routes, record-map sources and standalone prototype are removed. Use the app PageBar, neutral panels, 22px heading, deep-blue controls and no custom bottom navigation. Keep the bright geographic data palette, all-record scope, marker density cap and on-demand rendering. /stats/details preserves district/list functionality and provides a WebGL fallback. Verified at 360/1280px with route, authentication, deep-link and fallback checks. Current screenshots: output/playwright/stats-migrated-{360,1280}.png.
