export interface VisitPalette { land: string; low: string; high: string; middle?: string }

export const VISIT_STEPS = [
  { min: 1, label: '1–2회', height: 4, radius: 1.1 },
  { min: 3, label: '3–5회', height: 8, radius: 1.65 },
  { min: 6, label: '6–10회', height: 14, radius: 2.2 },
  { min: 11, label: '11–20회', height: 22, radius: 2.7 },
  { min: 21, label: '21회 이상', height: 32, radius: 3.2 },
] as const;

export function visitLevel(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return VISIT_STEPS.filter(step => count >= step.min).length;
}

/** Zero visits never receives a green tint. All visited regions share one scale. */
export function visitStyle(count: number, _max: number, palette: VisitPalette): { color: string; height: number } {
  const level = visitLevel(count);
  if (!level) return { color: palette.land, height: 1 };
  return { color: visitColor((level - 1) / 4, palette), height: VISIT_STEPS[level - 1].height };
}

/** Continuous shading within a cluster; the peak uses its fixed visit band. */
export function visitColor(strength: number, palette: VisitPalette): string {
  const step = Math.min(1, Math.max(0, strength));
  const low = palette.middle && step > 0.5 ? palette.middle : palette.low;
  const high = palette.middle && step <= 0.5 ? palette.middle : palette.high;
  const blend = palette.middle ? (step <= 0.5 ? step * 2 : (step - 0.5) * 2) : step;
  const channel = (hex: string, index: number) => parseInt(hex.slice(index, index + 2), 16);
  const color = '#' + [1, 3, 5].map(i => Math.round(channel(low, i) * (1 - blend) + channel(high, i) * blend).toString(16).padStart(2, '0')).join('');
  return color;
}
