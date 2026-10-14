import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,where,orderBy,limit,writeBatch,serverTimestamp,updateDoc,deleteDoc,setLogLevel} from 'firebase/firestore';
let env,a,b,c,guest;
const profile=(db,uid,name)=>{const batch=writeBatch(db);batch.set(doc(db,'deadaimNames',name),{uid});batch.set(doc(db,'deadaimProfiles',uid),{nickname:name,createdAt:serverTimestamp()});return batch.commit();};
const row={mode:'wall3',difficulty:'normal',duration:60,hits:5,shots:6,accuracy:83.3,avgMs:1000,elapsedMs:60000,completed:false,variant:'standard',challengeKey:'',missed:0,reactionMs:0,firstHits:5,version:3,timestamp:1000,date:'test'};
before(async()=>{setLogLevel('silent');const rules=await readFile(process.env.DEADAIM_RULES||new URL('../firestore.rules',import.meta.url),'utf8');env=await initializeTestEnvironment({projectId:'demo-deadaim',firestore:{host:'127.0.0.1',port:8080,rules}});await env.clearFirestore();a=env.authenticatedContext('alice',{email:'a@example.test'}).firestore();b=env.authenticatedContext('bob',{email:'b@example.test'}).firestore();c=env.authenticatedContext('eve',{email:'e@example.test'}).firestore();guest=env.unauthenticatedContext().firestore();});
after(async()=>{await env?.cleanup();});
test('atomic unique nicknames, public profile allowlist and authenticated lookup',async()=>{
 await assertSucceeds(profile(a,'alice','alice_7'));await assertSucceeds(profile(b,'bob','bob_7'));await assertSucceeds(profile(c,'eve','eve_7'));
 await assertFails(profile(b,'bob','alice_7'));await assertFails(setDoc(doc(a,'deadaimNames','another'),{uid:'alice'}));
 await assertSucceeds(getDoc(doc(b,'deadaimNames','alice_7')));await assertFails(getDocs(collection(b,'deadaimNames')));await assertFails(getDoc(doc(guest,'deadaimNames','alice_7')));
 await assertFails(updateDoc(doc(a,'deadaimProfiles','alice'),{email:'private'}));await assertFails(updateDoc(doc(a,'deadaimProfiles','alice'),{nickname:'renamed'}));
});
test('sessions are private until recipient accepts and only owner may write',async()=>{
 await assertSucceeds(setDoc(doc(a,'deadaimProfiles','alice','sessions','one'),row));await assertFails(getDoc(doc(b,'deadaimProfiles','alice','sessions','one')));
 await assertFails(setDoc(doc(b,'deadaimProfiles','alice','sessions','forged'),row));await assertFails(getDoc(doc(guest,'deadaimProfiles','alice','sessions','one')));
 await assertSucceeds(setDoc(doc(a,'deadaimLinks','alice_bob'),{from:'alice',to:'bob',members:['alice','bob'],status:'pending',createdAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(a,'deadaimLinks','alice_bob'),{status:'accepted'}));await assertFails(updateDoc(doc(c,'deadaimLinks','alice_bob'),{status:'accepted'}));
 await assertFails(updateDoc(doc(b,'deadaimLinks','alice_bob'),{status:'accepted',from:'eve'}));await assertFails(getDoc(doc(b,'deadaimProfiles','alice','sessions','one')));
 await assertSucceeds(updateDoc(doc(b,'deadaimLinks','alice_bob'),{status:'accepted'}));assert.equal((await assertSucceeds(getDoc(doc(b,'deadaimProfiles','alice','sessions','one')))).data().hits,5);
});
test('actual friends and history queries work; unrestricted listing and outsiders fail',async()=>{
 const friends=await assertSucceeds(getDocs(query(collection(b,'deadaimLinks'),where('members','array-contains','bob'),limit(100))));assert.equal(friends.size,1);
 await assertFails(getDocs(collection(b,'deadaimLinks')));await assertFails(getDoc(doc(c,'deadaimLinks','alice_bob')));
 assert.equal((await assertSucceeds(getDocs(query(collection(b,'deadaimProfiles','alice','sessions'),orderBy('timestamp','desc'),limit(500))))).size,1);
 await assertFails(getDocs(collection(c,'deadaimProfiles','alice','sessions')));
});
test('friends cannot read mouse settings or overwrite scores; exact retries work',async()=>{
 const ref=doc(a,'deadaimProfiles','alice','private','settings'),settings={sensitivity:1,dpi:800,calibration:1,color:'#c5f96b',aspect:'native',sound:true};await assertSucceeds(setDoc(ref,settings));
 await assertFails(getDoc(doc(b,'deadaimProfiles','alice','private','settings')));await assertFails(updateDoc(ref,{dpi:-1}));await assertFails(updateDoc(ref,{password:'bad'}));
 await assertSucceeds(setDoc(doc(a,'deadaimProfiles','alice','sessions','one'),row));await assertFails(updateDoc(doc(a,'deadaimProfiles','alice','sessions','one'),{hits:6}));await assertFails(deleteDoc(doc(b,'deadaimProfiles','alice','sessions','one')));
});
test('schema rejects extra fields, impossible counts, malformed values and false completion',async()=>{
 let i=0;for(const bad of [{password:'bad'},{hits:-1},{shots:1},{accuracy:101},{elapsedMs:60001},{duration:13},{mode:'unknown'},{completed:true},{mode:'clear50',hits:51,shots:51},{firstHits:6},{variant:'invalid'}])await assertFails(setDoc(doc(a,'deadaimProfiles','alice','sessions','bad'+i++),{...row,...bad}));
 await assertSucceeds(setDoc(doc(a,'deadaimProfiles','alice','sessions','fifty'),{...row,mode:'clear50',hits:50,shots:50,accuracy:100,elapsedMs:5000,completed:true}));
});
test('duplicate or self friendship is denied; removing friendship revokes access',async()=>{
 await assertFails(setDoc(doc(b,'deadaimLinks','bob_alice'),{from:'bob',to:'alice',members:['bob','alice'],status:'pending',createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(a,'deadaimLinks','alice_alice'),{from:'alice',to:'alice',members:['alice','alice'],status:'pending',createdAt:serverTimestamp()}));
 await assertSucceeds(deleteDoc(doc(b,'deadaimLinks','alice_bob')));await assertFails(getDocs(query(collection(b,'deadaimProfiles','alice','sessions'),orderBy('timestamp','desc'),limit(500))));
});
test('anonymous accounts cannot claim profiles and unattached nickname writes fail',async()=>{
 const anon=env.authenticatedContext('anon').firestore();await assertFails(profile(anon,'anon','anon_7'));
 const newcomer=env.authenticatedContext('new',{email:'n@example.test'}).firestore();await assertFails(setDoc(doc(newcomer,'deadaimProfiles','new'),{nickname:'new_7',createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(newcomer,'deadaimNames','new_7'),{uid:'new'}));await assertSucceeds(profile(newcomer,'new','new_7'));
});
