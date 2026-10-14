import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNickname,registerIdentity,cloudResult} from '../account-model.js';
test('nicknames normalize to one unique key and reject unsafe input',()=>{assert.equal(normalizeNickname('  Alice_7 '),'alice_7');for(const x of ['ab','a'.repeat(21),'имя','<img>','a/b','a.b'])assert.throws(()=>normalizeNickname(x));});
test('registration links an anonymous account and refreshes its token',async()=>{
 const calls=[],user={uid:'old',getIdToken:async force=>calls.push(force)},auth={currentUser:{uid:'old',isAnonymous:true},authStateReady:async()=>calls.push('ready')};
 const a={EmailAuthProvider:{credential:(email,password)=>({email,password})},linkWithCredential:async(old,cred)=>{assert.equal(old.uid,'old');assert.equal(cred.email,'a@example.test');return {user};},createUserWithEmailAndPassword:()=>assert.fail('must link')};
 assert.equal((await registerIdentity({a,auth},'a@example.test','password1')).uid,'old');assert.deepEqual(calls,['ready',true]);await assert.rejects(registerIdentity({a,auth},'a@example.test','short'));
});
test('new registration uses Email/Password and propagates account errors',async()=>{
 const auth={currentUser:null,authStateReady:async()=>{}},user={uid:'new',getIdToken:async()=>{}},a={createUserWithEmailAndPassword:async()=>({user})};assert.equal((await registerIdentity({a,auth},'a@example.test','password1')).uid,'new');
 a.createUserWithEmailAndPassword=async()=>{throw new Error('email-already-in-use');};await assert.rejects(registerIdentity({a,auth},'a@example.test','password1'),/email-already/);
});
test('cloud results migrate v2 format and omit account and browser data',()=>{
 const row={mode:'flick',duration:60,hits:2,shots:3,accuracy:66.7,date:'today',timestamp:100,email:'private',password:'private',sensitivity:1},d=cloudResult(row);assert.equal(d.version,2);assert.equal(d.elapsedMs,60000);assert.equal(d.variant,'standard');for(const k of ['password','email','sensitivity'])assert.ok(!(k in d));
 for(const bad of [{hits:-1},{accuracy:Infinity},{shots:1},{duration:1},{mode:'unknown'}])assert.throws(()=>cloudResult({...row,...bad}));
});
