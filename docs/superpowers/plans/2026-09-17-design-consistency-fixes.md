# Design Consistency Fixes Implementation Plan

> **For agentic workers:** Implement this plan task by task with tests before production changes.

**Goal:** Bring the current Triplo UI back into one interaction contract across mobile forms, date pickers, and tabs while preserving the existing deep-blue design system.

## Scope

1. Keep an expense draft mounted while switching between expense and settlement tabs so unsaved input survives.
2. Prevent the temporal picker from closing when the picker itself scrolls.
3. Make the expense date/category row stack at narrow widths.
4. Add keyboard arrow navigation and ARIA state to the shared tabs component.
5. Reconcile the active deep-blue/Pretendard visual system with stale surface briefs and the no-gradient product decision.

## Test-first tasks

- [x] Add Playwright regression coverage for expense draft preservation, the 360px date layout, picker internal scrolling, and shared tab arrow navigation.
- [x] Run the focused tests and confirm each new case fails against the current implementation.
- [x] Implement the smallest component/template changes needed for the failing cases.
- [x] Run the focused tests, then the full Vitest, lint, build, and Playwright suites.
- [x] Update the design source documents after the implementation is verified.

## Verification

- Focused mobile Playwright: 9 passed.
- Vitest: 24 files / 212 tests passed.
- Lint and architecture boundaries: 103 modules passed.
- Full Playwright: 122 passed across PC and 360px projects.
- Production build: succeeded; the existing 614.33 kB initial bundle budget warning remains.

## Files

- `app/e2e/expenses-route.spec.ts`: expense draft and narrow layout regressions.
- `app/e2e/keyboard-mobile.spec.ts` or a focused shared UI spec: tab keyboard behavior.
- `app/e2e/trip-dates.spec.ts`: picker scroll behavior.
- `app/src/app/features/expenses/feature/expenses.html`: preserve the form across tabs and responsive field layout.
- `app/src/app/shared/ui/temporal-picker/temporal-picker.ts`: ignore picker-internal scroll events.
- `app/src/app/shared/ui/tabs/tabs.ts` and `tabs.html`: roving tab focus and arrow navigation.
- `docs/design/DESIGN.md`, `docs/design/PRODUCT.md`, `.impeccable/surfaces/*.md`: align the documented visual source of truth.
