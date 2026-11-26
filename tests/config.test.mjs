import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {decode,patch,command,remapRead,remapWrite,inputParts,decodeLatency} from '../protocol.mjs';
const bytes=()=>{const b=new Uint8Array(36);b[0]=6;new DataView(b.buffer).setFloat32(1,1.1,true);b[5]=100;b[6]=75;b[7]=2;b[8]=30;b[10]=2;b[11]=56;b[12]=2;b[13]=1;b[17]=1;b[20]=1;b[22]=b[23]=b[24]=255;b[26]=3;b[27]=8;b[29]=1;return b};
const view=(id,b)=>new DataView(Uint8Array.of(id,...b).buffer);
const translations=JSON.parse(readFileSync(new URL('../i18n-catalog.json',import.meta.url),'utf8'));
test('all locales update the same Feel and Stick controls and follow incoming telemetry',async()=>{
 const u=ui({version:7});
 const receive=u.device.receiveFeatureReport.bind(u.device);
 u.device.receiveFeatureReport=id=>{
  if(id!==0xf7)return receive(id);
  const config=new Uint8Array(40);config.set(u.cfg());return Promise.resolve(view(id,config));
 };
 await u.el('connect').onclick();
 const doc=u.window.document,select=u.el('lang'),controls=u.el('controls'),scroll=doc.querySelector('.panel-scroll');
 const force=u.el('trigger-force'),effect=u.el('trigger-mode');
 effect.value='vibration';effect.onchange();force.value=7;force.oninput();
 scroll.scrollTop=75;
 const sendCount=u.sent.length,outputCount=u.outputs.length;
 const check=(key,locale)=>translations.messages[key][locale];
 function switchTo(locale){
  select.value=locale;select.onchange();
  assert.equal(doc.documentElement.lang,locale);
 }
 for(const locale of Object.keys(translations.locales)){
  switchTo(locale);
  u.setLink(3,2);await u.poll();
  assert.equal(u.el('controller-connection').textContent,check('phrase.querying_controller_services',locale));
  u.setLink(7,2);u.setBattery(40,0);await u.poll();u.input([128,128,128,128]);
  assert.equal(u.el('controller-connection').textContent,check('phrase.controller_connected',locale));
  assert.equal(u.el('link-status').textContent,check('link_rest',locale).replace('{count}',2).replace('{speed}',check('link_speed_unknown',locale)));
  assert.equal(u.el('input-state').textContent,check('live_input_hid',locale));
  assert.equal(u.el('save').textContent,check('phrase.save_this_page',locale));
  assert.equal(u.el('dirty').textContent,check('save_page_dirty',locale).replace('{count}',1));
  assert.ok(controls.textContent.includes(check('phrase.haptic_gain_can_be_saved_the_standard',locale)));
  assert.strictEqual(u.el('trigger-force'),force);assert.equal(Number(force.value),7);
  assert.strictEqual(u.el('trigger-mode'),effect);assert.equal(effect.value,'vibration');
  assert.equal(scroll.scrollTop,75);
 }
 doc.querySelector('.nav [data-page="sticks"]').onclick();
 const number=controls.querySelector('input[type="number"][data-field="stick_left_inner"]');
 number.value=14;number.oninput();
 for(const locale of Object.keys(translations.locales).reverse()){
  switchTo(locale);
  assert.ok(controls.textContent.includes(check('phrase.ignore_small_movements_near_the_center',locale)));
  assert.ok(controls.textContent.includes(check('phrase.reach_full_output_earlier',locale)));
  assert.strictEqual(controls.querySelector('input[type="number"][data-field="stick_left_inner"]'),number);
  assert.equal(Number(number.value),14);
  assert.equal(number.getAttribute('aria-label'),check('precise_value',locale).replace('{label}',check('phrase.left_stick_inner_deadzone',locale)));
 }
 // Navigation can stop a test. These language changes must not send commands or output reports.
 assert.equal(u.sent.length,sendCount);
 assert.equal(u.outputs.length,outputCount);
});
test('language switching updates the open panel and preserves unsaved settings',async()=>{
 const u=ui();await u.el('connect').onclick();
 const force=u.el('trigger-force');force.value=7;force.oninput();
 const lang=u.el('lang');
 lang.value='en';lang.onchange();
 assert.equal(u.el('panel-title').textContent,'Feel');
 assert.equal(u.el('save').textContent,'Save this page');
 assert.match(u.el('dirty').textContent,/1 unsaved changes on this page/);
 assert.match(u.el('controls').textContent,/Adaptive triggers/);
 assert.equal(Number(u.el('trigger-force').value),7);
 lang.value='ja';lang.onchange();
 assert.equal(u.window.document.querySelector('.nav [data-page="sticks"]').textContent,'スティック');
 lang.value='de';lang.onchange();
 assert.match(u.el('qa-color-label').textContent,/Leuchtfarbe beim Verbinden/);
 lang.value='fr';lang.onchange();
 assert.match(u.el('qa-color-label').textContent,/Couleur à la connexion/);
 lang.value='zh-CN';lang.onchange();
 assert.equal(u.el('panel-title').textContent,'手感');
 assert.match(u.el('controls').textContent,/自适应扳机/);
 assert.equal(u.el('save').disabled,false);
 assert.equal(u.sent.some(([id])=>id===246),false);
});
test('Japanese Feel and live connection labels do not revert on polling',async()=>{
 const u=ui();await u.el('connect').onclick();u.setBattery(50,0);u.setLink(7);
 const lang=u.el('lang');lang.value='ja';lang.onchange();
 await u.poll();await u.poll();
 assert.equal(u.el('connection').textContent,'ドングル接続済み');
 assert.equal(u.el('controller-connection').textContent,'コントローラー接続済み');
 assert.match(u.el('power-status').textContent,/バッテリー駆動/);
 assert.match(u.el('link-status').textContent,/ペアリング 1/);
 assert.match(u.el('controls').textContent,/振動と触覚.*アダプティブトリガー/s);
 assert.match(u.el('art-trigger-hint').textContent,/図の L2／R2/);
 assert.equal(u.el('save').textContent,'このページの設定を保存');
 assert.match(u.window.document.querySelector('.savebar').textContent,/保存の完了を待って/);
 lang.value='zh-CN';lang.onchange();
 assert.equal(u.el('controller-connection').textContent,'手柄已连接');
 assert.match(u.window.document.querySelector('.savebar').textContent,/保存由固件异步写入/);
});

test('Japanese stick settings and acceleration label use their selected locale',async()=>{
 const u=ui({version:7});
 const receive=u.device.receiveFeatureReport.bind(u.device);
 u.device.receiveFeatureReport=id=>{
  if(id!==0xf7)return receive(id);
  const config=new Uint8Array(40);config.set(u.cfg());return Promise.resolve(view(id,config));
 };
 const lang=u.el('lang');lang.value='ja';lang.onchange();
 const doc=u.window.document;
 doc.querySelector('.nav [data-page="sticks"]').onclick();
 assert.match(u.el('controls').textContent,/ドングルを接続すると/);
 await u.el('connect').onclick();
 const text=u.el('controls').textContent;
 assert.match(text,/oc15/);
 for(const side of ['左','右']) for(const edge of ['内','外'])assert.ok(text.includes(side+'スティック · '+edge+'側デッドゾーン'));
 assert.match(text,/中心付近の小さな動き/);
 assert.match(text,/出力が最大になる範囲/);
 assert.equal(doc.querySelector('[data-i18n="accel"]').textContent,'加速度 g');
 lang.value='en';lang.onchange();
 assert.match(u.el('controls').textContent,/Left stick · Inner deadzone/);
 lang.value='ja';lang.onchange();
 assert.match(u.el('controls').textContent,/左スティック · 内側デッドゾーン/);
});

test('Korean screenshot controls, telemetry and save status stay localized',async()=>{
 const u=ui();await u.el('connect').onclick();u.setBattery(40,0);u.setLink(7);
 const lang=u.el('lang');lang.value='ko';lang.onchange();
 await u.poll();await u.poll();u.input([128,128,128,128]);
 assert.equal(u.el('connection').textContent,'동글 연결됨');
 assert.equal(u.el('controller-connection').textContent,'컨트롤러 연결됨');
 assert.match(u.el('power-status').textContent,/배터리 사용 중/);
 assert.match(u.el('link-status').textContent,/페어링 1/);
 assert.match(u.el('input-state').textContent,/실시간 입력/);
 assert.match(u.el('controls').textContent,/진동 및 햅틱.*적응형 트리거/s);
 assert.match(u.el('art-trigger-hint').textContent,/그림에서 L2 또는 R2/);
 assert.equal(u.el('save').textContent,'이 페이지 설정 저장');
 assert.match(u.window.document.querySelector('.savebar').textContent,/저장이 끝난 뒤/);
 const force=u.el('trigger-force');force.value=7;force.oninput();
 assert.match(u.el('dirty').textContent,/변경 사항 1개/);
 lang.value='zh-CN';lang.onchange();
 assert.equal(u.el('controller-connection').textContent,'手柄已连接');
 assert.equal(Number(force.value),7);
});
test('locale changes preserve mapping and firmware choices and update an already open update dialog',async()=>{
 const u=ui();await u.el('connect').onclick();
 const doc=u.window.document,nav=page=>doc.querySelector(`.nav [data-page="${page}"]`).onclick();
 const lang=u.el('lang'),switchTo=code=>{lang.value=code;lang.onchange();assert.equal(doc.documentElement.lang,code)};
 nav('remap');const source=u.el('mapping-source');source.value='6';source.onchange();
 const locales=[...lang.options].map(option=>option.value);
 for(const code of locales){switchTo(code);assert.equal(u.el('mapping-source').value,'6')}
 switchTo('en');
 assert.match(u.el('mapping-state').textContent,/Editing group 1/);
 nav('flash');
 const board=u.el('fw-board');board.value='v12';board.onchange();
 doc.querySelector('.fw-open').onclick();
 assert.equal(u.el('fw-dialog-title').textContent,'Update dongle firmware');
 switchTo('zh-TW');
 assert.equal(u.el('fw-dialog-title').textContent,'更新接收器韌體');
 switchTo('zh-CN');
 assert.equal(u.el('fw-dialog-title').textContent,'更新接收器固件');
 assert.equal(u.el('fw-board').value,'v12');
 switchTo('en');
 const catNotes=JSON.parse(readFileSync(new URL('../firmware/v1/index.json',import.meta.url),'utf8')).versions[0].notes;
 if(catNotes)assert.ok(u.el('controls').textContent.includes(catNotes),'发布说明应显示在固件页');
 assert.equal(u.el('fw-board').value,'v12');
 doc.querySelector('.fw-close').onclick();
 assert.equal(u.sent.some(([id])=>id===246),false);
});
test('config: packed offsets, LE float, preserve runtime fields and reject corruption before write',()=>{const b=bytes();const v=view(247,b);const p=patch(v,{haptics_gain:1.7,tp_block_raw:1,combo_window:50});assert.equal(p[20],1);assert.equal(p[31],1);assert.equal(p[30],50);assert.equal(decode(view(247,p)).haptics_gain,Math.fround(1.7));for(let i=5;i<30;i++)assert.equal(p[i],b[i]);assert.throws(()=>patch(v,{speaker_volume:128}));assert.throws(()=>patch(v,{combo_window:NaN}));assert.throws(()=>patch(v,{controller_mode:1.2}));assert.throws(()=>decode(view(247,[7,...b.slice(1)])));assert.throws(()=>decode(view(247,b.slice(0,31))));assert.throws(()=>decode(view(246,b)));assert.throws(()=>patch(v,{dse_detected:0}));assert.equal(command(1,p).length,63)});
test('remap: complete two-group format and invalid reply checks',()=>{const table=Uint8Array.from({length:124},(_,i)=>i%4===1?Math.floor(i/4):0);const r=remapRead(view(251,[1,0,...table]),0);assert.equal(r.active,1);assert.deepEqual(r.table,table);assert.deepEqual(remapWrite(1,table).slice(0,6),Uint8Array.of(1,1,0,0,0,0));assert.throws(()=>remapRead(view(251,[1,1,...table]),0));table[0]=3;assert.throws(()=>remapWrite(0,table))});
test('input: diagonals, digital buttons and trigger channels follow firmware payload',()=>{const b=new Uint8Array(63);b.set([0,255,127,128,64,255]);b[7]=0x21;b[8]=0x21;const i=inputParts(b);for(const k of ['dpad-up','dpad-right','cross','l1','options'])assert(i.parts.has(k));assert.deepEqual(i.axes,[0,255,127,128]);assert.deepEqual(i.triggers,[64,255]);assert.equal(inputParts(new Uint8Array(9)),null)});
function ui({version=6,corrupt=false,production=false,auto=false,noHid=false,storage=new Map()}={}){
 let telemetry=new Uint8Array(13);telemetry[11]=255;const timers=[];let telemetryFails=false,now=1000,gamepads=[];
 const html=readFileSync(new URL(production?'../auth-preview.html':'../index.html',import.meta.url),'utf8');const {window}=parseHTML(html);
 // linkedom omits native browser form value/validity setters.
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value??this.options[0]?.value??''},set(v){for(const o of this.options)o.toggleAttribute('selected',String(o.value)===String(v))}});
 window.HTMLInputElement.prototype.setCustomValidity=function(s){this.validationMessage=s};window.HTMLInputElement.prototype.checkValidity=function(){return !this.validationMessage};
 let cfg=bytes();cfg[0]=version;let selected=0;const tables=[0,1].map(()=>Uint8Array.from({length:124},(_,i)=>i%4===1?Math.floor(i/4):0));const sent=[],listeners={};
 const device={vendorId:1356,productId:3302,opened:false,collections:[{featureReports:[{reportId:247}]}],async open(){this.opened=true},async close(){this.opened=false},addEventListener(n,f){listeners[n]=f},removeEventListener(n){delete listeners[n]},async receiveFeatureReport(id){if(id===248)return view(id,new TextEncoder().encode('LCT616-DS5 3.18-oc2'));if(id===247)return view(id,cfg);if(id===251)return view(id,[0,selected,...tables[selected]]);if(id===249){if(telemetryFails)throw Error('telemetry failed');return view(id,telemetry)}throw Error('unexpected read')},async sendFeatureReport(id,p){sent.push([id,p.slice()]);if(id===246&&p[0]===1){cfg=p.slice(1,33);if(corrupt)cfg[31]=0}if(id===251&&p[0]===3)selected=p[1];if(id===251&&p[0]===1)tables[p[1]]=p.slice(2,126)}};
 const outputs=[];device.sendReport=async(id,p)=>{outputs.push([id,p.slice()])};
 const navigator=noHid?{getGamepads(){return gamepads}}:{hid:{async requestDevice(){return [device]},async getDevices(){return auto?[device]:[]},addEventListener(n,f){listeners[n]=f}},getGamepads(){return gamepads}};
 const ctx={__DS5_LANG:'zh-CN',atob,Blob,URL,isSecureContext:true,Date:class extends Date{static now(){return now}},document:window.document,navigator,localStorage:{getItem(k){return k==='ds5.lang'?'zh-CN':storage.get(k)??null},setItem(k,v){storage.set(k,v)}},setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout(t){if(t)t.cancelled=true},clearInterval(){},setInterval(fn,ms){timers.push({fn,ms})},confirm:()=>true,TextDecoder,Uint8Array,DataView,TextEncoder,Event:window.Event,console};vm.runInNewContext(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1],ctx);
 ctx.crypto=webcrypto;ctx.location={protocol:'file:'};
 const el=id=>window.document.getElementById(id);return {el,window,device,sent,outputs,pending(ms){return timers.some(t=>t.ms===ms&&!t.cancelled&&!t.fired)},expire(ms=5000){const t=timers.find(t=>t.ms===ms&&!t.cancelled&&!t.fired);if(!t)throw Error("No pending timeout");t.fired=true;t.fn()},
 input(axes,buttons=0,extraButtons=0,extra={}){now+=50;const b=new Uint8Array(63);b.set(axes);b[7]=(extra.faces??0)|8;b[8]=buttons;b[9]=extraButtons;if(extra.triggers){b[4]=extra.triggers[0];b[5]=extra.triggers[1]}listeners.inputreport({device,reportId:1,data:new DataView(b.buffer)})},
 setPads(pads){gamepads=pads},async tick(ms=50){now+=ms;await timers.find(t=>t.ms===50).fn()},setBattery(pct,state){telemetry[11]=pct;telemetry[12]=state},setLink(state,bonds=1){const b=new Uint8Array(17);b.set(telemetry.slice(0,13));b[13]=0xd3;b[14]=state;b[15]=bonds;telemetry=b},failTelemetry(){telemetryFails=true},setLatency(age=1000,count=50){const b=new Uint8Array(51);b.set(telemetry.slice(0,13));b[13]=0xd3;b[14]=7;b[17]=0x4c;b[18]=1;const v=new DataView(b.buffer);[count,1200,1100,500,2000,age,400,800].forEach((n,i)=>v.setUint32(19+i*4,n,true));telemetry=b},async poll(){await timers.find(t=>t.ms===2000).fn()},disconnect:()=>listeners.disconnect({device}),cfg:()=>cfg};
}
test('UI: connect, stage only, rebase config, verify then save, disconnect cleanup',async()=>{const u=ui();await u.el('connect').onclick();assert.equal(u.el('connection').textContent,'接收器已连接');u.window.document.querySelector('[data-page="touch"]').onclick();const c=u.window.document.querySelector('#controls input[type="checkbox"]');c.checked=true;c.onchange();assert.equal(u.sent.filter(([id])=>id===246).length,0);u.cfg()[6]=42;await u.el('save').onclick();const writes=u.sent.filter(([id])=>id===246);assert.deepEqual(writes.map(([,p])=>p[0]),[1,2]);assert.equal(u.cfg()[6],42);assert.equal(u.cfg()[31],1);assert.equal(u.el('save').disabled,true);u.disconnect();assert.equal(u.el('connection').textContent,'尚未连接接收器');assert.equal(u.el('save').disabled,true)});
test('UI: wrong config version never enables writes',async()=>{const u=ui({version:17});await u.el('connect').onclick();assert.match(u.el('message').textContent,/不兼容/);assert.equal(u.el('save').disabled,true);assert.equal(u.sent.length,0)});
test('restart UI waits for controller release and only then requests reset',async()=>{
 const u=ui();await u.el('connect').onclick();let state=7,flags=0x81;const read=u.device.receiveFeatureReport.bind(u.device),send=u.device.sendFeatureReport.bind(u.device);
 u.device.receiveFeatureReport=async id=>{if(id!==249)return read(id);const b=new Uint8Array(17);b[13]=0xd3;b[14]=state;b[16]=flags;return view(id,b)};
 u.device.sendFeatureReport=async(id,p)=>{await send(id,p);if(id===246&&p[0]===4){state=0;flags=0xc0}};
 await u.el('reboot').onclick();assert.deepEqual(u.sent.filter(([id])=>id===246).map(([,p])=>p[0]),[4,3]);assert.equal(u.el('connection').textContent,'尚未连接接收器');assert.match(u.el('message').textContent,/确认手柄断开/);
});

test('saving color sends a persistent output when linked and reports output failure separately',async()=>{
 const u=ui();await u.el('connect').onclick();u.setLink(7);await u.poll();
 u.window.document.querySelector('.nav [data-page="vision"]').onclick();
 const pick=hex=>{const input=u.el('vision-color');input.value=hex;input.oninput()};
 pick('#a03080');await u.el('test-save-color').onclick();
 assert.deepEqual([...u.outputs.at(-1)[1].slice(44,47)],[160,48,128]);
 assert.match(u.el('test-color-status').textContent,/即时换色指令/);
 assert.equal(u.pending(5000),false);
 u.device.sendReport=async()=>{throw Error('output failed')};
 pick('#104090');await u.el('test-save-color').onclick();
 assert.match(u.el('test-color-status').textContent,/已请求保存.*即时换色指令未送达/);
 assert.equal(u.el('test-saved-color').textContent,'#104090');
 assert.equal(u.el('test-save-color').disabled,true);
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
 u.window.document.querySelector('.nav [data-page="feel"]').onclick();assert.equal(triangle.classList.contains('mapping-source'),false);
});

test('trigger diagram explains its action, selects the matching side, and never starts a test',async()=>{
 const u=ui();await u.el('connect').onclick();u.setLink(7);await u.poll();
 const art=u.el('art'),left=art.querySelector('[data-part="l2"]'),right=art.querySelector('[data-part="r2"]');
 assert.match(u.el('art-trigger-hint').textContent,/打开对应扳机设置/);
 assert.match(right.getAttribute('aria-label'),/R2.*设置/);
 u.window.document.querySelector('.nav [data-page="vision"]').onclick();
 art.onclick({target:right});
 assert.equal(u.window.document.body.dataset.page,'feel');
 assert.equal(u.el('trigger-side').value,'right');
 assert.match(u.el('trigger-selection').textContent,/已选 R2/);
 assert.equal(u.el('test-trigger').closest('.test-card').classList.contains('trigger-target'),true);
 art.onkeydown({target:left,key:'Enter',preventDefault(){}});
 assert.equal(u.el('trigger-side').value,'left');
 u.window.document.querySelector('.nav [data-page="remap"]').onclick();
 assert.match(u.el('art-trigger-hint').textContent,/映射来源/);
 art.onclick({target:right});
 assert.equal(u.window.document.body.dataset.page,'remap');
 assert.equal(u.el('mapping-source').value,'7');
 assert.equal(u.outputs.length,0);
});
test('mapping controls remain enabled after each source selection; stalled group reads unlock on timeout',async()=>{
 const u=ui();await u.el('connect').onclick();u.window.document.querySelector('[data-page="remap"]').onclick();
 for(let i=0;i<31;i++){u.el('mapping-source').value=i;u.el('mapping-source').onchange();for(const c of u.window.document.querySelectorAll('#controls input,#controls select,#controls button'))assert.equal(c.disabled,false,`source ${i}: ${c.tagName}`)}
 const read=u.device.receiveFeatureReport;u.device.receiveFeatureReport=id=>id===251?new Promise(()=>{}):read.call(u.device,id);const group=u.window.document.querySelector('#controls select');group.value=1;group.onchange();for(let i=0;i<15;i++)await Promise.resolve();assert.equal(u.el('mapping-source').disabled,true);u.expire();for(let i=0;i<20;i++)await Promise.resolve();assert.equal(u.el('mapping-source').disabled,false);assert.equal(group.value,'0');assert.match(u.el('message').textContent,/读取按键映射超时/);
});
test('firmware update requires explicit board for unknown devices and verifies each embedded image offline',async()=>{
 const u=ui(),doc=u.window.document;await u.el('connect').onclick();assert.equal(u.el('firmware-notice').hidden,true);doc.querySelector('[data-page="flash"]').onclick();assert.match(u.el('controls').textContent,/LCT616-DS5 3.18-oc2/);
 assert.equal(doc.querySelector('.fw-open').disabled,true);
 assert.doesNotMatch(u.el('controls').textContent,/3.18H-oc8/);
 for(const board of ['v1','v12']){
  u.el('fw-board').value=board;u.el('fw-board').onchange();
  doc.querySelector('.fw-open').onclick();
  for(let attempt=0;attempt<50&&doc.querySelector('.fw-start').disabled;attempt++)await new Promise(r=>setTimeout(r,10));
  // 瘦身构建不内嵌镜像，此时只能通过 HTTP 取件：断言给出明确提示而不是静默失败
  const stage=doc.querySelector('.fw-stage').textContent;
  if(/没有内嵌/.test(stage)){assert.ok(true,'slim build: firmware must be served over HTTP');}
  else{assert.equal(doc.querySelector('.fw-start').disabled,false,stage);}
  assert.match(doc.querySelector('.fw-version').textContent,new RegExp('-'+board+'$'));
  doc.querySelector('.fw-close').onclick();
 }
 u.disconnect();assert.match(u.el('controls').textContent,/尚未连接/);
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
 const u=ui();await u.el('connect').onclick();u.window.document.querySelector('.nav [data-page="feel"]').onclick();assert.equal(u.el('panel-title').textContent,'手感');
 await u.el('test-rumble').onclick();assert.match(u.el('message').textContent,/先连接手柄/);assert.equal(u.outputs.length,0);
 u.setLink(7);await u.poll();u.el('rumble-left').value=50;u.el('rumble-right').value=0;await u.el('test-rumble').onclick();assert.equal(u.outputs.at(-1)[1][3],50);
 u.window.document.querySelector('[data-page="audio"]').onclick();for(let i=0;i<20;i++)await Promise.resolve();assert.equal(u.outputs.at(-1)[1][3],0);assert.equal(u.sent.filter(([id])=>id===246).length,0);
});
test('test center: stop works offline and missing media API provides a readable message',async()=>{
 const u=ui();assert.equal(u.el('test-rumble').disabled,true);u.window.document.querySelector('[data-page="audio"]').onclick();assert.equal(u.el('test-stop').hidden,true);assert.equal(u.el('test-tone').disabled,false);await u.el('test-tone').onclick();assert.match(u.el('message').textContent,/不支持音频测试/);assert.equal(u.el('test-stop').hidden,true);assert.equal(u.outputs.length,0);
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
 slider.value=85;slider.oninput();assert.equal(Number(number.value),85);assert.equal(u.el('dirty').textContent,'本页有 1 项未应用');
 number.value=86;number.oninput();assert.equal(Number(slider.value),86);
 number.value='86.5';number.oninput();await u.el('save').onclick();assert.match(u.el('message').textContent,/无效/);assert.equal(u.sent.filter(([id])=>id===246).length,0);
 u.el('revert').onclick();assert.equal(u.el('save').disabled,true);assert.equal(u.el('dirty').textContent,'本页没有未应用的更改');assert.equal(u.sent.filter(([id])=>id===246).length,0);
});
test('savebar: color is one change, mapping undo restores baseline, restart requirement survives reread and undo',async()=>{
 const u=ui();await u.el('connect').onclick();
 const color=u.window.document.getElementById('qa-color');color.value='#66c7ff';color.oninput();assert.match(u.el('dirty').textContent,/其他页有 1 项/);assert.equal(u.el('revert').disabled,true);
 u.window.document.querySelector('.nav [data-page="device"]').onclick();u.el('revert').onclick();
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

test('Edge artwork reports stick travel and button presses',async()=>{
 const u=ui(),art=u.el('art');
 u.device.productId=0x0df2;await u.el('connect').onclick();
 const stick=part=>art.querySelector('[data-part="'+part+'"]');
 const left=stick('stick-l'),right=stick('stick-r');
 const leftBase=left.getAttribute('transform'),rightBase=right.getAttribute('transform');
 u.input([0,0,255,255],0xc0,1);
 assert.ok(left.classList.contains('pressed')&&right.classList.contains('pressed'));
 assert.ok(stick('ps').classList.contains('pressed'));
 assert.notEqual(left.getAttribute('transform'),leftBase);
 assert.notEqual(right.getAttribute('transform'),rightBase);
 u.input([128,128,128,128]);
 assert.equal(stick('ps').classList.contains('pressed'),false);
 assert.equal(left.classList.contains('pressed'),false);
 await u.tick(3100);assert.equal(left.getAttribute('transform'),leftBase);assert.equal(right.getAttribute('transform'),rightBase);
});

test('Edge physical extras remain visible when their game output is remapped',()=>{
 const p=new Uint8Array(63);p[7]=0x28;p[8]=0x40;p[9]=1;p[11]=0xe8;p[12]=5;
 assert.deepEqual([...inputParts(p,true,true).parts],['cross','stick-l','ps','fn-l','paddle-l']);
 p[7]=8;p[8]=0;p[9]=0;p[12]=0;
 assert.deepEqual([...inputParts(p,true,true).parts],[]);
 p[9]=0x80;
 assert.deepEqual([...inputParts(p,true).parts],['paddle-r']);
 assert.deepEqual([...inputParts(p).parts],[]);
});

test('Edge paddle click opens its target on the mapping page and saves it to config v16',async()=>{
 const u=ui({version:16});
 u.device.productId=0x0df2;
 const read=u.device.receiveFeatureReport.bind(u.device);
 u.device.receiveFeatureReport=id=>{
  if(id!==0xf7)return read(id);
  const body=new Uint8Array(60);body.set(u.cfg());
  return Promise.resolve(view(id,body));
 };
 const send=u.device.sendFeatureReport.bind(u.device);
 let paddleTarget=0;
 u.device.sendFeatureReport=async(id,p)=>{await send(id,p);if(id===0xf6&&p[0]===1)paddleTarget=p[59]};
 const readConfig=u.device.receiveFeatureReport;
 u.device.receiveFeatureReport=async id=>{
  const result=await readConfig(id);
  if(id===0xf7)result.setUint8(59,paddleTarget);
  return result;
 };
 await u.el('connect').onclick();
 const art=u.el('art'),left=art.querySelector('[data-part="paddle-l"]');
 art.onclick({target:left});
 assert.equal(u.el('mapping-source').value,'31');
 assert.ok(left.classList.contains('mapping-source'));
 const target=u.el('edge-map-target');
 target.value='3';target.onchange();
 assert.equal(u.el('save').disabled,false);
 await u.el('save').onclick();
 assert.equal(paddleTarget,3);
 assert.ok(!u.sent.some(([id,p])=>id===0xfb&&p[0]===1));
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
 assert.equal(u.el('verdict-title').textContent,'手柄状态未确认');
 u.setLink(0,1);await u.poll();
 assert.equal(u.el('verdict-title').textContent,'等待已配对手柄重连');

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
  assert.equal(u.el(id).textContent,{ 'qa-rumble':'试震动','qa-trigger':'试左右扳机','qa-lights':'测试手柄灯光' }[id]);
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
 assert.equal(u.outputs.at(-1)[1][3],Number(u.el('rumble-left').value));
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
 assert.equal(u.pending(2300),true);
 u.window.document.querySelector('.nav [data-page="vision"]').onclick();
 assert.equal(u.pending(2300),false,'leaving test cancels the second trigger');
});

test('both light tests use the connection color draft and leave other indicators alone',async()=>{
 const u=ui();await u.el('connect').onclick();u.setLink(7);await u.poll();
 const color=u.el('qa-color');color.value='#19650c';color.oninput();
 await u.el('qa-lights').onclick();
 assert.equal(u.el('test-color').textContent,'#19650C');
 assert.equal(u.outputs.at(-1)[1][1],4);
 assert.deepEqual([...u.outputs.at(-1)[1].slice(44,47)],[25,101,12]);
 await u.el('test-stop').onclick();
 assert.equal(u.outputs.at(-1)[1][1],4);
 assert.deepEqual([...u.outputs.at(-1)[1].slice(44,47)],[255,255,255]);
 const count=u.outputs.length;
 await u.el('test-stop').onclick();assert.equal(u.outputs.length,count);
 color.value='#000000';color.oninput();
 assert.equal(color.value,'#19650c');assert.match(u.el('message').textContent,/不能保存纯黑/);
 color.value='#a03080';color.oninput();u.expire(60);await new Promise(r=>setImmediate(r));
 assert.deepEqual([...u.outputs.at(-1)[1].slice(44,47)],[160,48,128]);
 assert.equal(u.sent.some(([id])=>id===246),false);
});

test('dragging the color picker previews only the latest color and stop cancels pending updates',async()=>{
 const u=ui();await u.el('connect').onclick();u.setLink(7);await u.poll();
 u.window.document.querySelector('[data-page="vision"]').onclick();
 assert.equal(u.el('test-save-color').classList.contains('primary'),true);
 const change=hex=>{u.el('qa-color').value=hex;u.el('qa-color').oninput()};
 change('#19650c');change('#24be19');
 assert.equal(u.el('test-color').textContent,'#24BE19');
 assert.equal(u.outputs.length,0);
 u.expire(60);await new Promise(r=>setImmediate(r));
 assert.deepEqual(u.outputs.map(([,b])=>[...b.slice(44,47)]),[[36,190,25]]);
 change('#bb2200');u.expire(60);await new Promise(r=>setImmediate(r));
 assert.deepEqual(u.outputs.map(([,b])=>[...b.slice(44,47)]),[[36,190,25],[187,34,0]]);
 change('#443300');await u.el('test-stop').onclick();
 assert.equal(u.pending(60),false);
 assert.deepEqual([...u.outputs.at(-1)[1].slice(44,47)],[255,255,255]);
 assert.equal(u.sent.some(([id])=>id===246),false);
});

test('save connection color only, preserve other edits, retry unsuccessful Flash write',async()=>{
 const u=ui(),read=u.device.receiveFeatureReport;let result=3;
 u.device.receiveFeatureReport=function(id){if(id!==249)return read.call(this,id);const report=new Uint8Array(17);report[13]=0xd3;report[16]=2|(result<<2);return Promise.resolve(view(id,report))};
 await u.el('connect').onclick();
 u.window.document.querySelector('[data-page="touch"]').onclick();
 const checkbox=u.window.document.querySelector('#controls input[type="checkbox"]');checkbox.checked=true;checkbox.onchange();
 u.window.document.querySelector('[data-page="vision"]').onclick();
 assert.equal(u.el('test-save-color').disabled,true);
 u.el('qa-color').value='#24be19';u.el('qa-color').oninput();
 await u.el('test-save-color').onclick();
 assert.match(u.el('test-color-status').textContent,/未确认保存/);
 assert.equal(u.el('test-save-color').disabled,false);
 assert.equal(u.el('test-saved-color').textContent,'#FFFFFF');
 result=2;await u.el('test-save-color').onclick();
 assert.match(u.el('test-color-status').textContent,/已保存.*下次连接/);
 assert.equal(u.el('test-saved-color').textContent,'#24BE19');
 assert.equal(u.el('test-save-color').disabled,true);
 assert.equal(u.cfg()[31],0);
 assert.match(u.el('dirty').textContent,/1 项未应用/);
});

test('another test replaces the two-trigger sequence instead of allowing its delayed right trigger',async()=>{
 const u=ui();await u.el('connect').onclick();u.setLink(7);await u.poll();
 await u.el('qa-trigger').onclick();assert.equal(u.pending(2300),true);
 assert.equal(u.el('test-stop').hidden,true);
 await u.el('qa-lights').onclick();assert.equal(u.pending(2300),false);
 assert.equal(u.outputs.at(-1)[1][1],4);
});

test('saving after a Flash error retains the edit for retry and only confirms a successful write',async()=>{
 const u=ui(),read=u.device.receiveFeatureReport;let status=3;
 u.device.receiveFeatureReport=function(id){if(id!==249)return read.call(this,id);const report=new Uint8Array(17);report[13]=0xd3;report[16]=2|(status<<2);return Promise.resolve(view(id,report))};
 await u.el('connect').onclick();
 u.window.document.querySelector('[data-page="touch"]').onclick();
 const checkbox=u.window.document.querySelector('#controls input[type="checkbox"]');checkbox.checked=true;checkbox.onchange();
 await u.el('save').onclick();
 assert.match(u.el('message').textContent,/Flash 写入失败/);assert.equal(u.el('save').disabled,false);
 status=2;await u.el('save').onclick();
 assert.match(u.el('message').textContent,/已保存到接收器/);assert.equal(u.el('save').disabled,true);
});

test('mapping read failure leaves basic settings available and can be retried',async()=>{
 const u=ui(),read=u.device.receiveFeatureReport;
 u.device.receiveFeatureReport=function(id){if(id===251)return Promise.reject(Error('Failed to receive the feature report.'));return read.call(this,id)};
 await u.el('connect').onclick();
 assert.equal(u.el('connection').textContent,'接收器已连接');
 u.window.document.querySelector('[data-page="remap"]').onclick();
 assert.match(u.el('mapping-state').textContent,/暂不可用/);assert.equal(u.el('mapping-source').disabled,true);
 u.device.receiveFeatureReport=read;await u.el('reload').onclick();
 assert.equal(u.el('mapping-source').disabled,false);
});

test('reconnecting the same receiver in this tab restores an unsaved configuration draft',async()=>{
 const u=ui();
 await u.el('connect').onclick();
 u.window.document.querySelector('[data-page="touch"]').onclick();
 const checkbox=()=>u.window.document.querySelector('#controls input[type="checkbox"]');
 checkbox().checked=true;checkbox().onchange();
 u.disconnect();await u.el('connect').onclick();
 assert.equal(checkbox().checked,true);
 assert.equal(u.el('save').disabled,false);
 assert.equal(u.cfg()[31],0);
});

test('diagnostics show latency and do not report legacy USB rate as measured',async()=>{
 const u=ui();await u.el('connect').onclick();
 u.window.document.querySelector('[data-page="device"]').onclick();
 u.setLatency();await u.poll();
 assert.equal(u.el('latency-last').textContent,'1.200 ms');
 assert.match(u.el('link-status').textContent,/未知/);
 assert.doesNotMatch(u.el('link-status').textContent,/dBm/);
});

test('quick actions: each test opens its own settings block',async()=>{
 const u=ui();
 await u.poll();
 await u.el('connect').onclick();
 u.setLink(7,1);
 await u.poll();

 assert.equal(u.window.document.querySelector('.nav [data-page="test"]'),null);
 await u.el('qa-rumble').onclick();
 assert.equal(u.window.document.body.dataset.page,'feel','rumble test opens Feel');
 assert.ok(u.window.document.getElementById('test-rumble'),'rumble controls exist');

 await u.window.document.querySelector('.nav [data-page="audio"]').onclick();
 assert.equal(u.window.document.body.dataset.page,'audio');
 assert.ok(u.el('test-tone'));
 await u.el('qa-trigger').onclick();
 assert.equal(u.window.document.body.dataset.page,'feel','trigger test opens Feel');
 assert.ok(u.window.document.getElementById('test-trigger'));

 await u.el('qa-lights').onclick();
 assert.equal(u.window.document.body.dataset.page,'vision');
 assert.ok(u.window.document.getElementById('vision-color'));
 u.window.document.querySelector('.nav [data-page="motion"]').onclick();
 assert.ok(u.el('gyro-readout'));
 assert.equal(u.el('vision-color'),null);
});

test('stick deadzones require v7, preserve gyro config and save independent settings',async()=>{
 const old=ui();await old.el('connect').onclick();old.window.document.querySelector('.nav [data-page="sticks"]').onclick();
 assert.match(old.el('controls').textContent,/不支持摇杆死区/);
 assert.equal(old.window.document.querySelector('[data-field="stick_left_inner"]'),null);
 const u=ui(),receive=u.device.receiveFeatureReport,send=u.device.sendFeatureReport;
 let cfg=new Uint8Array(40);cfg.set(u.cfg());cfg[0]=7;cfg.set([1,15,5,0],32);
 u.device.receiveFeatureReport=function(id){return id===247?Promise.resolve(view(id,cfg)):receive.call(this,id)};
 u.device.sendFeatureReport=function(id,p){if(id===246&&p[0]===1)cfg=p.slice(1,41);return send.call(this,id,p)};
 await u.el('connect').onclick();
 u.window.document.querySelector('.nav [data-page="touch"]').onclick();
 const touch=u.window.document.querySelector('#controls input[type="checkbox"]');touch.checked=true;touch.onchange();
 u.window.document.querySelector('.nav [data-page="sticks"]').onclick();
 const slider=u.window.document.querySelector('input[type="range"][data-field="stick_right_inner"]');
 slider.value=12;slider.oninput();await u.el('save').onclick();
 assert.deepEqual([...cfg.slice(32)],[1,15,5,0,0,0,12,0]);
 assert.equal(cfg[31],0);
 assert.match(u.el('dirty').textContent,/其他页有 1 项/);
 assert.equal(u.el('save').disabled,true);
 assert.throws(()=>decode(view(247,cfg.slice(0,39))),/不完整/);
});

test('saving Feel commits both resistance and browser test parameters to their respective destinations',async()=>{
 const u=ui();await u.el('connect').onclick();
 const trigger=u.el('test-trigger').closest('.test-card');
 const slider=trigger.querySelector('input[type="range"][data-field="trigger_reduce"]');
 const force=u.el('trigger-force');force.value=6;force.oninput();
 assert.equal(u.el('save').disabled,false);
 slider.value=4;slider.oninput();
 assert.equal(u.el('save').disabled,false);
 await u.el('save').onclick();
 assert.equal(u.cfg()[18],4);
 assert.match(u.el('message').textContent,/已应用并请求保存.*测试参数已保存到此浏览器/);
 assert.equal(u.el('save').disabled,true);
 assert.equal(u.outputs.length,0);
});

test('Save this page remembers trigger test parameters without connecting to the receiver',async()=>{
 const storage=new Map(),u=ui({storage});
 u.el('trigger-mode').value='weapon';u.el('trigger-mode').onchange();
 u.el('trigger-force').value=7;u.el('trigger-force').oninput();
 u.el('trigger-start').value=5;u.el('trigger-start').oninput();
 assert.match(u.el('trigger-preset-status').textContent,/保存本页设置/);
 assert.equal(u.el('save').disabled,false);
 await u.el('save').onclick();
 assert.match(u.el('message').textContent,/已保存到此浏览器/);
 assert.equal(u.sent.length,0);
 const next=ui({storage});
 assert.equal(next.el('trigger-mode').value,'weapon');
 assert.equal(Number(next.el('trigger-force').value),7);
 assert.equal(Number(next.el('trigger-start').value),5);
});

test('plan A: lightbar colour lives on the home row, receiver LED toggle lives in the Dongle tab',async()=>{
 const u=ui();
 await u.poll();
 // 未连接时颜色控件隐藏，连接后出现
 assert.equal(u.window.document.getElementById('qa-color-wrap').hidden,true);
 await u.el('connect').onclick();
 await u.poll();
 assert.equal(u.window.document.getElementById('qa-color-wrap').hidden,false);

 // 颜色不再出现在「手感」页
 await u.window.document.querySelector('.nav [data-page="feel"]').onclick();
 assert.equal(u.window.document.querySelector('#controls input[type="color"]'),null,'colour left the Feel tab');
 assert.equal(u.window.document.querySelector('#controls input[type="checkbox"][id*="disable_led"]'),null,'LED toggle left the Feel tab');
 const feelLabels=[...u.window.document.querySelectorAll('#controls .row')].map(l=>l.textContent).join('|');
 assert.match(feelLabels,/触觉增益/);assert.match(feelLabels,/扳机阻力减弱/);

 // 熄灯开关出现在接收器页
 await u.window.document.querySelector('.nav [data-page="device"]').onclick();
 const devLabels=[...u.window.document.querySelectorAll('#controls .row')].map(l=>l.textContent).join('|');
 assert.match(devLabels,/接收器一分钟后熄灯/);
});

test('diagnostics decode 0xFA one byte before the firmware offset (off-by-one regression)',async()=>{
 const u=ui();await u.el('connect').onclick();
 u.window.document.querySelector('[data-page="device"]').onclick();
 const read=u.device.receiveFeatureReport.bind(u.device);
 u.device.receiveFeatureReport=async id=>{
  if(id!==0xfa)return read(id);
  /* 62 payload bytes: payload() already dropped the report ID, so index = firmware offset - 1 */
  const b=new Uint8Array(62);
  b[0]=0x05;                                  /* flags: edge + linked          */
  b[1]=7;                                      /* state                        */
  b[2]=0x22;                                   /* handshake id                 */
  b[3]=2;b[4]=0;                               /* bonded / blacklist           */
  b.set([0xd0,0xbc,0xc1,0x9c,0x74,0x5a],5);    /* address                      */
  b[11]=3;b[12]=0;                             /* scan rounds                  */
  b[13]=1;b[14]=0;                             /* connect failures             */
  b[15]=0;b[16]=0;                             /* handshake failures           */
  b[17]=445&0xff;b[18]=445>>8;                 /* avg  44.5 ms                 */
  b[19]=520&0xff;b[20]=520>>8;                 /* max  52.0 ms                 */
  b[21]=0;b[22]=0;                             /* overruns                     */
  b[23]=460&0xff;b[24]=460>>8;                 /* fill                         */
  b.set(new TextEncoder().encode('DualSense'),25);
  b[57]=2;                                     /* board v1.2                   */
  b[58]=1;                                     /* USB High-Speed               */
  b[59]=1;                                     /* RSSI unknown                 */
  b[60]=1;                                     /* have_scan                    */
  b[61]=1;                                     /* link quality: good           */
  return view(0xfa,b);
 };
 u.setLink(7,2);
 await u.poll();await u.poll();
 await new Promise(r=>setImmediate(r));

 const text=u.el('diag-text')?.textContent||'';
 assert.match(text,/v1\.2/,'board must read v1.2, not the USB byte');
 assert.match(text,/High-Speed/,'usb speed must read High-Speed');
 assert.match(text,/D0:BC:C1:9C:74:5A/i,'address keeps the right bytes');
 assert.match(text,/44\.5/,'average encode time');
 assert.match(text,/52\.0/,'max encode time');
 assert.match(text,/链路良好/,'link quality comes from byte 61');
 const bars=u.el('link-status').querySelectorAll('.sig-bars i.on').length;
 assert.equal(bars,4,'four bars for good link quality');
});

test('telemetry 0xF9 drives link status, bonds and USB speed',async()=>{
 const u=ui();await u.el('connect').onclick();
 const read=u.device.receiveFeatureReport.bind(u.device);
 u.device.receiveFeatureReport=async id=>{
  if(id!==0xf9)return read(id);
  const b=new Uint8Array(63);
  b[0]=0xc4;                                  /* rssi -60 */
  b[1]=0x40;                                  /* USB High-Speed flag */
  b[13]=0xd3;b[14]=7;                         /* connected marker */
  b[15]=2;                                    /* two bonded controllers */
  b[16]=0x02;                                 /* link info valid */
  return view(0xf9,b);
 };
 await u.poll();
 const text=u.el('link-status').textContent;
 assert.match(text,/2/,'bonded count comes from byte 15');
 assert.match(text,/HS/,'USB speed flag comes from byte 1 bit 6');
});

test('remap 0xFB accepts all eight profiles and rejects nine',()=>{
 const table=Uint8Array.from({length:124},(_,i)=>i%4===1?Math.floor(i/4)%31:0);
 for(let p=0;p<8;p++){
  const r=remapRead(view(251,[p,p,...table]),p);
  assert.equal(r.active,p);
  assert.equal(r.table.length,124);
  const cmd=remapWrite(p,table);
  assert.equal(cmd[0],1,'write command id');
  assert.equal(cmd[1],p,'profile byte');
 }
 assert.throws(()=>remapRead(view(251,[8,8,...table]),8),/映射组回读不匹配/);
 assert.throws(()=>remapWrite(8,table),/映射格式错误/);
});

/* ---- Edge 页面反馈：扳机行程推测、按下高亮、样式契约 ---- */

test('trigger stop card estimates the level from the trigger maximum',async()=>{
 const u=ui();
 await u.el('connect').onclick();
 await u.poll();
 u.window.document.querySelector('.nav [data-page="feel"]').onclick();
 const row=side=>u.window.document.querySelector(`#trigger-stop [data-side="${side}"]`);
 assert.match(row('L2').textContent,/未测/);
 u.input([128,128,128,128],0,0,{triggers:[255,0]});
 u.input([128,128,128,128]);
 assert.match(row('L2').textContent,/长行程/);
 assert.match(row('L2').textContent,/255/);
 u.input([128,128,128,128],0,0,{triggers:[210,0]});
 u.input([128,128,128,128]);
 assert.match(row('L2').textContent,/中档/);
 u.input([128,128,128,128],0,0,{triggers:[160,0]});
 u.input([128,128,128,128]);
 assert.match(row('L2').textContent,/短行程/);
 const reset=u.window.document.querySelector('#trigger-stop-card button');
 reset.onclick();
 assert.match(row('L2').textContent,/未测/);
});

test('Edge artwork highlights pressed trigger and face button like the standard pad',async()=>{
 const u=ui();
 u.device.productId=0x0df2;
 await u.el('connect').onclick();
 await u.poll();
 const art=u.el('art');
 const part=p=>art.querySelector(`[data-part="${p}"]`);
 u.input([128,128,128,128],0x04,0,{faces:0x20,triggers:[200,0]});
 assert.ok(part('l2').classList.contains('pressed'),'L2 should be pressed');
 assert.ok(part('cross').classList.contains('pressed'),'cross should be pressed');
 assert.equal(part('r2').classList.contains('pressed'),false);
 u.input([128,128,128,128]);
 assert.equal(part('l2').classList.contains('pressed'),false);
});

test('Edge press styling matches the standard pad rule for rule',async()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

 // 1) 普通手柄：按下时 cap/stk 变紫、ln 变白（这是"紫色填充"的来源）
 assert.match(html,/\.art \[data-part\]\.pressed \.cap[^{]*\{[^}]*fill:var\(--violet-feedback\)/i,'standard cap fill missing');
 assert.match(html,/\.art \[data-part\]\.pressed \.ln\{fill:#fff/i,'standard pressed outline missing');

 // 2) Edge 必须有一条同等效果的规则，且优先级要压过 Edge 自己的配色
 assert.match(html,/svg\[data-model="edge"\] \[data-part\]\.pressed \.cap[^{]*\{[^}]*fill:var\(--violet-feedback\)/i,'Edge pressed cap fill missing or overridden');

 // 3) 扳机必须和普通图一样用渐变表示按压力度
 assert.match(html,/svg\[data-model="edge"\] \[data-part="l2"\] \.dk\{fill:url\(#ctl-l2-fill\)\}/i,'Edge L2 gradient not wired');
 assert.match(html,/svg\[data-model="edge"\] \[data-part="r2"\] \.dk\{fill:url\(#ctl-r2-fill\)\}/i,'Edge R2 gradient not wired');
 assert.match(html,/id=\\?"ctl-l2-fill\\?"[^>]*>[\s\S]{0,600}?data-edge/i,'Edge L2 gradient stops missing');
});
