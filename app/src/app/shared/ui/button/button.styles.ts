/** Shared Tailwind recipe; String.raw preserves escaped selector underscores. */
export const BUTTON_CLASSES = String.raw`
  btn relative inline-flex items-center justify-center gap-1.5 min-h-11 rounded-control border
  border-border bg-panel text-ink font-semibold text-14 no-underline py-0 px-4
  [transition:background-color_var(--dur)_var(--ease-out),_color_var(--dur)_var(--ease-out),_transform_90ms_var(--ease-out)]
  after:absolute after:h-11 after:[content:''] after:[left:0] after:[right:0] after:[top:50%]
  after:[transform:translateY(-50%)] hover:bg-ground-2 active:bg-ground-2
  active:scale-[0.97] [&:disabled:active]:scale-100 [&[aria-disabled='true']:active]:scale-100
  motion-reduce:transition-none motion-reduce:active:scale-100
  [&.btn--primary:active]:bg-accent-deep-hover [-webkit-tap-highlight-color:transparent]
  disabled:opacity-[0.45] [&[aria-disabled='true']]:opacity-[0.45] [&:disabled:active]:bg-panel
  [&[aria-disabled='true']:active]:bg-panel [&.btn--primary]:bg-accent-deep [&.btn--primary]:text-white
  [@media(hover:_hover)]:[&.btn--primary:hover]:bg-accent-deep-hover [&.btn--danger]:bg-danger-tint
  [&.btn--danger]:text-danger-ink
  [@media(hover:_hover)]:[&.btn--danger:hover]:bg-danger-fill [&.btn--danger:active]:bg-danger-fill
  [&.btn--ghost]:bg-transparent [&.btn--ghost]:min-h-9 [&.btn--ghost]:text-ink-2
  [&.btn--ghost]:font-medium [&.btn--ghost]:py-0 [&.btn--ghost]:px-3
  [@media(hover:_hover)]:[&.btn--ghost:hover]:bg-ground-2
  [@media(hover:_hover)]:[&.btn--ghost:hover]:text-ink [&.btn--sm]:min-h-8 [&.btn--sm]:text-13
  [&.btn--sm]:rounded-cell [&.btn--sm]:py-0 [&.btn--sm]:px-2.5 [&.btn--icon]:w-9 [&.btn--icon]:min-h-9
  [&.btn--icon]:p-0 [&.btn--icon]:bg-transparent [&.btn--icon]:border-transparent
  [&.btn--icon]:text-ink-2 [&.btn--icon]:rounded-control [&.btn--icon::after]:[left:-4px]
  [&.btn--icon::after]:[right:-4px] [@media(hover:_hover)]:[&.btn--icon:hover]:bg-ground-2
  [@media(hover:_hover)]:[&.btn--icon:hover]:text-ink [.flex.items-center_.input_+_&]:min-h-11
  [.flex.items-center_.select_+_&]:min-h-11 [.action-bar\_\_inner_&]:flex-1
  [.action-bar\_\_inner_&]:min-h-11 [.action-bar\_\_inner_&]:text-14
  [.action-bar\_\_inner_&]:rounded-control
`;
