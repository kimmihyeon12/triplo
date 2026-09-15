/** Shared Tailwind recipe; String.raw preserves escaped selector underscores. */
export const INPUT_CLASSES = String.raw`
  [&.input]:h-11 [&.select]:h-11 [&.input[type='date']]:min-w-0 [&.input[type='time']]:min-w-0
  [&.input]:w-full [&.input]:min-h-11 [&.input]:border [&.input]:border-border
  [&.input]:rounded-control [&.input]:bg-panel [&.input]:py-2.5 [&.input]:px-3
  [&.input]:[transition:background-color_var(--dur)_var(--ease-out),_border-color_var(--dur)_var(--ease-out),_box-shadow_var(--dur)_var(--ease-out)]
  [&.select]:w-full [&.select]:min-w-0 [&.select]:min-h-11 [&.select]:border [&.select]:border-border
  [&.select]:rounded-control [&.select]:bg-panel [&.select]:py-2.5 [&.select]:pl-3
  [&.select]:text-14 [&.select]:font-medium [&.select]:text-ink [&.select]:cursor-pointer [&.select]:truncate
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
  [@media(hover:_hover)]:[&.select:enabled:hover]:bg-ground-2
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
  [&.textarea]:min-h-20 [&.textarea]:resize-y [&.select]:appearance-none [&.select]:pr-11
  [&.select]:bg-[url('/icons/select-chevron.svg')] [&.select]:[background-size:16px_16px]
  [&.select]:[background-repeat:no-repeat] [&.select]:[background-position:right_12px_center]
  forced-colors:[&.select]:appearance-auto forced-colors:[&.select]:bg-none
  supports-[appearance:base-select]:[&.select]:[appearance:base-select]
  [&.select::picker-icon]:hidden
  [&.select::picker(select)]:[appearance:base-select]
  [&.select::picker(select)]:rounded-control [&.select::picker(select)]:border [&.select::picker(select)]:border-border
  [&.select::picker(select)]:bg-panel [&.select::picker(select)]:p-1 [&.select::picker(select)]:shadow-float
  [&.select::picker(select)]:mt-1.5 [&.select::picker(select)]:max-h-72 [&.select::picker(select)]:overflow-y-auto
  [&.select::picker(select)]:font-body [&.select::picker(select)]:text-14 [&.select::picker(select)]:text-ink
  [&.select_option]:min-h-11 [&.select_option]:rounded-cell [&.select_option]:px-3 [&.select_option]:py-2.5
  [&.select_option]:font-body [&.select_option]:text-14 [&.select_option]:font-normal [&.select_option]:leading-normal
  [&.select_option]:whitespace-normal [&.select_option]:cursor-pointer
  [&.select_option:hover]:bg-ground-2 [&.select_option:focus]:bg-accent-tint [&.select_option:focus]:outline-none
  [&.select_option:checked]:bg-accent-tint [&.select_option:checked]:text-accent-deep [&.select_option:checked]:font-medium
  [&.select_option:disabled]:text-ink-3 [&.select_option:disabled]:cursor-not-allowed
  [&.select_option::checkmark]:text-accent-deep
  [&.input[type='date']]:pr-10 [&.input[type='time']]:pr-10
  [&.input[type='date']]:[-webkit-appearance:none] [&.input[type='time']]:[-webkit-appearance:none]
  [&.input[type='date']]:appearance-none [&.input[type='time']]:appearance-none
  [&.input[type='date']]:bg-[url('/icons/calendar.svg')] [&.input[type='time']]:bg-[url('/icons/clock.svg')]
  [&.input[type='date']]:bg-no-repeat [&.input[type='time']]:bg-no-repeat
  [&.input[type='date']]:[background-size:18px_18px] [&.input[type='time']]:[background-size:18px_18px]
  [&.input[type='date']]:[background-position:right_12px_center] [&.input[type='time']]:[background-position:right_12px_center]
  [&.input::-webkit-calendar-picker-indicator]:hidden
  [&.input::-webkit-calendar-picker-indicator]:opacity-0 [&.input::-webkit-calendar-picker-indicator]:pointer-events-none
  [&.input.range-date]:border-0 [&.input.range-date]:rounded-none [&.input.range-date]:bg-transparent
  [&.input.range-date[type='date']]:bg-none [&.input.range-date[type='date']]:px-0 [&.input.range-date[type='date']]:pr-0 [&.input.range-date]:text-14
  [&.input.range-date[type='date']]:appearance-none [&.input.range-date[type='date']]:[-webkit-appearance:none]
  [&.input.range-date:hover]:bg-transparent [&.input.range-date:focus-visible]:bg-transparent
  [&.input.range-date::-webkit-calendar-picker-indicator]:opacity-0 [&.input.range-date::-webkit-calendar-picker-indicator]:pointer-events-none
  [&.input.range-date:focus-visible]:shadow-none
  [&.input.range-date]:h-11 [&.input.range-date]:min-h-11
`;
