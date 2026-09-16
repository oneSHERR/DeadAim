import test from 'node:test';
import assert from 'node:assert/strict';

test('session lifecycle: hit, pause, resume, results, history and restart',async()=>{
 const events=new Map(),elements=new Map();
 function target(id=''){return {id,value:'',type:'',min:'',max:'',hidden:false,disabled:false,tagName:'BODY',textContent:'',dataset:{},parentElement:{before(){},after(){}},before(){},after(){},getContext:()=>context,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(name,fn){events.set(this.id+':'+name,fn);},append(){},replaceChildren(){},getBoundingClientRect(){return {width:1200,height:600};}};}
 const keys={sensitivity:1,dpi:800,duration:60,difficulty:'normal',aspect:'native',sound:true,color:'#c5f96b',calibration:1};
 for(const [key,value]of Object.entries(keys)){const el=target(key);el.type=typeof value==='number'?'number':typeof value==='boolean'?'checkbox':'select';elements.set(key,el);}
 const doc=target('document');doc.getElementById=id=>{if(!elements.has(id))elements.set(id,target(id));return elements.get(id);};doc.querySelectorAll=()=>[];doc.createElement=()=>target();doc.activeElement=target();doc.hidden=false;
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(obj,key)=>obj[key]||(()=>{})});
 const canvas=doc.getElementById('scene');canvas.getContext=()=>context;canvas.requestPointerLock=async()=>{doc.pointerLockElement=canvas;events.get('document:pointerlockchange')();};
 doc.exitPointerLock=()=>{doc.pointerLockElement=null;events.get('document:pointerlockchange')();};
 globalThis.document=doc;globalThis.window=target('window');globalThis.devicePixelRatio=1;
 globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){this.fn();}};
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 let frame;globalThis.requestAnimationFrame=fn=>frame=fn;
 const random=Math.random;Math.random=()=>.5;
 try{
 await import('../app.js');
 await events.get('start:click')();
 assert.equal(doc.getElementById('overlay').hidden,true);
 assert.equal(doc.getElementById('sensitivity').disabled,true);
 events.get('document:mousedown')({button:0});
 assert.equal(doc.getElementById('hits').textContent,1);
 doc.exitPointerLock();
 assert.equal(doc.getElementById('overlayTitle').textContent,'Пауза. Выдохни.');
 await events.get('start:click')();
 assert.equal(doc.getElementById('hits').textContent,1);
 const time=performance.now();frame(time+61000);
 assert.equal(doc.getElementById('overlayTitle').textContent,'Серия завершена.');
 assert.equal(doc.getElementById('sensitivity').disabled,false);
 const history=JSON.parse(storage.get('deadaim-history'));
 assert.equal(history.length,1);assert.equal(history[0].hits,1);assert.equal(history[0].accuracy,100);
 await events.get('start:click')();events.get('document:keydown')({code:'KeyR',preventDefault(){}});
 assert.equal(doc.getElementById('hits').textContent,0);
 assert.equal(doc.getElementById('timer').textContent,'60.0');
 doc.exitPointerLock();
 events.get('cancelWarm:click')();
 events.get('warm5:click')();
 await events.get('start:click')();
 let clock=performance.now();
 for(let i=0;i<5;i++){clock+=61000;frame(clock);}
 assert.equal(doc.getElementById('overlayTitle').textContent,'Разминка завершена.');
 const warmHistory=JSON.parse(storage.get('deadaim-history'));
 assert.equal(warmHistory.length,6);
 assert.deepEqual(warmHistory.slice(0,5).map(x=>x.mode),['strafe','head','track','micro','flick']);
 events.get('calibrationRun:click')();
 await events.get('start:click')();
 events.get('document:mousemove')({movementX:360/.022+1,movementY:0});
 assert.equal(doc.getElementById('overlayTitle').textContent,'Оборот завершён.');
 assert.equal(JSON.parse(storage.get('deadaim-history')).length,6);
 }finally{Math.random=random;}
});
