export function clamp(value: number,
  min: number = 0,
  max: number = 1): number {
  if (min > max) {
    [min, max] = [max, min];
  }

  return Math.max(min, Math.min(max, value));
}

export function normalize(value: number,
  currentScaleMin: number,
  currentScaleMax: number,
  newScaleMin: number = 0,
  newScaleMax: number = 1): number {
  const standardNormalization
    = (value - currentScaleMin) / (currentScaleMax - currentScaleMin);

  return (
    (newScaleMax - newScaleMin) * standardNormalization + newScaleMin
  );
}

export function clampedNormalize(value: number,
  currentScaleMin: number,
  currentScaleMax: number,
  newScaleMin: number = 0,
  newScaleMax: number = 1): number {
  return clamp(
    normalize(
      value,
      currentScaleMin,
      currentScaleMax,
      newScaleMin,
      newScaleMax,
    ),
    newScaleMin,
    newScaleMax,
  );
}
