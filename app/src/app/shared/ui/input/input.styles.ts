/** Shared Tailwind recipe; String.raw preserves escaped selector underscores. */
export const INPUT_CLASSES = String.raw`
  [&.input]:h-11 [&.select]:h-11 [&.input[type='date']]:min-w-0 [&.input[type='time']]:min-w-0
  [&.input]:w-full [&.input]:min-h-11 [&.input]:border [&.input]:border-border
  [&.input]:rounded-control [&.input]:bg-panel [&.input]:py-2.5 [&.input]:px-3
  [&.input]:[transition:background-color_var(--dur)_var(--ease-out),_border-color_var(--dur)_var(--ease-out),_box-shadow_var(--dur)_var(--ease-out)]
  [&.select]:w-full [&.select]:min-h-11 [&.select]:border [&.select]:border-border
  [&.select]:rounded-control [&.select]:bg-panel [&.select]:py-2.5 [&.select]:px-3
  [&.select]:[transition:background-color_var(--dur)_var(--ease-out),_border-color_var(--dur)_var(--ease-out),_box-shadow_var(--dur)_var(--ease-out)]
  [&.textarea]:w-full [&.textarea]:min-h-11 [&.textarea]:border [&.textarea]:border-border
  [&.textarea]:rounded-control [&.textarea]:bg-panel [&.textarea]:py-2.5 [&.textarea]:px-3
  [&.textarea]:[transition:background-color_var(--dur)_var(--ease-out),_border-color_var(--dur)_var(--ease-out),_box-shadow_var(--dur)_var(--ease-out)]
  [&.input::placeholder]:text-ink-3 [&.textarea::placeholder]:text-ink-3
  [&.input:disabled]:cursor-not-allowed [&.input:disabled]:bg-ground-2 [&.input:disabled]:text-ink-3
  [&.select:disabled]:cursor-not-allowed [&.select:disabled]:bg-ground-2
  [&.select:disabled]:text-ink-3 [&.textarea:disabled]:cursor-not-allowed
  [&.textarea:disabled]:bg-ground-2 [&.textarea:disabled]:text-ink-3
  [@media(hover:_hover)]:[&.input:hover]:bg-ground-2
  [@media(hover:_hover)]:[&.select:hover]:bg-ground-2
  [@media(hover:_hover)]:[&.textarea:hover]:bg-ground-2 [&.input:focus-visible]:bg-panel
  [&.input:focus-visible]:border-accent-deep [&.input:focus-visible]:[outline:none]
  [&.input:focus-visible]:[box-shadow:0_0_0_3px_var(--color-accent-tint)]
  [&.select:focus-visible]:bg-panel [&.select:focus-visible]:border-accent-deep
  [&.select:focus-visible]:[outline:none]
  [&.select:focus-visible]:[box-shadow:0_0_0_3px_var(--color-accent-tint)]
  [&.textarea:focus-visible]:bg-panel [&.textarea:focus-visible]:border-accent-deep
  [&.textarea:focus-visible]:[outline:none]
  [&.textarea:focus-visible]:[box-shadow:0_0_0_3px_var(--color-accent-tint)]
  [&.input[aria-invalid='true']]:border-danger-ink [&.input[aria-invalid='true']]:bg-danger-tint
  [&.select[aria-invalid='true']]:border-danger-ink [&.select[aria-invalid='true']]:bg-danger-tint
  [&.textarea]:min-h-20 [&.textarea]:resize-y [&.select]:appearance-auto [&.select]:pr-9
  [&.select]:[background-repeat:no-repeat] [&.select]:[background-position:right_12px_center]
`;
