import test from 'node:test';
import assert from 'node:assert/strict';
test('countdown, paused clock, warmup transitions, restart and calibration',async()=>{
 const events=new Map(),elements=new Map();
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(obj,key)=>obj[key]||(()=>{})});
 function target(id=''){return {id,value:'',type:'',min:'',max:'',hidden:false,disabled:false,tagName:'BODY',textContent:'',dataset:{},parentElement:{before(){},after(){}},before(){},after(){},setAttribute(){},focus(){},getContext:()=>context,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(name,fn){events.set(this.id+':'+name,fn);},append(){},replaceChildren(){},getBoundingClientRect(){return {width:1200,height:600};}};}
 const settings={sensitivity:1,dpi:800,duration:60,difficulty:'normal',aspect:'native',sound:false,color:'#c5f96b',calibration:1,variant:'standard',challengeKey:'test'};
 for(const [key,value]of Object.entries(settings)){const el=target(key);el.type=typeof value==='number'?'number':typeof value==='boolean'?'checkbox':'select';elements.set(key,el);}
 const doc=target('document');doc.body=target('body');doc.getElementById=id=>{if(!elements.has(id))elements.set(id,target(id));return elements.get(id);};doc.querySelector=()=>target('header');doc.querySelectorAll=()=>[];doc.createElement=()=>target();doc.activeElement=target();doc.hidden=false;
 const canvas=doc.getElementById('scene');canvas.requestPointerLock=async()=>{doc.pointerLockElement=canvas;events.get('document:pointerlockchange')();};
 doc.exitPointerLock=()=>{doc.pointerLockElement=null;events.get('document:pointerlockchange')();};
 globalThis.document=doc;globalThis.window=target('window');globalThis.devicePixelRatio=1;
 globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){this.fn();}};
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 let frame,clock=0;globalThis.requestAnimationFrame=fn=>frame=fn;
 const oldPerformance=globalThis.performance;globalThis.performance={now:()=>clock};
 const tick=seconds=>{for(let i=0;i<Math.round(seconds*10);i++){clock+=100;frame(clock);}};
 const click=id=>events.get(id+':click')();const shoot=()=>events.get('document:mousedown')({button:0});
 const random=Math.random;Math.random=()=>.5;
 try{
 await import('../app.js');await click('authGuest');await click('start');
 assert.equal(doc.getElementById('overlay').hidden,true);assert.equal(doc.getElementById('sensitivity').disabled,true);
 shoot();assert.equal(doc.getElementById('hits').textContent,0);tick(3.1);shoot();assert.equal(doc.getElementById('hits').textContent,1);
 doc.exitPointerLock();assert.equal(doc.getElementById('overlayTitle').textContent,'Пауза. Выдохни.');const timer=doc.getElementById('timer').textContent;tick(10);assert.equal(doc.getElementById('timer').textContent,timer);
 await click('start');tick(1.1);tick(60);
 assert.equal(doc.getElementById('overlayTitle').textContent,'Серия завершена.');assert.equal(doc.getElementById('sensitivity').disabled,false);
 let history=JSON.parse(storage.get('deadaim-history'));assert.equal(history.length,1);assert.equal(history[0].hits,1);assert.equal(history[0].accuracy,100);
 await click('start');events.get('document:keydown')({code:'KeyR',preventDefault(){}});assert.equal(doc.getElementById('hits').textContent,0);assert.equal(doc.getElementById('timer').textContent,'60.0');
 clock+=2000;frame(clock);assert.equal(doc.getElementById('overlayTitle').textContent,'Пауза. Выдохни.');
 click('stop');click('warm5');await click('start');tick(316);
 assert.equal(doc.getElementById('overlayTitle').textContent,'Разминка завершена.');history=JSON.parse(storage.get('deadaim-history'));assert.equal(history.length,6);assert.deepEqual(history.slice(0,5).map(x=>x.mode),['strafe','head','track','micro','flick']);
 click('calibrationRun');await click('start');events.get('document:mousemove')({movementX:360/.022+1,movementY:0});assert.equal(doc.getElementById('overlayTitle').textContent,'Оборот завершён.');assert.equal(JSON.parse(storage.get('deadaim-history')).length,6);
 }finally{Math.random=random;globalThis.performance=oldPerformance;}
});
