import test from 'node:test';
import assert from 'node:assert/strict';
import {workoutPlan, calibrationFactor, records, shotOffset, strafePosition} from '../training.js';
test('warmups have five modes and exactly five or ten minutes',()=>{
 for(const minutes of [5,10]){const p=workoutPlan(minutes);assert.equal(p.length,5);assert.equal(new Set(p.map(x=>x.mode)).size,5);assert.equal(p.reduce((s,x)=>s+x.duration,0),minutes*60);}
});
test('calibration compounds the current factor and rejects invalid measurements',()=>{
 assert.equal(calibrationFactor(1,60,50),1.2);assert.equal(calibrationFactor(1.2,55,50),1.32);
 for(const n of [0,-1,NaN,Infinity])assert.throws(()=>calibrationFactor(1,n,50));
});
test('personal records separate mode, difficulty and duration',()=>{
 const base={mode:'flick',difficulty:'normal',duration:60,hits:30,accuracy:100};
 const result=records([base,{...base,hits:40},{...base,duration:30},{...base,difficulty:'hard'},{...base,mode:'track',accuracy:75},{...base,mode:'track',accuracy:80}]);
 assert.equal(result.length,4);assert.equal(result.find(r=>r.mode==='track').score,80);assert.equal(result.find(r=>r.mode==='flick'&&r.duration===60&&r.difficulty==='normal').hits,40);
});
test('miss analysis distinguishes under, over and vertical errors',()=>{
 const t={x:3,y:0,z:15,r:.4},start={x:0,y:0};
 assert.equal(shotOffset(t,Math.atan2(2,15),0,start).kind,'under');
 assert.equal(shotOffset(t,Math.atan2(4,15),0,start).kind,'over');
 assert.equal(shotOffset(t,Math.atan2(3,15),.2,start).kind,'high');
 assert.equal(shotOffset(t,Math.PI,0,start).plotted,false);
});
test('strafe pauses at endpoints and stays bounded',()=>{
 assert.equal(strafePosition(.1,0,1),-5);assert.equal(strafePosition(.4,0,1),-5);assert.equal(strafePosition(2.1,0,1),5);
 for(let t=0;t<20;t+=.01)assert.ok(Math.abs(strafePosition(t,1,1.45))<=5.000001);
});
