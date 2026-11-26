import {test} from 'node:test';
import assert from 'node:assert/strict';
import {triggerEffect,testOutput,createOutputTester,createAudioTester} from '../test-center.mjs';
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
function setup(){const packets=[],timers=[],messages=[];let linked=true;const device={opened:true,productId:0x0ce6,async sendReport(id,b){packets.push([id,b])}};const tester=createOutputTester({getDevice:()=>device,isConnected:()=>linked,getColor:()=>[10,20,30],notify:(s)=>messages.push(s),timer(fn,ms){const t={fn,ms};timers.push(t);return t},cancel(t){if(t)t.cancelled=true}});return {tester,device,packets,timers,messages,unlink(){linked=false}}}
test('output: DS / Edge lengths, channel isolation, no configuration or volume flags',()=>{
 const rumble=testOutput('rumble',{left:80,right:30});assert.equal(rumble.length,47);assert.deepEqual([...rumble.slice(0,10)],[3,0,30,80,0,0,0,0,0,0]);
 const left=testOutput('trigger',{side:'left',mode:'feedback',strength:3,start:3},true);assert.equal(left.length,63);assert.equal(left[0],8);assert(left.slice(10,21).every(v=>v===0));assert.equal(left[21],0x21);
 const right=testOutput('trigger',{side:'right',mode:'off'});assert.equal(right[0],4);assert.equal(right[10],5);assert(right.slice(21,32).every(v=>v===0));
 const light=testOutput('lights',{rgb:[144,76,129]});assert.equal(light[1],0x04);assert.equal(light[38],0x03);assert.deepEqual([...light.slice(41,47)],[2,0,0,144,76,129]);
 assert.throws(()=>testOutput('rumble',{left:256}));assert.throws(()=>testOutput('rumble',{right:NaN}));assert.throws(()=>testOutput('trigger',{side:'both'}));
});
test('trigger: documented active zones, packed force, weapon bounds, vibration frequency and explicit off',()=>{
 const a=triggerEffect('feedback',8,9);assert.deepEqual([...a.slice(0,3)],[0x21,0,2]);assert.equal(new DataView(a.buffer).getUint32(3,true),7*2**27);
 const w=triggerEffect('weapon',3,3);assert.deepEqual([...w.slice(0,4)],[0x25,8,1,2]);assert.throws(()=>triggerEffect('weapon',3,1));assert.throws(()=>triggerEffect('feedback',0,3));
 assert.equal(triggerEffect('vibration',3,3)[9],30);assert.deepEqual([...triggerEffect()], [5,0,0,0,0,0,0,0,0,0,0]);
});
test('timed tests: rumble automatically stops, switching triggers resets previous side, lights restore baseline',async()=>{
 const u=setup();await u.tester.run('rumble',{left:80,right:0});assert.equal(u.timers[0].ms,2000);await u.timers[0].fn();await flush();assert.equal(u.packets.at(-1)[1][3],0);
 await u.tester.run('trigger',{side:'left',mode:'feedback',strength:3,start:3});await u.tester.run('trigger',{side:'right',mode:'vibration',strength:3,start:3});assert.equal(u.packets.at(-2)[1][21],5);assert.equal(u.packets.at(-1)[1][10],0x26);
 await u.tester.run('lights',{rgb:[90,80,70],players:31,brightness:2});assert.equal(u.timers.at(-1).ms,5000);await u.tester.stop();const b=u.packets.at(-1)[1];assert.deepEqual([...b.slice(42,47)],[0,0,10,20,30]);assert.equal(b[1],0x14);assert.equal(b[38],3);
});
test('stop races: pending start is cancelled, in-flight write finishes before reset, unplug never writes new effects',async()=>{
 const u=setup();const pending=u.tester.run('rumble',{left:50});await u.tester.stop();await pending;assert.equal(u.packets.length,0);
 let release;u.device.sendReport=(id,b)=>{u.packets.push([id,b]);return u.packets.length===1?new Promise(r=>release=r):Promise.resolve()};
 const running=u.tester.run('rumble',{left:50});await flush();assert.equal(u.packets.length,1);const stopped=u.tester.stop();release();await Promise.all([running,stopped]);assert.equal(u.packets.length,2);assert.equal(u.packets[1][1][3],0);assert.equal(u.timers.length,0);
 u.unlink();await assert.rejects(u.tester.run('rumble',{left:50}),/先连接/);assert.equal(u.packets.length,2);
});
test('failed start attempts a reset; reset failure is reported, subsequent tests can recover',async()=>{
 const u=setup();u.device.sendReport=async()=>{throw Error('USB failed')};await assert.rejects(u.tester.run('rumble',{left:50}),/USB failed/);assert.match(u.messages.at(-1),/停止指令未送达/);
 u.device.sendReport=async(id,b)=>u.packets.push([id,b]);await u.tester.run('rumble',{left:50});await u.tester.stop();assert.equal(u.packets.at(-1)[1][3],0);
});
function audioEnv(){const timers=[],contexts=[],tracks=[];const env={navigator:{mediaDevices:{async getUserMedia(){const track={stopped:false,stop(){this.stopped=true}};tracks.push(track);return {getTracks:()=>[track]}}}},setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout(t){if(t)t.cancelled=true},setInterval(fn,ms){const t={fn,ms};timers.push(t);return t},clearInterval(t){if(t)t.cancelled=true},AudioContext:class{
 constructor(){this.currentTime=0;this.closed=false;contexts.push(this)}async resume(){}async close(){this.closed=true}async setSinkId(id){this.sink=id}
 createOscillator(){return {frequency:{value:0},connect(g){return g},start(){},stop(){}}}createGain(){return {gain:{value:0},connect(){return this}}}createMediaStreamSource(){return {connect(){}}}createAnalyser(){return {fftSize:0,getFloatTimeDomainData(a){a.fill(.1)}}}
 }};return {env,timers,contexts,tracks}}
test('audio: explicit sink, one-second tone cleanup, mic meter without playback and all tracks released',async()=>{
 const u=audioEnv(),levels=[],a=createAudioTester({env:u.env,notify(){},onLevel:n=>levels.push(n)});await a.tone('dongle');assert.equal(u.contexts[0].sink,'dongle');assert.equal(u.timers[0].ms,1100);u.timers[0].fn();assert(u.contexts[0].closed);
 await a.microphone('dongle-mic');u.timers.find(t=>t.ms===50).fn();assert(levels.at(-1)>0);assert.equal(u.timers.at(-1).ms,30000);a.stop();assert(u.tracks.every(t=>t.stopped));assert(u.contexts.every(c=>c.closed));assert.equal(levels.at(-1),0);
});
test('audio: stopping while permission is pending releases the newly granted stream immediately',async()=>{
 const u=audioEnv();let resolve;let stopped=false;u.env.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolve=r);const a=createAudioTester({env:u.env,notify(){}});const pending=a.microphone();a.stop();resolve({getTracks:()=>[{stop(){stopped=true}}]});await pending;assert(stopped);assert.equal(u.contexts.length,0);
});
test('audio: permission denied and unsupported selected sink do not leak audio contexts',async()=>{
 const u=audioEnv();u.env.navigator.mediaDevices.getUserMedia=async()=>{throw Error('Permission denied')};const a=createAudioTester({env:u.env,notify(){}});await assert.rejects(a.microphone(),/Permission denied/);assert.equal(u.contexts.length,0);u.env.AudioContext.prototype.setSinkId=undefined;await assert.rejects(a.tone('dongle'),/无法选择/);assert(u.contexts[0].closed);
});

test('输出报告长度以描述符为准：PID 陈旧时也要补齐到 63 字节（Edge 场景）',async()=>{
 const packets=[];
 const device={opened:true,productId:0x0ce6,collections:[{outputReports:[{items:[{reportCount:63}]}]}],
  async sendReport(id,b){packets.push([id,b])}};
 const tester=createOutputTester({getDevice:()=>device,isConnected:()=>true,getColor:()=>[0,0,0],
  notify:()=>{},onState:()=>{},timer:()=>0,cancel:()=>{}});
 await tester.run('trigger',{side:'right',mode:'feedback',strength:5,start:0});
 await flush();
 const [id,payload]=packets.at(-1);
 assert.equal(id,2);
 assert.equal(payload.length,63,'应按描述符补齐到 63 字节');
 assert.equal(payload[0],0x04,'右扳机标志位');
 assert.equal(payload[10],0x21,'反馈模式');
});
