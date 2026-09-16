import { modeLabels, records, calibrationFactor } from './training.js';

export function initDashboard({ getHistory, getSettings, applyCalibration, startCalibration, startWorkout, cancelWorkout }) {
  const $ = id => document.getElementById(id);
  const block = document.createElement('section');
  block.className = 'lab-panel';
  block.innerHTML = `<div class="section-title"><h3>Разминка по плану</h3><span>DAILY ROUTINE</span></div>
    <p>Флики → точность → трекинг → уровень головы → стрейф-цели. Пять этапов без перерыва.</p>
    <div class="inline-controls"><button id="warm5" class="secondary">Начать · 5 минут</button><button id="warm10" class="secondary">Начать · 10 минут</button><button id="cancelWarm" class="secondary" hidden>Закончить разминку</button></div><p id="warmStatus" role="status">Выбери длительность и нажми «Начать тренировку» на арене.</p>`;
  $('history').parentElement.before(block);
  const dashboard = document.createElement('section');
  dashboard.className = 'lab-panel';
  dashboard.innerHTML = `<div class="section-title"><h3>Прогресс и рекорды</h3><span>PERSONAL BEST</span></div>
    <div class="inline-controls"><label>Режим<select id="progressMode">${Object.entries(modeLabels).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label><label>Сложность<select id="progressDifficulty"><option value="normal">Нормально</option><option value="easy">Легко</option><option value="hard">Сложно</option></select></label><label>Серия<select id="progressDuration"><option value="60">60 сек</option><option value="30">30 сек</option><option value="120">120 сек</option></select></label></div>
    <label class="chart-metric">Показатель<select id="progressMetric"><option value="accuracy">Точность / удержание, %</option><option value="rate">Попадания в секунду</option><option value="interval">Интервал попаданий, мс</option></select></label><p id="recordSummary"></p><canvas id="progressChart" width="800" height="200" aria-label="Точность последних 20 сопоставимых серий"></canvas><p id="chartText" class="field-note"></p>
    <h3>Разбор последней серии</h3><div class="analysis-grid"><canvas id="missChart" hidden width="260" height="240" aria-label="Выстрелы относительно центра предполагаемой цели"></canvas><div><p id="missSummary">Здесь появятся результаты новой серии.</p><p class="field-note">Карта относительно ближайшей к прицелу цели. «Перелёт» и «недовод» — оценка направления от предыдущего попадания, а не точное определение намерения.</p></div></div>`;
  block.after(dashboard);
  const wizard = document.createElement('details');
  wizard.innerHTML = `<summary>Помощник калибровки · 360°</summary><p class="field-note">1. В CS2 измерь путь мыши для одного оборота при твоих DPI и сенсе.<br>2. Положи мышь на стартовую отметку. Нажми кнопку, затем двигай её только вправо, пока тест не остановится. Измерь пройденный путь.<br>3. Введи оба расстояния и примени поправку. Повтори для проверки.</p><button id="calibrationRun" class="secondary">Измерить оборот в браузере</button><label for="referenceCm">Путь в CS2, см</label><input id="referenceCm" type="number" min="1" max="1000" step="0.1"><label for="measuredCm">Путь в браузере, см</label><input id="measuredCm" type="number" min="1" max="1000" step="0.1"><button id="applyCalibration" class="secondary">Применить поправку</button><p id="calibrationStatus" role="status" class="field-note">Полный экран, одинаковый DPI, масштаб браузера 100%.</p>`;
  $('settingsNote').before(wizard);
  $('warm5').addEventListener('click',()=>startWorkout(5));
  $('warm10').addEventListener('click',()=>startWorkout(10));
  $('cancelWarm').addEventListener('click',cancelWorkout);
  $('calibrationRun').addEventListener('click',startCalibration);
  $('applyCalibration').addEventListener('click',()=>{
    try { const value = calibrationFactor(getSettings().calibration,Number($('measuredCm').value),Number($('referenceCm').value));
      applyCalibration(value); $('calibrationStatus').textContent=`Применён множитель ${value}. Повтори измерение для проверки.`;
    } catch(e) { $('calibrationStatus').textContent=e.message; }
  });
  function render() {
    const history = getHistory();
    const list = history.filter(r=>r.mode===$('progressMode').value && (r.difficulty||'normal')===$('progressDifficulty').value && r.duration===Number($('progressDuration').value));
    const best = records(list)[0];
    $('recordSummary').textContent = best ? `Рекорд: ${best.mode==='track'?best.accuracy.toFixed(1)+'% удержания':best.score.toFixed(2)+' попадания/с · '+best.accuracy.toFixed(1)+'% точности'} · ${list.length} серий` : 'Сопоставимых серий пока нет. Заверши тренировку с выбранными параметрами.';
    const chart=$('progressChart'),c=chart.getContext('2d'),rows=list.slice(0,20).reverse();
    const metric=$('progressMetric').value||'accuracy';const value=r=>metric==='rate'?r.hits/r.duration:metric==='interval'?(r.avgMs||0):r.accuracy;const max=metric==='accuracy'?100:Math.max(1,...rows.map(value))*1.15;
    c.clearRect(0,0,800,200);c.font='12px monospace';
    for(const n of [0,25,50,75,100]){const y=175-n*1.5;c.strokeStyle='#354432';c.beginPath();c.moveTo(40,y);c.lineTo(780,y);c.stroke();c.fillStyle='#91998e';c.fillText(metric==='accuracy'?n+'%':(n/100*max).toFixed(metric==='rate'?1:0),0,y+4);}
    c.strokeStyle='#c5f96b';c.lineWidth=2;c.beginPath();rows.forEach((r,i)=>{const x=50+i*720/Math.max(1,rows.length-1),y=175-value(r)/max*150;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();
    for(let i=0;i<rows.length;i++){c.fillStyle='#c5f96b';c.beginPath();c.arc(50+i*720/Math.max(1,rows.length-1),175-value(rows[i])/max*150,3,0,6.29);c.fill();}
    $('chartText').textContent=metric!=='accuracy'&&$('progressMode').value==='track'?'Для трекинга используй показатель удержания. В этом режиме нет одиночных выстрелов.':rows.length?`Слева — старые серии, справа — новые. ${rows.map(r=>`${r.date}: ${r.accuracy.toFixed(1)}%${r.avgMs?' / '+r.avgMs+' мс':''}`).join(' · ')}`:'График появится после первой серии. Сравниваются одинаковые режим, сложность и длительность.';
  }
  for(const id of ['progressMode','progressDifficulty','progressDuration','progressMetric']) $(id).addEventListener('change',render);
  function analysis(row, samples) {
    $('missChart').hidden=false;
    const c=$('missChart').getContext('2d');c.clearRect(0,0,260,240);c.strokeStyle='#536147';c.beginPath();c.arc(130,120,30,0,6.29);c.moveTo(0,120);c.lineTo(260,120);c.moveTo(130,0);c.lineTo(130,240);c.stroke();
    if(row.mode==='track'){$('missSummary').textContent=`${row.accuracy.toFixed(1)}% удержания · ${(row.duration*row.accuracy/100).toFixed(1)} с на цели. Карта промахов относится к режимам одиночных выстрелов.`;return;}
    const counts={under:0,over:0,high:0,low:0,side:0,away:0};
    for(const sample of samples){if(!sample.hit)counts[sample.kind]++;if(!sample.plotted)continue;c.fillStyle=sample.hit?'#c5f96b':'#f88352';c.beginPath();c.arc(Math.max(4,Math.min(256,130+sample.x*30)),Math.max(4,Math.min(236,120-sample.y*30)),2.5,0,6.29);c.fill();}
    $('missSummary').textContent=`${row.hits} / ${row.shots} попаданий · ${(row.hits/row.duration).toFixed(2)}/с · интервал ${row.avgMs||'—'} мс. Недовод: ${counts.under}, перелёт: ${counts.over}, выше: ${counts.high}, ниже: ${counts.low}, сбоку: ${counts.side}, вне обзора: ${counts.away}. Зелёный — попадания, оранжевый — промахи. Дальние выстрелы показаны на краю карты.${samples.length<row.shots?' Карта ограничена последними 1000 выстрелами.':''}`;
  }
  render();
  return { render, analysis, lock(value){for(const id of ['warm5','warm10','calibrationRun','applyCalibration'])$(id).disabled=value;},
    workout(text, active){$('warmStatus').textContent=text;$('cancelWarm').hidden=!active;},
    calibration(text){$('calibrationStatus').textContent=text;} };
}
