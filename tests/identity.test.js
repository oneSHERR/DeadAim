import test from 'node:test';
import assert from 'node:assert/strict';
import { anonymousIdentity } from '../identity.js';
test('waits for stored identity and reuses it without creating a new player',async()=>{
  const existing={uid:'existing-player'};
  const auth={currentUser:null,async authStateReady(){this.currentUser=existing;}};
  assert.equal(await anonymousIdentity(auth,()=>{throw new Error('Must not create another player');}),existing);
});
test('creates anonymous player only when none is persisted',async()=>{
  const user={uid:'new-player'},auth={currentUser:null,async authStateReady(){}};
  let calls=0;
  assert.equal(await anonymousIdentity(auth,async a=>{assert.equal(a,auth);calls++;return {user};}),user);
  assert.equal(calls,1);
});
test('propagates a disabled-provider error for the UI',async()=>{
  const auth={currentUser:null,async authStateReady(){}};
  await assert.rejects(anonymousIdentity(auth,async()=>{throw new Error('Anonymous disabled');}),/Anonymous disabled/);
});
