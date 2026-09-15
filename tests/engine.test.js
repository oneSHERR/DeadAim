import test from 'node:test';
import assert from 'node:assert/strict';
import {sensitivityMetrics,rotateMouse,project,rayHit} from '../engine.js';
test('CS sensitivity: one full turn and DPI metrics',()=>{const m=sensitivityMetrics(1,800);assert.equal(m.edpi,800);assert.ok(Math.abs(m.cm360-51.954545)<.00001);const r=rotateMouse(0,0,360/.022,0,1);assert.ok(Math.abs(Math.sin(r.yaw))<1e-10);assert.ok(Math.abs(sensitivityMetrics(2,800).cm360-m.cm360/2)<1e-10);});
test('mouse vertical direction and limits',()=>{assert.ok(rotateMouse(0,0,0,10,1).pitch<0);assert.equal(rotateMouse(0,0,0,1e9,1).pitch,-1.48);});
test('ray hits world spheres and rejects behind-camera targets',()=>{assert.equal(rayHit({x:0,y:0,z:15},.4,0,0),true);assert.equal(rayHit({x:1,y:0,z:15},.4,0,0),false);assert.equal(rayHit({x:0,y:0,z:-15},.4,0,0),false);assert.equal(rayHit({x:5,y:0,z:15},.4,Math.atan2(5,15),0),true);});
test('projection center, aspect and 4:3 stretched',()=>{const p={x:1,y:0,z:10};assert.equal(project({x:0,y:0,z:10},0,0,1600,900).x,800);assert.equal(project(p,0,0,1600,900).x,860);assert.equal(project(p,0,0,1600,900,true).x,880);assert.equal(project({x:0,y:0,z:-1},0,0,100,100),null);});
