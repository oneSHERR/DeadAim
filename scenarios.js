import { clamp, rayHit } from './engine.js';
import { shotOffset, strafePosition } from './training.js';

export const MODES = {
  flick: { name:'Флики', tag:'FLICK', group:'База', count:3, radius:.42, text:'Три цели. Быстрый перевод, точная остановка, один выстрел.' },
  micro: { name:'Микроточность', tag:'MICRO', group:'База', count:3, radius:.21, text:'Маленькие цели для коротких, контролируемых доводок.' },
  track: { name:'Трекинг', tag:'TRACK', group:'База', count:1, radius:.42, text:'Удерживай ЛКМ и сопровождай цель. Важна доля времени на цели.' },
  head: { name:'Уровень головы', tag:'HEADLINE', group:'База', count:3, radius:.32, text:'Горизонтальные переводы без лишних движений по высоте.' },
  strafe: { name:'Стрейф-цель', tag:'STRAFE', group:'База', count:1, radius:.38, text:'Дождись удобного момента: цель меняет направление и делает паузы.' },
  peek: { name:'Удержание угла', tag:'HOLD ANGLE', group:'Тактика', count:1, radius:.36, text:'Цель выходит из-за укрытия через случайную паузу. Не стреляй сквозь стену.' },
  adjust: { name:'Флик + доводка', tag:'ADJUST', group:'Точность', count:2, radius:.27, text:'После появления цель немного смещается. Заверши флик маленькой поправкой.' },
  six: { name:'Шесть целей', tag:'SIX POINT', group:'Точность', count:6, radius:.24, text:'Шесть маленьких мишеней. Выбирай следующую цель и держи точный ритм.' },
  moving: { name:'Движущиеся головы', tag:'MULTI HEAD', group:'Тактика', count:4, radius:.31, text:'Четыре движущиеся цели на разной глубине. Переключайся между ними.' },
  angles: { name:'Проверка углов', tag:'ANGLE CLEAR', group:'Тактика', count:1, radius:.36, text:'A / D — движение вдоль трёх проёмов. Открой линию огня и попади в цель.' },
  wall3: { name:'Стена · 3 цели', tag:'WALL THREE', group:'Стена', count:3, radius:.48, text:'Большая стена, три мишени. После попадания одна новая появляется в другом месте.' },
  clear50: { name:'Зачистка · 50', tag:'CLEAR FIFTY', group:'Стена', count:50, radius:.28, text:'Все 50 целей уже на стене. Уничтожь их до конца таймера. Новые не появляются.' }
};
export function seededRandom(seed) {
  let n=2166136261;
  for(const c of String(seed)) n=Math.imul(n^c.charCodeAt(0),16777619);
  return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export function wallPanels(mode) {
  const z=mode==='peek'?12:10;
  if(mode==='peek')return [{x1:-30,x2:-1.4,y1:-12,y2:20,z},{x1:1.4,x2:30,y1:-12,y2:20,z}];
  if(mode!=='angles')return [];
  return [[-30,-5.8],[-4.2,-.8],[.8,4.2],[5.8,30]].map(([x1,x2])=>({x1,x2,y1:-12,y2:20,z}));
}
export function blocked(mode,yaw,pitch,eyeX=0) {
  if(Math.cos(yaw)*Math.cos(pitch)<=0)return false;
  return wallPanels(mode).some(p=>{const x=eyeX+Math.tan(yaw)*p.z,y=Math.tan(pitch)/Math.cos(yaw)*p.z;return x>=p.x1&&x<=p.x2&&y>=p.y1&&y<=p.y2;});
}
export class Scenario {
  constructor(mode,settings,random=Math.random){this.mode=mode;this.settings={...settings};this.random=random;this.duration=settings.duration;this.time=0;this.hits=0;this.shots=0;this.tracked=0;this.missed=0;this.firstHits=0;this.presented=0;this.intervals=[];this.reactions=[];this.lastHit=0;this.done=false;this.completed=false;this.targets=[];this.samples=[];this.eyeX=0;this.startAim={x:0,y:0};this.nextId=0;this.streak=0;this.scale=1;this.spawn();}
  radius(){return MODES[this.mode].radius*({easy:1.35,normal:1,hard:.7}[this.settings.difficulty]||1)*this.scale;}
  spawn(){
    if(this.mode==='clear50'){
      // Jittered cells guarantee 50 distinct non-overlapping targets even at easy size.
      for(let y=0;y<5;y++)for(let x=0;x<10;x++)this.targets.push(this.make({x:(x-4.5)*1.5+(this.random()-.5)*.25,y:(y-2)*1.4+(this.random()-.5)*.25,z:15}));
    }else for(let i=0;i<MODES[this.mode].count;i++)this.targets.push(this.make());
  }
  make(position){
    const r=this.radius(),wide=['wall3','six'].includes(this.mode);let p;
    for(let i=0;i<100;i++){
      p={x:(this.random()-.5)*(wide?15:12),y:['head','strafe','moving','angles','peek'].includes(this.mode)?0:(this.random()-.5)*(wide?6:5),z:this.mode==='moving'?12+this.random()*8:15};
      if(this.targets.every(t=>Math.hypot(t.x-p.x,t.y-p.y)>t.r+r+.25))break;
    }
    const t={...p,...position,r,baseR:r,id:++this.nextId,born:this.time,phase:this.random()*4,shots:0,visibleAt:null};
    t.baseX=t.x;t.baseY=t.y;
    if(this.mode==='peek'){t.side=this.random()<.5?-1:1;t.delay=.5+this.random()*1.4;t.x=t.side*3;t.y=0;t.exposed=1.1+this.random()*.8;}
    if(this.mode==='angles'){const lane=Math.floor(this.random()*3)-1;t.x=lane*7.5+(this.random()<.5?-1:1)*1.5;t.y=0;}
    this.presented++;return t;
  }
  step(dt,yaw,pitch,held,move=0){
    if(this.done)return;
    const step=Math.min(Math.max(0,dt),this.duration-this.time);this.time+=step;
    const speed={easy:.7,normal:1,hard:1.45}[this.settings.difficulty]||1;
    if(this.mode==='angles')this.eyeX=clamp(this.eyeX+move*step*4,-8,8);
    for(const t of [...this.targets]){
      const age=this.time-t.born;
      if(this.mode==='track'){t.x=Math.sin(this.time*speed)*5;t.y=Math.sin(this.time*speed*1.7)*1.65;}
      if(this.mode==='strafe'||this.mode==='moving')t.x=strafePosition(this.time,t.phase,speed)*(this.mode==='moving'?.65:1)+(this.mode==='moving'?t.baseX*.35:0);
      if(this.mode==='adjust'){t.x=t.baseX+Math.sin(age*2.3+t.phase)*.35;t.y=t.baseY+Math.sin(age*1.6+t.phase)*.17;}
      if(this.mode==='peek'){
        if(age>=t.delay+t.exposed){this.missed++;this.targets=this.targets.filter(x=>x!==t);this.targets.push(this.make());continue;}
        t.x=t.side*(3-Math.min(1,Math.max(0,(age-t.delay)/.3))*2.1);
        if(t.visibleAt===null&&Math.abs(t.x)/15*12<1.4){t.visibleAt=this.time;}
      }
    }
    if(this.mode==='track'&&held&&this.targets.some(t=>rayHit({...t,x:t.x-this.eyeX},t.r,yaw,pitch)))this.tracked+=step;
    if(this.time>=this.duration){this.time=this.duration;this.done=true;}
  }
  shoot(yaw,pitch){
    if(this.done||this.mode==='track')return null;
    this.shots++;
    const visible=!blocked(this.mode,yaw,pitch,this.eyeX);
    const hit=visible?this.targets.find(t=>rayHit({...t,x:t.x-this.eyeX},t.r,yaw,pitch)):null;
    const aim={x:this.eyeX+Math.tan(yaw)*15,y:Math.tan(pitch)/Math.max(.01,Math.cos(yaw))*15};
    const intended=hit||this.targets.reduce((a,b)=>!a||Math.hypot(b.x-aim.x,b.y-aim.y)<Math.hypot(a.x-aim.x,a.y-aim.y)?b:a,null);
    if(intended){intended.shots++;this.samples.push({...shotOffset({...intended,x:intended.x-this.eyeX},yaw,pitch,{x:this.startAim.x-this.eyeX,y:this.startAim.y}),hit:!!hit});if(this.samples.length>1000)this.samples.shift();}
    if(!hit){this.streak=0;if(this.settings.variant==='adaptive')this.scale=Math.min(1.5,this.scale+.04);return null;}
    this.hits++;this.streak++;if(hit.shots===1)this.firstHits++;
    this.intervals.push((this.time-this.lastHit)*1000);this.lastHit=this.time;this.startAim={x:hit.x,y:hit.y};
    if(this.mode==='peek'&&hit.visibleAt!==null)this.reactions.push((this.time-hit.visibleAt)*1000);
    if(this.settings.variant==='adaptive'&&this.streak%5===0)this.scale=Math.max(.55,this.scale-.07);
    this.targets=this.targets.filter(t=>t!==hit);
    if(this.mode==='clear50'){if(!this.targets.length){this.done=true;this.completed=true;}}
    else this.targets.push(this.make());
    return hit;
  }
  accuracy(){return this.mode==='track'?(this.time?100*this.tracked/this.time:0):(this.shots?100*this.hits/this.shots:0);}
  result(){const avg=a=>a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length):0;return {mode:this.mode,difficulty:this.settings.difficulty,duration:this.duration,hits:this.hits,shots:this.shots,accuracy:Math.round(this.accuracy()*10)/10,avgMs:avg(this.intervals),elapsedMs:Math.max(1,Math.round(this.time*1000)),completed:this.completed,missed:this.missed,reactionMs:avg(this.reactions),firstHits:this.firstHits,variant:this.settings.variant||'standard',challengeKey:this.settings.variant==='challenge'?this.settings.challengeKey:'',version:3};}
}
