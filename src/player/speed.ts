/**
 * Playback speed range and presets, as in AntennaPod's speed dialog:
 * a 0.5×–4.0× slider in 0.05 steps plus user-editable preset chips.
 */

export const MIN_SPEED = 0.5;
export const MAX_SPEED = 4;
export const SPEED_STEP = 0.05;

/** Sage Pod's original rate chips, kept as the default presets. */
export const DEFAULT_SPEED_PRESETS: readonly number[] = [0.8, 1, 1.2, 1.5, 1.75, 2, 2.5, 3];

/** Clamps to the range and snaps to the 0.05 grid (avoiding float noise). */
export function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const snapped = Math.round(value / SPEED_STEP) * SPEED_STEP;
  return Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, snapped)) * 100) / 100;
}

/** "1×", "1.25×", "0.8×" */
export function formatSpeed(value: number): string {
  return `${Number(clampSpeed(value).toFixed(2))}×`;
}

/** Presets are stored as a comma-separated string setting; bad entries are dropped. */
export function parsePresets(raw: string): number[] {
  const values = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map(clampSpeed);
  const unique = [...new Set(values)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_SPEED_PRESETS];
}

export function serializePresets(presets: readonly number[]): string {
  return presets.join(',');
}

/** Adds the speed as a preset, or removes it if it is one (the sheet's "save preset" toggle). */
export function togglePreset(presets: readonly number[], speed: number): number[] {
  const value = clampSpeed(speed);
  const next = presets.includes(value) ? presets.filter((preset) => preset !== value) : [...presets, value];
  return next.sort((a, b) => a - b);
}
