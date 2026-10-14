import { clamp, rotateMouse, sensitivityMetrics } from './engine.js';
import { workoutPlan, modeLabels, resultLabel } from './training.js';
import { MODES, Scenario, seededRandom } from './scenarios.js';
import { ArenaRenderer } from './renderer.js';
import { initDashboard } from './dashboard.js';
import { initCloud } from './cloud.js';
const $=id=>document.getElementById(id),canvas=$('scene'),arena=$('arena');
const defaults={sensitivity:1,dpi:800,duration:60,difficulty:'normal',aspect:'native',sound:true,color:'#c5f96b',calibration:1,variant:'standard',challengeKey:new Date().toISOString().slice(0,10)};
let settings={...defaults},history=[],historyKey='deadaim-history',storageOK=true;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const cleanHistory=rows=>Array.isArray(rows)?rows.filter(r=>r&&MODES[r.mode]&&Number.isFinite(r.hits)&&Number.isFinite(r.accuracy)&&typeof r.date==='string').slice(0,500):[];
const saved=read('deadaim-settings',{});
for(const key of Object.keys(defaults))if(typeof saved[key]===typeof defaults[key])settings[key]=saved[key];
for(const [key,min,max]of [['sensitivity',.05,20],['dpi',100,50000],['calibration',.1,5]])settings[key]=clamp(settings[key],min,max);
for(const [key,allowed]of Object.entries({duration:[30,60,120],difficulty:['easy','normal','hard'],aspect:['native','stretched'],variant:['standard','adaptive','challenge']}))if(!allowed.includes(settings[key]))settings[key]=defaults[key];
if(!/^#[0-9a-f]{6}$/i.test(settings.color))settings.color=defaults.color;
settings.challengeKey=settings.challengeKey.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)||defaults.challengeKey;
history=cleanHistory(read(historyKey,[]));
let mode='flick',state='idle',game,held=false,yaw=0,pitch=0,particles=[],flash=0,last=performance.now(),fpsTime=0,frames=0,countdown=0;
let workout=null,workoutIndex=0,calibrating=false,calibrationAngle=0,rawFallback=false,audioCtx,dashboard,cloud;
const keys=new Set(),renderer=new ArenaRenderer(canvas);
new ResizeObserver(()=>renderer.resize()).observe(arena);
function sessionSettings(){return {...settings,duration:workout?workout[workoutIndex].duration:settings.duration,variant:workout?'standard':settings.variant};}
function resetGame(){const config=sessionSettings();game=new Scenario(mode,config,config.variant==='challenge'?seededRandom(`v3|${mode}|${config.difficulty}|${config.duration}|${config.challengeKey}`):Math.random);yaw=pitch=0;particles=[];held=false;flash=0;keys.clear();updateHUD();}
function persist(){try{localStorage.setItem('deadaim-settings',JSON.stringify(settings));localStorage.setItem(historyKey,JSON.stringify(history));}catch{storageOK=false;}$('settingsNote').textContent=storageOK?'Настройки сохраняются автоматически':'Хранилище недоступно: данные сохраняются только в этой вкладке';}
function metrics(){const m=sensitivityMetrics(settings.sensitivity,settings.dpi);$('edpi').textContent=Math.round(m.edpi);$('cm360').textContent=m.cm360.toFixed(2);arena.style.setProperty('--cross',settings.color);}
function lockSettings(lock){dashboard?.lock(lock);for(const key of Object.keys(defaults))$(key).disabled=lock;document.querySelectorAll('.mode').forEach(b=>b.disabled=lock);}
function overlay(title,text,button='Начать тренировку'){$('overlayTitle').textContent=title;$('overlayText').textContent=text;$('start').textContent=button+' ↗';$('overlay').hidden=false;$('crosshair').hidden=true;$('countdown').hidden=true;}
function renderHistory(){const root=$('history');root.replaceChildren();if(!history.length){root.textContent='Пока чистый лист. Первая тренировка задаст точку отсчёта.';return;}history.slice(0,8).forEach(r=>{const row=document.createElement('div');row.className='history-row';for(const text of [modeLabels[r.mode],resultLabel(r),`${r.difficulty} · ${r.duration}с · ${r.variant||'standard'}`,r.date]){const el=document.createElement('span');el.textContent=text;row.append(el);}root.append(row);});}
function setMode(next){mode=next;document.querySelectorAll('.mode').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});$('modeName').textContent=MODES[mode].tag;$('modeDescription').textContent=MODES[mode].text;$('actionHint').textContent=mode==='track'?'Удерживать на цели':mode==='angles'?'A / D — движение · ЛКМ — выстрел':'Попасть в цель';}
for(const key of Object.keys(defaults)){
  const el=$(key);el.type==='checkbox'?el.checked=settings[key]:el.value=settings[key];
  el.addEventListener('change',()=>{if(['running','paused','countdown'].includes(state))return;let v=el.type==='checkbox'?el.checked:typeof defaults[key]==='number'?Number(el.value):el.value;
    if(typeof v==='number'){if(!Number.isFinite(v)||el.value.trim()==='')v=defaults[key];v=clamp(v,Number(el.min)||.01,Number(el.max)||50000);}
    if(key==='challengeKey')v=v.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)||defaults.challengeKey;
    settings[key]=v;if(el.type!=='checkbox')el.value=v;metrics();persist();resetGame();});
}
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{if(['running','paused','countdown'].includes(state))return;workout=null;calibrating=false;state='idle';dashboard?.workout('Свободная тренировка.',false);setMode(b.dataset.mode);resetGame();overlay(MODES[mode].name,MODES[mode].text);}));
async function requestLock(){
  if(!canvas.requestPointerLock){$('hint').textContent='Нужен настольный браузер с Pointer Lock и мышь.';return;}
  try{if(!audioCtx&&settings.sound)audioCtx=new(window.AudioContext||window.webkitAudioContext)();audioCtx?.resume().catch(()=>{});}catch{}
  try{await canvas.requestPointerLock(rawFallback?undefined:{unadjustedMovement:true});}catch(e){if(e.name==='NotSupportedError')rawFallback=true;$('hint').textContent=rawFallback?'Raw input недоступен. Нажми ещё раз для обычного ввода.':'Захват мыши не получен. Открой сайт в отдельном Chrome или Edge и повтори.';}
}
$('start').addEventListener('click',requestLock);
document.addEventListener('pointerlockerror',()=>{$('hint').textContent='Не удалось захватить мышь. Открой сайт в отдельной вкладке браузера.';});
function beginCountdown(seconds=3){countdown=seconds;state=calibrating?'running':'countdown';$('countdown').hidden=calibrating;$('countdownNumber').textContent=Math.ceil(countdown);$('overlay').hidden=true;$('crosshair').hidden=false;}
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===canvas){const resume=state==='paused';if(!resume)resetGame();held=false;last=performance.now();arena.classList.add('running');lockSettings(true);beginCountdown(resume?1:3);$('inputStatus').textContent=rawFallback?'ОБЫЧНЫЙ ВВОД · ПРОВЕРЬ КАЛИБРОВКУ':'RAW INPUT ЗАПРОШЕН';}
  else if(['running','countdown'].includes(state))pause();
});
function pause(){state='paused';held=false;keys.clear();arena.classList.remove('running');overlay('Пауза. Выдохни.','Таймер остановлен. R — начать текущий этап заново.','Продолжить');}
function stop(){state='idle';calibrating=false;workout=null;held=false;keys.clear();arena.classList.remove('running');document.exitPointerLock?.();lockSettings(false);resetGame();dashboard.workout('Завершённые серии сохранены.',false);overlay(MODES[mode].name,MODES[mode].text);}
$('stop').addEventListener('click',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['running','countdown'].includes(state)){pause();document.exitPointerLock?.();}});
window.addEventListener('blur',()=>{held=false;keys.clear();if(['running','countdown'].includes(state)){pause();document.exitPointerLock?.();}});
document.addEventListener('mousemove',e=>{
  if(!['running','countdown'].includes(state)||document.pointerLockElement!==canvas)return;
  const next=rotateMouse(yaw,pitch,e.movementX,e.movementY,settings.sensitivity,settings.calibration);yaw=next.yaw;pitch=next.pitch;
  if(calibrating){calibrationAngle+=e.movementX*Math.PI/180*.022*settings.sensitivity*settings.calibration;$('timer').textContent=Math.max(0,calibrationAngle*180/Math.PI).toFixed(0)+'°';if(calibrationAngle>=Math.PI*2){calibrating=false;state='idle';arena.classList.remove('running');document.exitPointerLock();lockSettings(false);dashboard.calibration('Оборот завершён. Измерь путь мыши и введи его в помощнике.');overlay('Оборот завершён.','Введи измеренное расстояние в помощнике калибровки.');}}
});
function tone(){if(!settings.sound||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.setValueAtTime(850,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(380,audioCtx.currentTime+.06);g.gain.setValueAtTime(.04,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.07);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.08);}
document.addEventListener('mousedown',e=>{if(e.button!==0||state!=='running'||document.pointerLockElement!==canvas||calibrating)return;held=true;if(mode==='track')return;flash=.12;const hit=game.shoot(yaw,pitch);if(hit){particles.push({...hit,life:.3});tone();}updateHUD();if(game.done)finish();});
document.addEventListener('mouseup',()=>held=false);
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(['KeyA','KeyD','ArrowLeft','ArrowRight'].includes(e.code)){if(['running','countdown'].includes(state)){keys.add(e.code);e.preventDefault();}}if(e.code==='KeyR'){e.preventDefault();calibrationAngle=0;resetGame();if(document.pointerLockElement===canvas)beginCountdown();else{state='idle';calibrating=false;lockSettings(false);overlay('Новая попытка.',MODES[mode].text);}}});
document.addEventListener('keyup',e=>keys.delete(e.code));
$('fullscreen').addEventListener('click',async()=>{try{document.fullscreenElement?await document.exitFullscreen():await arena.requestFullscreen();}catch{$('hint').textContent='Полный экран недоступен в этом браузере.';}});
function updateHUD(){if(!game)return;$('timer').textContent=Math.max(0,game.duration-game.time).toFixed(1);$('hitsLabel').textContent=mode==='track'?'НА ЦЕЛИ':mode==='clear50'?'ЗАЧИЩЕНО':'ПОПАДАНИЯ';$('hits').textContent=mode==='track'?game.tracked.toFixed(1)+'с':mode==='clear50'?`${game.hits} / 50`:game.hits;$('accuracyLabel').textContent=mode==='track'?'УДЕРЖАНИЕ':'ТОЧНОСТЬ';$('accuracy').textContent=game.time||game.shots?game.accuracy().toFixed(0)+'%':'—';$('roundProgress').style.width=`${100*(mode==='clear50'?game.hits/50:game.time/game.duration)}%`;}
function finish(){
  if(state!=='running')return;
  const row={...game.result(),id:crypto.randomUUID(),timestamp:Date.now(),date:new Date().toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),sensitivity:settings.sensitivity,dpi:settings.dpi};
  history.unshift(row);history=history.slice(0,500);persist();renderHistory();dashboard.render();dashboard.analysis(row,game.samples);cloud.submit(row);
  if(workout&&workoutIndex<workout.length-1){workoutIndex++;setMode(workout[workoutIndex].mode);resetGame();dashboard.workout(`Этап ${workoutIndex+1}/5 · ${modeLabels[mode]}`,true);beginCountdown(3);return;}
  const warm=!!workout;workout=null;state='results';held=false;arena.classList.remove('running');lockSettings(false);document.exitPointerLock();dashboard.workout(warm?'Разминка завершена: все 5 этапов сохранены.':'Свободная тренировка.',false);
  const extra=mode==='peek'?`\nВыходов пропущено: ${row.missed} · до попадания: ${row.reactionMs||'—'} мс`:mode==='clear50'?`\nТочность ${row.accuracy}% · ${row.shots-row.hits} промахов`:`\nИнтервал попаданий: ${row.avgMs||'—'} мс`;
  overlay(warm?'Разминка завершена.':mode==='clear50'?(row.completed?'Стена зачищена.':'Время вышло.'):'Серия завершена.',resultLabel(row)+extra,'Ещё одна серия');
}
function frame(now){let dt=Math.max(0,(now-last)/1000);last=now;frames++;fpsTime+=dt;if(fpsTime>.5){$('fps').textContent=Math.round(frames/fpsTime)+' FPS';frames=0;fpsTime=0;}
  if(dt>1&&['running','countdown'].includes(state)){pause();document.exitPointerLock?.();dt=0;}
  if(state==='countdown'){countdown-=dt;$('countdownNumber').textContent=Math.max(1,Math.ceil(countdown));if(countdown<=0){state='running';$('countdown').hidden=true;}dt=0;}
  if(state==='running'&&!calibrating){const move=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));let rest=dt;while(rest>0&&!game.done){const step=Math.min(rest,1/120);game.step(step,yaw,pitch,held,move);rest-=step;}updateHUD();if(game.done)finish();}
  flash=Math.max(0,flash-dt);particles.forEach(p=>p.life-=dt);particles=particles.filter(p=>p.life>0);game.held=held;renderer.draw(game,yaw,pitch,settings,particles,flash);requestAnimationFrame(frame);
}
dashboard=initDashboard({getHistory:()=>history,getSettings:()=>settings,
  applyCalibration(value){if(['running','paused','countdown'].includes(state))throw new Error('Сначала заверши тренировку.');settings.calibration=value;$('calibration').value=value;metrics();persist();},
  startCalibration(){if(['running','paused','countdown'].includes(state))return;workout=null;calibrating=true;calibrationAngle=0;state='idle';overlay('Один полный оборот.','Поставь мышь на отметку, нажми кнопку и двигай вправо до остановки.','Начать измерение');arena.scrollIntoView?.({block:'center'});},
  startWorkout(minutes){if(['running','paused','countdown'].includes(state))return;calibrating=false;workout=workoutPlan(minutes);workoutIndex=0;state='idle';setMode(workout[0].mode);resetGame();dashboard.workout(`Разминка ${minutes} минут · этап 1/5`,true);overlay('Разминка по плану.',`${minutes} минут активной тренировки + короткие паузы между этапами.`);arena.scrollIntoView?.({block:'center'});},cancelWorkout:stop});
cloud=initCloud({getHistory:()=>history,getSettings:()=>settings,
  account(uid,remote=[]){if(['running','countdown','paused'].includes(state))stop();historyKey=uid?`deadaim-history:${uid}`:'deadaim-history';const local=cleanHistory(read(historyKey,[]));const merged=new Map([...local,...cleanHistory(remote)].map(r=>[r.id||`${r.date}_${r.mode}`,r]));history=[...merged.values()].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,500);persist();renderHistory();dashboard.render();},
  restoreSettings(values){if(['running','countdown','paused'].includes(state))stop();for(const key of ['sensitivity','dpi','calibration','color','aspect','sound'])if(typeof values[key]===typeof defaults[key]){settings[key]=values[key];$(key).type==='checkbox'?$(key).checked=values[key]:$(key).value=values[key];}metrics();persist();resetGame();}
});
setMode(mode);resetGame();metrics();persist();renderHistory();requestAnimationFrame(frame);
