export const modeLabels = { flick: 'Флики', micro: 'Точность', track: 'Трекинг', head: 'Уровень головы', strafe: 'Стрейф-цели', peek:'Удержание угла', adjust:'Флик + доводка', six:'Шесть целей', moving:'Движущиеся головы', angles:'Проверка углов', wall3:'Стена · 3 цели', clear50:'Зачистка · 50' };
export function workoutPlan(minutes = 5) {
  return ['flick','micro','track','head','strafe'].map(mode => ({ mode, duration: minutes === 10 ? 120 : 60 }));
}
export function calibrationFactor(current, measured, reference) {
  if (![current, measured, reference].every(v => Number.isFinite(v) && v > 0)) throw new Error('Введи положительные расстояния.');
  const value = current * measured / reference;
  if (value < .1 || value > 5) throw new Error('Множитель выходит за диапазон 0.1–5. Проверь DPI и измерения.');
  return Math.round(value * 1000) / 1000;
}
export function comparableKey(row) {
  return `${row.mode}|${row.difficulty || 'normal'}|${row.duration}|${row.variant||'standard'}|${row.challengeKey||''}`;
}
export function resultScore(row){return row.mode==='clear50'?(row.completed?100000-Math.min(120000,row.elapsedMs)/1000:row.hits):row.mode==='track'?row.accuracy:row.hits/row.duration;}
export function resultLabel(row){return row.mode==='clear50'?(row.completed?`50 / 50 за ${(row.elapsedMs/1000).toFixed(2)} с`:`${row.hits} / 50 · время вышло`):row.mode==='track'?`${row.accuracy.toFixed(1)}% удержания`:`${(row.hits/row.duration).toFixed(2)} попадания/с · ${row.accuracy.toFixed(1)}%`;}
export function records(rows) {
  const result = new Map();
  for (const row of rows) {
    if (!(row.duration > 0)) continue;
    const key = comparableKey(row), score = resultScore(row);
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
