import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {decode,patch,command,remapRead,remapWrite,inputParts,decodeLatency} from '../protocol.mjs';
const bytes=()=>{const b=new Uint8Array(36);b[0]=6;new DataView(b.buffer).setFloat32(1,1.1,true);b[5]=100;b[6]=75;b[7]=2;b[8]=30;b[10]=2;b[11]=56;b[12]=2;b[13]=1;b[17]=1;b[20]=1;b[22]=b[23]=b[24]=255;b[26]=3;b[27]=8;b[29]=1;return b};
const view=(id,b)=>new DataView(Uint8Array.of(id,...b).buffer);
test('config: packed offsets, LE float, preserve runtime fields and reject corruption before write',()=>{const b=bytes();const v=view(247,b);const p=patch(v,{haptics_gain:1.7,tp_block_raw:1,combo_window:50});assert.equal(p[20],1);assert.equal(p[31],1);assert.equal(p[30],50);assert.equal(decode(view(247,p)).haptics_gain,Math.fround(1.7));for(let i=5;i<30;i++)assert.equal(p[i],b[i]);assert.throws(()=>patch(v,{speaker_volume:128}));assert.throws(()=>patch(v,{combo_window:NaN}));assert.throws(()=>patch(v,{controller_mode:1.2}));assert.throws(()=>decode(view(247,[7,...b.slice(1)])));assert.throws(()=>decode(view(247,b.slice(0,31))));assert.throws(()=>decode(view(246,b)));assert.throws(()=>patch(v,{dse_detected:0}));assert.equal(command(1,p).length,63)});
test('remap: complete two-group format and invalid reply checks',()=>{const table=Uint8Array.from({length:124},(_,i)=>i%4===1?Math.floor(i/4):0);const r=remapRead(view(251,[1,0,...table]),0);assert.equal(r.active,1);assert.deepEqual(r.table,table);assert.deepEqual(remapWrite(1,table).slice(0,6),Uint8Array.of(1,1,0,0,0,0));assert.throws(()=>remapRead(view(251,[1,1,...table]),0));table[0]=3;assert.throws(()=>remapWrite(0,table))});
test('input: diagonals, digital buttons and trigger channels follow firmware payload',()=>{const b=new Uint8Array(63);b.set([0,255,127,128,64,255]);b[7]=0x21;b[8]=0x21;const i=inputParts(b);for(const k of ['dpad-up','dpad-right','cross','l1','options'])assert(i.parts.has(k));assert.deepEqual(i.axes,[0,255,127,128]);assert.deepEqual(i.triggers,[64,255]);assert.equal(inputParts(new Uint8Array(9)),null)});
function ui({version=6,corrupt=false,production=false,auto=false,noHid=false}={}){
 let telemetry=new Uint8Array(13);telemetry[11]=255;const timers=[];let telemetryFails=false,now=1000,gamepads=[];
 const html=readFileSync(new URL(production?'../auth-preview.html':'../index.html',import.meta.url),'utf8');const {window}=parseHTML(html);
 // linkedom omits native browser form value/validity setters.
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value??this.options[0]?.value??''},set(v){for(const o of this.options)o.toggleAttribute('selected',String(o.value)===String(v))}});
 window.HTMLInputElement.prototype.setCustomValidity=function(s){this.validationMessage=s};window.HTMLInputElement.prototype.checkValidity=function(){return !this.validationMessage};
 let cfg=bytes();cfg[0]=version;let selected=0;const tables=[0,1].map(()=>Uint8Array.from({length:124},(_,i)=>i%4===1?Math.floor(i/4):0));const sent=[],listeners={};
 const device={vendorId:1356,productId:3302,opened:false,collections:[{featureReports:[{reportId:247}]}],async open(){this.opened=true},async close(){this.opened=false},addEventListener(n,f){listeners[n]=f},removeEventListener(n){delete listeners[n]},async receiveFeatureReport(id){if(id===248)return view(id,new TextEncoder().encode('LCT616-DS5 3.18-oc2'));if(id===247)return view(id,cfg);if(id===251)return view(id,[0,selected,...tables[selected]]);if(id===249){if(telemetryFails)throw Error('telemetry failed');return view(id,telemetry)}throw Error('unexpected read')},async sendFeatureReport(id,p){sent.push([id,p.slice()]);if(id===246&&p[0]===1){cfg=p.slice(1,33);if(corrupt)cfg[31]=0}if(id===251&&p[0]===3)selected=p[1];if(id===251&&p[0]===1)tables[p[1]]=p.slice(2,126)}};
 const outputs=[];device.sendReport=async(id,p)=>{outputs.push([id,p.slice()])};
 const navigator=noHid?{getGamepads(){return gamepads}}:{hid:{async requestDevice(){return [device]},async getDevices(){return auto?[device]:[]},addEventListener(n,f){listeners[n]=f}},getGamepads(){return gamepads}};
 const ctx={__DS5_LANG:'zh-CN',atob,Blob,URL,isSecureContext:true,Date:class extends Date{static now(){return now}},document:window.document,navigator,localStorage:{getItem(k){return k==='ds5.lang'?'zh-CN':null},setItem(){}},setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout(t){if(t)t.cancelled=true},clearInterval(){},setInterval(fn,ms){timers.push({fn,ms})},confirm:()=>true,TextDecoder,Uint8Array,DataView,TextEncoder,Event:window.Event,console};vm.runInNewContext(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1],ctx);
 const el=id=>window.document.getElementById(id);return {el,window,device,sent,outputs,expire(ms=5000){const t=timers.find(t=>t.ms===ms&&!t.cancelled&&!t.fired);if(!t)throw Error("No pending timeout");t.fired=true;t.fn()},
 input(axes,buttons=0){now+=50;const b=new Uint8Array(63);b.set(axes);b[7]=8;b[8]=buttons;listeners.inputreport({device,reportId:1,data:new DataView(b.buffer)})},
 setPads(pads){gamepads=pads},async tick(ms=50){now+=ms;await timers.find(t=>t.ms===50).fn()},setBattery(pct,state){telemetry[11]=pct;telemetry[12]=state},setLink(state,bonds=1){const b=new Uint8Array(17);b.set(telemetry.slice(0,13));b[13]=0xd3;b[14]=state;b[15]=bonds;telemetry=b},failTelemetry(){telemetryFails=true},setLatency(age=1000,count=50){const b=new Uint8Array(51);b.set(telemetry.slice(0,13));b[13]=0xd3;b[14]=7;b[17]=0x4c;b[18]=1;const v=new DataView(b.buffer);[count,1200,1100,500,2000,age,400,800].forEach((n,i)=>v.setUint32(19+i*4,n,true));telemetry=b},async poll(){await timers.find(t=>t.ms===2000).fn()},disconnect:()=>listeners.disconnect({device}),cfg:()=>cfg};
}
test('UI: connect, stage only, rebase config, verify then save, disconnect cleanup',async()=>{const u=ui();await u.el('connect').onclick();assert.equal(u.el('connection').textContent,'接收器已连接');u.window.document.querySelector('[data-page="touch"]').onclick();const c=u.window.document.querySelector('#controls input[type="checkbox"]');c.checked=true;c.onchange();assert.equal(u.sent.filter(([id])=>id===246).length,0);u.cfg()[6]=42;await u.el('save').onclick();const writes=u.sent.filter(([id])=>id===246);assert.deepEqual(writes.map(([,p])=>p[0]),[1,2]);assert.equal(u.cfg()[6],42);assert.equal(u.cfg()[31],1);assert.equal(u.el('save').disabled,true);u.disconnect();assert.equal(u.el('connection').textContent,'尚未连接接收器');assert.equal(u.el('save').disabled,true)});
test('UI: wrong config version never enables writes',async()=>{const u=ui({version:9});await u.el('connect').onclick();assert.match(u.el('message').textContent,/不兼容/);assert.equal(u.el('save').disabled,true);assert.equal(u.sent.length,0)});
test('restart UI waits for controller release and only then requests reset',async()=>{
 const u=ui();await u.el('connect').onclick();let state=7,flags=0x81;const read=u.device.receiveFeatureReport.bind(u.device),send=u.device.sendFeatureReport.bind(u.device);
 u.device.receiveFeatureReport=async id=>{if(id!==249)return read(id);const b=new Uint8Array(17);b[13]=0xd3;b[14]=state;b[16]=flags;return view(id,b)};
 u.device.sendFeatureReport=async(id,p)=>{await send(id,p);if(id===246&&p[0]===4){state=0;flags=0xc0}};
 await u.el('reboot').onclick();assert.deepEqual(u.sent.filter(([id])=>id===246).map(([,p])=>p[0]),[4,3]);assert.equal(u.el('connection').textContent,'尚未连接接收器');assert.match(u.el('message').textContent,/确认手柄断开/);
});
test('restart failure keeps the receiver connection and never sends reset',async()=>{
 const u=ui();await u.el('connect').onclick();let prepared=false;const read=u.device.receiveFeatureReport.bind(u.device),send=u.device.sendFeatureReport.bind(u.device);
 u.device.receiveFeatureReport=async id=>{if(id!==249)return read(id);if(prepared)throw Error('USB status failed');const b=new Uint8Array(17);b[13]=0xd3;b[14]=7;b[16]=0x81;return view(id,b)};
 u.device.sendFeatureReport=async(id,p)=>{await send(id,p);if(id===246&&p[0]===4)prepared=true};
 await u.el('reboot').onclick();assert.deepEqual(u.sent.filter(([id])=>id===246).map(([,p])=>p[0]),[4,5]);assert.equal(u.el('connection').textContent,'接收器已连接');assert.equal(u.device.opened,true);assert.match(u.el('message').textContent,/USB status failed/);
});
test('polling interval changes explicitly require restart and retain that hint after save',async()=>{const u=ui();await u.el('connect').onclick();u.window.document.querySelector('[data-page="device"]').onclick();const polling=u.window.document.querySelectorAll('#controls select')[1];polling.value=0;polling.onchange();assert.equal(u.el('restart-hint').hidden,false);await u.el('save').onclick();assert.match(u.el('restart-hint').textContent,/重启接收器后生效/);assert.equal(u.el('reboot').disabled,false)});
test('authentication preview never enables configuration without a trust anchor or device identity',async()=>{const u=ui({production:true});await u.el('connect').onclick();assert.match(u.el('message').textContent,/生产信任公钥|未支持身份认证/);assert.equal(u.el('save').disabled,true);assert.equal(u.el('connection').textContent,'尚未连接接收器');assert.equal(u.device.opened,false);assert.equal(u.sent.length,0)});
test('mapping selection highlights the source, survives live input and redraw, clears outside mapping without device writes',async()=>{
 const u=ui();await u.el('connect').onclick();u.window.document.querySelector('[data-page="remap"]').onclick();
 const selected=()=>[...u.el('art').querySelectorAll('.mapping-source')].map(p=>p.dataset.part);
 assert.deepEqual(selected(),['square']);const source=u.el('mapping-source');source.value=10;source.onchange();assert.deepEqual(selected(),['stick-l']);assert.match(u.el('mapping-selection').textContent,/L3/);
 u.input([255,0,128,128],0x40);assert.deepEqual(selected(),['stick-l']);await u.tick(3100);assert.deepEqual(selected(),['stick-l']);
 // Editing the target must not change which source is highlighted.
 const type=u.window.document.querySelectorAll('#controls select')[2];type.value=1;type.onchange();assert.deepEqual(selected(),['stick-l']);
 u.el('revert').onclick();assert.equal(u.el('mapping-source').value,'10');assert.deepEqual(selected(),['stick-l']);
 u.el('mapping-source').value=25;u.el('mapping-source').onchange();assert.deepEqual(selected(),['touchpad']);assert.match(u.el('mapping-selection').textContent,/右区触摸/);
 u.window.document.querySelector('[data-page="audio"]').onclick();assert.deepEqual(selected(),[]);assert.equal(u.el('mapping-selection').hidden,true);assert.equal(u.sent.filter(([id])=>id===246).length,0);
});
test('mapping source highlight also follows Edge artwork and diagram clicks',async()=>{
 const u=ui();u.device.productId=0x0df2;await u.el('connect').onclick();const triangle=u.el('art').querySelector('[data-part="triangle"]');u.el('art').onclick({target:triangle});assert.equal(u.el('mapping-source').value,'3');assert.equal(triangle.classList.contains('mapping-source'),true);assert.match(u.el('mapping-selection').textContent,/三角/);
 u.window.document.querySelector('[data-page="feel"]').onclick();assert.equal(triangle.classList.contains('mapping-source'),false);
});
test('mapping controls remain enabled after each source selection; stalled group reads unlock on timeout',async()=>{
 const u=ui();await u.el('connect').onclick();u.window.document.querySelector('[data-page="remap"]').onclick();
 for(let i=0;i<31;i++){u.el('mapping-source').value=i;u.el('mapping-source').onchange();for(const c of u.window.document.querySelectorAll('#controls input,#controls select,#controls button'))assert.equal(c.disabled,false,`source ${i}: ${c.tagName}`)}
 const read=u.device.receiveFeatureReport;u.device.receiveFeatureReport=id=>id===251?new Promise(()=>{}):read.call(u.device,id);const group=u.window.document.querySelector('#controls select');group.value=1;group.onchange();for(let i=0;i<15;i++)await Promise.resolve();assert.equal(u.el('mapping-source').disabled,true);u.expire();for(let i=0;i<20;i++)await Promise.resolve();assert.equal(u.el('mapping-source').disabled,false);assert.equal(group.value,'0');assert.match(u.el('message').textContent,/读取按键映射超时/);
});
test('firmware update is embedded in the same page, detects installed version and clears it on disconnect',async()=>{
 const u=ui();await u.el('connect').onclick();assert.equal(u.el('firmware-notice').hidden,false);u.el('firmware-notice').onclick();assert.equal(u.el('panel-title').textContent,'固件更新');assert.match(u.el('controls').textContent,/LCT616-DS5 3.18-oc2/);assert.match(u.el('controls').textContent,/3.18H-oc8/);
 const host=u.window.document.querySelector('.embedded-flasher');assert(host.shadowRoot.querySelector('#connect-button'));assert(host.shadowRoot.querySelector('#status-text'));assert.equal(u.window.document.querySelector('.flash-nav'),null);u.disconnect();assert.equal(u.el('firmware-notice').hidden,true);assert.match(u.el('controls').textContent,/尚未连接/);
});
test('connection timeout unlocks UI, ignores late reply, and permits retry',async()=>{
 const u=ui(),read=u.device.receiveFeatureReport;let release;u.device.receiveFeatureReport=()=>new Promise(r=>release=r);
 const connecting=u.el('connect').onclick();for(let i=0;i<15;i++)await Promise.resolve();assert.match(u.el('message').textContent,/读取固件/);u.expire();await connecting;
 assert.equal(u.el('connect').disabled,false);assert.equal(u.el('save').disabled,true);assert.match(u.el('message').textContent,/读取固件信息超时/);assert.equal(u.device.opened,false);
 release(view(248,new TextEncoder().encode('LCT616-DS5 3.18H-oc8')));for(let i=0;i<15;i++)await Promise.resolve();assert.equal(u.el('connection').textContent,'尚未连接接收器');
 u.device.receiveFeatureReport=read;await u.el('connect').onclick();assert.equal(u.el('connection').textContent,'接收器已连接');
});
test('opening and closing timeouts cannot permanently lock the connect button',async()=>{
 const u=ui();let release;u.device.open=()=>new Promise(r=>release=()=>{u.device.opened=true;r()});const connecting=u.el('connect').onclick();for(let i=0;i<15;i++)await Promise.resolve();u.expire();await connecting;assert.equal(u.el('connect').disabled,false);release();for(let i=0;i<15;i++)await Promise.resolve();assert.equal(u.device.opened,false);
 const v=ui();v.device.receiveFeatureReport=()=>new Promise(()=>{});v.device.close=()=>new Promise(()=>{});const pending=v.el('connect').onclick();for(let i=0;i<15;i++)await Promise.resolve();v.expire();for(let i=0;i<15;i++)await Promise.resolve();v.expire(500);await pending;assert.equal(v.el('connect').disabled,false);assert.match(v.el('message').textContent,/超时/);
});
test('test center: connects without flash writes, refuses unpaired controller, navigation resets rumble',async()=>{
 const u=ui();await u.el('connect').onclick();u.window.document.querySelector('[data-page="test"]').onclick();assert.equal(u.el('panel-title').textContent,'测试中心');
 await u.el('test-rumble').onclick();assert.match(u.el('message').textContent,/先连接手柄/);assert.equal(u.outputs.length,0);
 u.setLink(7);await u.poll();u.el('rumble-left').value=50;u.el('rumble-right').value=0;await u.el('test-rumble').onclick();assert.equal(u.outputs.at(-1)[1][3],50);
 u.window.document.querySelector('[data-page="audio"]').onclick();for(let i=0;i<20;i++)await Promise.resolve();assert.equal(u.outputs.at(-1)[1][3],0);assert.equal(u.sent.filter(([id])=>id===246).length,0);
});
test('test center: stop works offline and missing media API provides a readable message',async()=>{
 const u=ui();u.window.document.querySelector('[data-page="test"]').onclick();assert.equal(u.el('test-stop').disabled,false);assert.equal(u.el('test-rumble').disabled,true);assert.equal(u.el('test-tone').disabled,false);await u.el('test-tone').onclick();assert.match(u.el('message').textContent,/不支持音频测试/);await u.el('test-stop').onclick();assert.match(u.el('message').textContent,/请先连接接收器/);
});
test('UI: failed readback does not issue config save',async()=>{const u=ui({corrupt:true});await u.el('connect').onclick();u.window.document.querySelector('[data-page="touch"]').onclick();const c=u.window.document.querySelector('#controls input[type="checkbox"]');c.checked=true;c.onchange();await u.el('save').onclick();assert.match(u.el('message').textContent,/回读不一致/);assert.deepEqual(u.sent.filter(([id])=>id===246).map(([,p])=>p[0]),[1])});
test('UI: mapping writes all 31 entries and reads back selected group',async()=>{const u=ui();await u.el('connect').onclick();u.window.document.querySelector('[data-page="remap"]').onclick();const selects=u.window.document.querySelectorAll('#controls select');selects[3].value=1;selects[3].onchange();await u.el('save').onclick();const write=u.sent.find(([id,p])=>id===251&&p[0]===1);assert(write);assert.equal(write[1].length,127);assert.equal(write[1][3],1);assert.equal(u.el('save').disabled,true)});

test('battery UI: discharge warning, charging message, recovery, missing data and disconnect',async()=>{
 const u=ui();await u.el('connect').onclick();
 u.setBattery(10,0);await u.poll();
 assert.equal(u.el('battery').textContent,'10%');
 assert.equal(u.el('battery-alert').hidden,false);
 assert.equal(u.el('battery-card').dataset.level,'low');
 assert.match(u.el('battery-explanation').textContent,/不代表连接失败/);
 u.setBattery(10,1);await u.poll();
 assert.equal(u.el('battery-alert').dataset.kind,'charging');
 assert.equal(u.el('battery-card').dataset.level,'normal');
 assert.match(u.el('battery-warning').textContent,/正在充电/);
 u.setBattery(20,0);await u.poll();assert.equal(u.el('battery-alert').hidden,true);
 u.setBattery(255,0);await u.poll();assert.equal(u.el('battery').textContent,'—');assert.equal(u.el('battery-alert').hidden,true);
 u.setBattery(0,0);await u.poll();assert.equal(u.el('battery-alert').hidden,false);
 u.disconnect();assert.equal(u.el('battery-alert').hidden,true);assert.equal(u.el('battery-card').dataset.level,'normal');
});

test('separate status: receiver alone never means controller connected; editing preserves telemetry; read failure clears stale state',async()=>{
 const u=ui();await u.el('connect').onclick();
 assert.equal(u.el('connection').textContent,'接收器已连接');assert.equal(u.el('controller-connection').textContent,'手柄状态待更新');
 u.setLink(7);u.setBattery(60,1);await u.poll();
 assert.equal(u.el('controller-connection').textContent,'手柄已连接');assert.equal(u.el('power-status').textContent,'60% · 正在充电');
 u.window.document.querySelector('[data-page="audio"]').onclick();assert.equal(u.el('controller-connection').textContent,'手柄已连接');
 u.setLink(1,0);await u.poll();assert.equal(u.el('controller-connection').textContent,'正在搜索手柄');assert.equal(u.el('connection').textContent,'接收器已连接');
 u.failTelemetry();await u.poll();assert.equal(u.el('controller-connection').textContent,'手柄状态待更新');assert.equal(u.el('power-status').textContent,'电量待更新');
 u.disconnect();assert.equal(u.el('controller-connection').textContent,'手柄状态未读取');
});
test('sliders: precise input syncs, stages only, rejects invalid steps and undo sends nothing',async()=>{
 const u=ui();await u.el('connect').onclick();
 const h=u.window.document.querySelector('input[type="number"][data-field="haptics_gain"]');
 assert.equal(Number(h.value),1.1);h.oninput();assert.equal(u.el('save').disabled,true);
 u.window.document.querySelector('[data-page="audio"]').onclick();
 const slider=u.window.document.querySelector('input[type="range"][data-field="speaker_volume"]'),number=u.window.document.querySelector('input[type="number"][data-field="speaker_volume"]');
 slider.value=85;slider.oninput();assert.equal(Number(number.value),85);assert.equal(u.el('dirty').textContent,'有 1 项未应用');
 number.value=86;number.oninput();assert.equal(Number(slider.value),86);
 number.value='86.5';number.oninput();await u.el('save').onclick();assert.match(u.el('message').textContent,/无效/);assert.equal(u.sent.filter(([id])=>id===246).length,0);
 u.el('revert').onclick();assert.equal(u.el('save').disabled,true);assert.equal(u.el('dirty').textContent,'没有未应用的更改');assert.equal(u.sent.filter(([id])=>id===246).length,0);
});
test('savebar: color is one change, mapping undo restores baseline, restart requirement survives reread and undo',async()=>{
 const u=ui();await u.el('connect').onclick();
 const color=u.window.document.querySelector('#controls input[type="color"]');color.value='#66c7ff';color.oninput();assert.equal(u.el('dirty').textContent,'有 1 项未应用');u.el('revert').onclick();
 u.window.document.querySelector('[data-page="remap"]').onclick();let selects=u.window.document.querySelectorAll('#controls select');selects[3].value=1;selects[3].onchange();assert.equal(u.el('dirty').textContent,'有 1 项未应用');u.el('revert').onclick();assert.equal(u.el('save').disabled,true);
 u.window.document.querySelector('[data-page="device"]').onclick();const mode=u.window.document.querySelector('#controls select');mode.value=0;mode.onchange();assert.equal(u.el('restart-hint').hidden,false);assert.equal(u.el('reboot').disabled,true);
 await u.el('save').onclick();assert.match(u.el('restart-hint').textContent,/重启接收器后生效/);assert.equal(u.el('reboot').disabled,false);assert.equal(u.el('save').disabled,true);
 await u.el('reload').onclick();assert.equal(u.el('restart-hint').hidden,false);u.el('revert').onclick();assert.equal(u.el('restart-hint').hidden,false);
 await u.el('connect').onclick();await u.el('connect').onclick();assert.equal(u.el('restart-hint').hidden,false);
 u.disconnect();await u.el('connect').onclick();assert.equal(u.el('restart-hint').hidden,true);
});

test('live sticks: independent direction, full travel, neutral and no cumulative transform; timeout/disconnect reset',async()=>{
 const u=ui();await u.el('connect').onclick();
 const left=u.el('art').querySelector('[data-part="stick-l"]'),right=u.el('art').querySelector('[data-part="stick-r"]');
 const lb=left.getAttribute('transform'),rb=right.getAttribute('transform');
 u.input([255,0,0,255],0xc0);
 assert.equal(left.getAttribute('transform'),`translate(9.00 -9.00) ${lb}`);
 assert.equal(right.getAttribute('transform'),`translate(-9.00 9.00) ${rb}`);
 assert.equal(left.classList.contains('pressed'),true);assert.equal(right.classList.contains('pressed'),true);assert.equal(left.classList.contains('moving'),true);assert.equal(right.classList.contains('moving'),true);
 u.input([255,0,0,255]);assert.equal(left.getAttribute('transform'),`translate(9.00 -9.00) ${lb}`);
 u.input([127,128,128,127]);assert.equal(left.classList.contains('moving'),false);assert.equal(right.classList.contains('moving'),false);assert.equal(left.getAttribute('transform'),`translate(0.00 0.00) ${lb}`);assert.equal(right.getAttribute('transform'),`translate(0.00 0.00) ${rb}`);
 u.input([0,255,255,0]);await u.tick(3100);assert.equal(left.classList.contains('moving'),false);assert.equal(right.classList.contains('moving'),false);assert.equal(left.getAttribute('transform'),lb);assert.equal(right.getAttribute('transform'),rb);
 u.input([255,255,0,0]);u.disconnect();assert.equal(left.getAttribute('transform'),lb);assert.equal(right.getAttribute('transform'),rb);
});
test('live sticks: explicit browser gamepad source also drives movement and source switching resets',async()=>{
 const u=ui();await u.el('connect').onclick();
 const left=u.el('art').querySelector('[data-part="stick-l"]'),base=left.getAttribute('transform');
 u.setPads([{index:0,id:'Test pad',mapping:'standard',axes:[-1,1,1,-1],buttons:Array.from({length:18},()=>({pressed:false,value:0}))}]);
 await u.tick();u.el('gamepad').value='0';u.el('gamepad').onchange();await u.tick();
 assert.equal(left.getAttribute('transform'),`translate(-9.00 9.00) ${base}`);
 u.el('gamepad').value='';u.el('gamepad').onchange();assert.equal(left.getAttribute('transform'),base);
});

test('Edge artwork: preserves its own neutral transform and resets after timeout',async()=>{
 const u=ui();u.device.productId=0x0df2;await u.el('connect').onclick();
 const left=u.el('art').querySelector('[data-part="stick-l"]'),right=u.el('art').querySelector('[data-part="stick-r"]');
 assert.equal(left.getAttribute('transform'),null);
 u.input([0,0,255,255]);assert.equal(left.getAttribute('transform'),'translate(-9.00 -9.00)');assert.equal(right.getAttribute('transform'),'translate(9.00 9.00)');
 await u.tick(3100);assert.equal(left.getAttribute('transform'),null);assert.equal(right.getAttribute('transform'),null);
});

test('latency telemetry: version, byte offsets, coherent stage sum and incomplete/old reports',()=>{
 const b=new Uint8Array(51);b[17]=0x4c;b[18]=1;const v=new DataView(b.buffer);
 [50,1200,1100,500,2000,1000,400,800].forEach((n,i)=>v.setUint32(19+i*4,n,true));
 assert.deepEqual(decodeLatency(b),{count:50,last:1200,average:1100,min:500,max:2000,age:1000,queue:400,usb:800,recent:true});
 assert.equal(decodeLatency(b.slice(0,50)),null);assert.equal(decodeLatency(new Uint8Array(63)),null);
 v.setUint32(39,4000000,true);assert.equal(decodeLatency(b).recent,false);
 v.setUint32(47,801,true);assert.equal(decodeLatency(b),null);
});

test('latency v2: queue wait and processing split stays coherent with v1 total',()=>{
 const b=new Uint8Array(59);b[17]=0x4c;b[18]=2;const v=new DataView(b.buffer);
 [25,350,300,100,1000,500,300,50,180,120].forEach((n,i)=>v.setUint32(19+i*4,n,true));
 const d=decodeLatency(b);assert.equal(d.last,350);assert.equal(d.queueWait,180);assert.equal(d.processing,120);
 assert.equal(decodeLatency(b.slice(0,58)),null);v.setUint32(55,121,true);assert.equal(decodeLatency(b),null);
});

test('latency v3: real processing and pending wait are distinct, reject truncation and impossible decomposition',()=>{
 const b=new Uint8Array(63);b[17]=0x4c;b[18]=3;const v=new DataView(b.buffer);
 [25,350,300,100,1000,500,300,50,180,120,100].forEach((n,i)=>v.setUint32(19+i*4,n,true));
 const d=decodeLatency(b);assert.equal(d.processingOnly,20);assert.equal(d.pendingWait,100);assert.equal(d.queueWait+d.processingOnly+d.pendingWait+d.usb,d.last);
 assert.equal(decodeLatency(b.slice(0,62)),null);v.setUint32(59,121,true);assert.equal(decodeLatency(b),null);
});

test('UI: silently reconnects when the browser already granted access',async()=>{
 const u=ui({auto:true});
 // 初始化里的 void autoReconnect() 走微任务
 for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));
 assert.equal(u.el('connection').textContent,'接收器已连接');
 assert.match(u.el('version').textContent,/LCT616/);
 assert.equal(u.el('connect').textContent,'断开连接');
});
test('UI: stays disconnected without prior permission and never auto-prompts',async()=>{
 const u=ui({auto:false});
 for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));
 assert.equal(u.el('connection').textContent,'尚未连接接收器');
 assert.equal(u.el('connect').textContent,'连接接收器');
});

test('verdict: one line answers whether the player can start',async()=>{
 const u=ui();
 await u.poll();
 assert.equal(u.el('verdict-title').textContent,'接收器尚未连接');
 assert.equal(u.el('verdict').dataset.state,'warn');

 await u.el('connect').onclick();
 await u.poll();
 assert.equal(u.el('verdict-title').textContent,'手柄尚未配对');
 assert.equal(u.el('verdict-detail').textContent,'同时按住 PS + Create 3 秒');

 u.setBattery(85,0);
 u.setLink(7,1);
 await u.poll();
 assert.equal(u.el('verdict-title').textContent,'已就绪，可以开始游戏');
 assert.equal(u.el('verdict-detail').textContent,'DualSense · 85%');
 assert.equal(u.el('verdict').dataset.state,'ok');

 u.disconnect();
 await u.poll();
 assert.equal(u.el('verdict').dataset.state,'warn');
});

test('verdict: explains a browser without WebHID instead of showing an empty page',async()=>{
 const u=ui({noHid:true});
 await u.poll();
 assert.equal(u.el('verdict-title').textContent,'此浏览器不支持 WebHID');
 assert.equal(u.el('verdict').dataset.state,'bad');
});

test('quick actions: disabled until the controller is ready, then send output reports only',async()=>{
 const u=ui();
 await u.poll();
 for(const id of ['qa-rumble','qa-trigger','qa-lights']){
  assert.equal(u.el(id).disabled,true,'disabled before connect');
  assert.equal(u.el(id).textContent,{ 'qa-rumble':'试震动','qa-trigger':'试扳机','qa-lights':'试灯光' }[id]);
 }
 await u.el('connect').onclick();
 await u.poll();
 assert.equal(u.el('qa-rumble').disabled,true,'still disabled without a paired controller');

 u.setLink(7,1);
 await u.poll();
 for(const id of ['qa-rumble','qa-trigger','qa-lights'])assert.equal(u.el(id).disabled,false);

 const before=u.outputs.length;
 u.el('qa-rumble').onclick();
 await new Promise(r=>setImmediate(r));
 assert.ok(u.outputs.length>before,'rumble sends an output report');
 // 快捷按钮不得写入配置
 assert.equal(u.sent.filter(([id])=>id===246).length,0);
 assert.equal(u.el('qa-hint').textContent,'临时测试，不写入设置');
});

test('quick actions: trigger test uses a real effect mode and covers both sides',async()=>{
 const u=ui();
 await u.poll();
 await u.el('connect').onclick();
 u.setLink(7,1);
 await u.poll();
 const before=u.outputs.length;
 await u.el('qa-trigger').onclick();
 for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));
 const sent=u.outputs.slice(before);
 assert.ok(sent.length>0,'trigger test sends a report');
 const left=sent.find(([,b])=>b[0]===8);
 assert.ok(left,'left trigger report');
 assert.equal(left[1][21],0x21,'feedback effect byte (0x21), not an unknown mode');
 assert.equal(u.el('message').textContent.includes('未知'),false,'no silent failure');
});

test('quick actions: each test opens its own settings block',async()=>{
 const u=ui();
 await u.poll();
 await u.el('connect').onclick();
 u.setLink(7,1);
 await u.poll();

 assert.notEqual(u.window.document.body.dataset.page,'test');
 await u.el('qa-rumble').onclick();
 assert.equal(u.window.document.body.dataset.page,'test','rumble test opens diagnostics');
 assert.ok(u.window.document.getElementById('test-rumble'),'rumble controls exist');

 await u.window.document.querySelector('[data-page="feel"]').onclick();
 assert.equal(u.window.document.body.dataset.page,'feel');
 await u.el('qa-trigger').onclick();
 assert.equal(u.window.document.body.dataset.page,'test','trigger test returns to diagnostics');
 assert.ok(u.window.document.getElementById('test-trigger'));

 await u.el('qa-lights').onclick();
 assert.equal(u.window.document.body.dataset.page,'test');
 assert.ok(u.window.document.getElementById('test-lights'));
});
