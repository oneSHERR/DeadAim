import test from 'node:test';
import assert from 'node:assert/strict';
import {MODES,Scenario,seededRandom,blocked} from '../scenarios.js';
import {records} from '../training.js';
const config={duration:60,difficulty:'normal',variant:'standard'};
const aim=(g,t)=>[Math.atan2(t.x-g.eyeX,t.z),Math.atan2(t.y,Math.hypot(t.x-g.eyeX,t.z))];
test('all twelve scenarios create advertised target counts and expire',()=>{
 assert.equal(Object.keys(MODES).length,12);
 for(const [mode,def] of Object.entries(MODES)){const g=new Scenario(mode,config,seededRandom(mode));assert.equal(g.targets.length,def.count);g.step(60,0,0,false);assert.equal(g.done,true);assert.equal(g.result().elapsedMs,60000);}
});
test('clear50 has separated cells at easy size and never replenishes',()=>{
 const g=new Scenario('clear50',{...config,difficulty:'easy'},seededRandom('clear'));
 for(const a of g.targets)for(const b of g.targets)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>a.r+b.r);
 for(let i=0;i<50;i++){g.step(.1,0,0,false);const t=g.targets[0];assert.equal(g.shoot(...aim(g,t)).id,t.id);assert.equal(g.targets.length,49-i);}
 assert.equal(g.done,true);assert.equal(g.completed,true);assert.equal(g.result().elapsedMs,5000);assert.equal(g.accuracy(),100);assert.equal(g.shoot(0,0),null);assert.equal(g.shots,50);
});
test('wall3 and six targets replenish one at a time',()=>{
 for(const mode of ['wall3','six']){const g=new Scenario(mode,config,seededRandom(mode));const id=g.targets[0].id;assert.ok(g.shoot(...aim(g,g.targets[0])));assert.equal(g.targets.length,MODES[mode].count);assert.ok(!g.targets.some(t=>t.id===id));}
});
test('peek cover blocks hits until emergence and expired peeks count as missed',()=>{
 const g=new Scenario('peek',config,seededRandom('peek')),t=g.targets[0];assert.equal(g.shoot(...aim(g,t)),null);assert.equal(g.hits,0);
 g.step(t.delay+.31,0,0,false);assert.ok(g.shoot(...aim(g,t)));assert.equal(g.hits,1);assert.equal(g.reactions.length,1);
 const t2=g.targets[0];g.step(t2.delay+t2.exposed+.01,0,0,false);assert.equal(g.missed,1);
});
test('A/D movement exposes targets through real openings',()=>{
 assert.equal(blocked('angles',Math.atan2(2,10),0),true);assert.equal(blocked('angles',0,0),false);
 const g=new Scenario('angles',config,seededRandom('angle')),t=g.targets[0];assert.equal(g.shoot(...aim(g,t)),null);
 const opening=Math.round(t.x/7.5)*5,requiredEye=3*opening-2*t.x;
 g.step(Math.abs(requiredEye)/4,0,0,false,Math.sign(requiredEye));assert.ok(g.shoot(...aim(g,t)));g.step(20,0,0,false,1);assert.equal(g.eyeX,8);
});
test('challenge sequences reproduce and records separate variants and seeds',()=>{
 const a=new Scenario('wall3',config,seededRandom('same')),b=new Scenario('wall3',config,seededRandom('same'));assert.deepEqual(a.targets,b.targets);
 for(let i=0;i<10;i++){a.shoot(...aim(a,a.targets[0]));b.shoot(...aim(b,b.targets[0]));}assert.deepEqual(a.targets,b.targets);
 const adaptive=new Scenario('wall3',{...config,variant:'adaptive'},seededRandom('adapt'));for(let i=0;i<5;i++)adaptive.shoot(...aim(adaptive,adaptive.targets[0]));assert.ok(adaptive.scale<1);
 const base={...config,mode:'wall3',hits:5,accuracy:100};assert.equal(records([base,{...base,variant:'adaptive'},{...base,variant:'challenge',challengeKey:'one'},{...base,variant:'challenge',challengeKey:'two'}]).length,4);
 const fast={...base,mode:'clear50',hits:50,completed:true,elapsedMs:5000},slow={...fast,elapsedMs:6000};assert.equal(records([slow,fast])[0].elapsedMs,5000);
});
