/** Shared Tailwind recipe; String.raw preserves escaped selector underscores. */
export const ACTION_BAR_CLASSES = String.raw`
  action-bar fixed [left:0] [right:0] [bottom:0]
  [padding:10px_var(--sp-4)_calc(10px_+_env(safe-area-inset-bottom))]
  [background:color-mix(in_srgb,_var(--color-panel)_92%,_transparent)] [backdrop-filter:blur(10px)]
  [border-top:1px_solid_var(--color-border)] [z-index:10]
`;
