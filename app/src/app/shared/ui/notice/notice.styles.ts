/** Shared Tailwind recipe; String.raw preserves escaped selector underscores. */
export const NOTICE_CLASSES = String.raw`
  notice rounded-control text-13 leading-[1.5] flex gap-2 items-start py-2.5 px-3
  [&.notice--warn]:bg-warn-tint [&.notice--warn]:text-warn-ink [&.notice--danger]:bg-danger-tint
  [&.notice--danger]:text-danger-ink [&.notice--ok]:bg-ok-tint [&.notice--ok]:text-ok-ink
`;
