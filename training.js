export const modeLabels = { flick: 'Флики', micro: 'Точность', track: 'Трекинг', head: 'Уровень головы', strafe: 'Стрейф-цели' };
export function workoutPlan(minutes = 5) {
  return Object.keys(modeLabels).map(mode => ({ mode, duration: minutes === 10 ? 120 : 60 }));
}
export function calibrationFactor(current, measured, reference) {
  if (![current, measured, reference].every(v => Number.isFinite(v) && v > 0)) throw new Error('Введи положительные расстояния.');
  const value = current * measured / reference;
  if (value < .1 || value > 5) throw new Error('Множитель выходит за диапазон 0.1–5. Проверь DPI и измерения.');
  return Math.round(value * 1000) / 1000;
}
export function comparableKey(row) {
  return `${row.mode}|${row.difficulty || 'normal'}|${row.duration}`;
}
export function records(rows) {
  const result = new Map();
  for (const row of rows) {
    if (!(row.duration > 0)) continue;
    const key = comparableKey(row), score = row.mode === 'track' ? row.accuracy : row.hits / row.duration;
    const old = result.get(key);
    if (!old || score > old.score || (score === old.score && row.accuracy > old.accuracy)) result.set(key, { ...row, score });
  }
  return [...result.values()];
}
// Camera ray intersected with the plane of the intended target.
export function shotOffset(target, yaw, pitch, startAim) {
  const dz = Math.cos(pitch) * Math.cos(yaw);
  if (dz <= .01) return { x: 0, y: 0, kind: 'away', plotted: false };
  const x = (Math.cos(pitch) * Math.sin(yaw) / dz * target.z - target.x) / target.r;
  const y = (Math.sin(pitch) / dz * target.z - target.y) / target.r;
  const horizontal = target.x - startAim.x;
  let kind = 'side';
  if (Math.abs(y) > Math.abs(x)) kind = y > 0 ? 'high' : 'low';
  else if (Math.abs(horizontal) > target.r) kind = x * horizontal > 0 ? 'over' : 'under';
  return { x, y, kind, plotted: true };
}
export function strafePosition(time, phase, speed) {
  // Hold briefly at either endpoint, then smoothly reverse direction.
  const cycle = ((time * speed + phase) % 4 + 4) % 4;
  if (cycle < .45) return -5;
  if (cycle < 2) return -5 + 10 * (cycle - .45) / 1.55;
  if (cycle < 2.45) return 5;
  return 5 - 10 * (cycle - 2.45) / 1.55;
}
