/** Shared Tailwind recipe; String.raw preserves escaped selector underscores. */
export const BADGE_CLASSES = String.raw`
  cell inline-flex items-center gap-1 min-h-5.5 rounded-cell text-12 font-medium whitespace-nowrap
  leading-[1.5] py-0.5 px-2 [border:1px_solid_transparent] [&.cell--accent]:bg-accent-tint
  [&.cell--accent]:text-accent-deep [&.cell--place]:bg-place-tint [&.cell--place]:text-place-ink
  [&.cell--stay]:bg-stay-tint [&.cell--stay]:text-stay-ink [&.cell--warn]:bg-warn-tint
  [&.cell--warn]:text-warn-ink [&.cell--danger]:bg-danger-tint [&.cell--danger]:text-danger-ink
  [&.cell--ok]:bg-ok-tint [&.cell--ok]:text-ok-ink [&.cell--ghost]:bg-panel [&.cell--ghost]:text-ink-3
  [&.cell--ghost]:border-border [&.cell--solid-accent]:bg-accent-deep [&.cell--solid-accent]:text-white
  [&.cell--solid-accent]:font-bold
`;
