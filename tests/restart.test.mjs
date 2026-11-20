import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restartReceiver} from '../restart.mjs';
function status(state,flags=0xc0){const b=new Uint8Array(17);b[13]=0xd3;b[14]=state;b[16]=flags;return b}
test('reboot first disconnects, waits for both IDLE and ACL release, then sends reset',async()=>{
 const sent=[],states=[status(7,0x81),status(8,0xc1),status(0,0xc1),status(0)],events=[];
 await restartReceiver({read:async()=>states.shift(),send:async c=>{sent.push(c);events.push('send'+c)},pause:async()=>events.push('wait'),notify:()=>{}});
 assert.deepEqual(sent,[4,3]);assert.deepEqual(events,['send4','wait','wait','send3']);
});
test('already disconnected still establishes reconnect hold before restarting',async()=>{const sent=[],states=[status(0,0x80),status(0)];await restartReceiver({read:async()=>states.shift(),send:async c=>sent.push(c)});assert.deepEqual(sent,[4,3])});
test('disconnect timeout cancels hold and never sends reboot',async()=>{const sent=[];let time=0;await assert.rejects(restartReceiver({read:async()=>status(7,0xc1),send:async c=>sent.push(c),now:()=>time,pause:async ms=>{time+=ms}}),/超时/);assert.deepEqual(sent,[4,5])});
test('unsupported firmware, lost status, expired hold and failed reboot never claim success',async()=>{
 let sent=[];await assert.rejects(restartReceiver({read:async()=>status(7,1),send:async c=>sent.push(c)}),/不支持/);assert.deepEqual(sent,[]);
 let n=0;await assert.rejects(restartReceiver({read:async()=>{if(n++)throw Error('USB lost');return status(7,0x81)},send:async c=>sent.push(c)}),/USB lost/);assert.deepEqual(sent,[4,5]);
 sent=[];n=0;await assert.rejects(restartReceiver({read:async()=>status(0,n++?0x80:0x81),send:async c=>sent.push(c)}),/取消/);assert.deepEqual(sent,[4,5]);
 sent=[];n=0;await assert.rejects(restartReceiver({read:async()=>status(0,n++?0xc0:0x80),send:async c=>{sent.push(c);if(c===3)throw Error('reset failed')}}),/reset failed/);assert.deepEqual(sent,[4,3,5]);
});
