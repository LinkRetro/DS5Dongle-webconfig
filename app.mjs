import {fields,decode,patch,command,payload,remapRead,remapWrite,inputParts,decodeLatency} from './protocol.mjs';
import {createOutputTester,createAudioTester,testOutput} from './test-center.mjs';
import {LANGS,S,detectLang,makeT} from './i18n.mjs';
import {PATTERNS,JAPANESE_PATTERNS,KOREAN_PATTERNS} from './i18n_phrases.mjs';
import {authenticateHid} from './auth.mjs';
import {restartReceiver} from './restart.mjs';
const $=id=>document.getElementById(id),say=(text,level='info')=>{paintLocalized($('message'),bindCopy(text));$('message').dataset.level=level};

/* ---- 多语言 ---- */
let lang=detectLang();
const t=makeT(()=>lang);
const msg=(id,params)=>({id,params});
const legacy=source=>({source});
const bindCopy=copy=>typeof copy==='string'?legacy(copy):copy;
const localizedNodes=new WeakMap();
function messageText(message){
 if(typeof message==='string')return message;
 if('source' in message)return lang==='zh-CN'?message.source:trText(message.source);
 if(!message.params)return t(message.id);
 const params=Object.fromEntries(Object.entries(message.params).map(([key,value])=>
  [key,value&&typeof value==='object'?messageText(value):value]));
 return t(message.id,params);
}
function paintLocalized(node,value,attribute='textContent'){
 if(!node)return;
 let bindings=localizedNodes.get(node);
 if(typeof value==='string'){
  bindings?.delete(attribute);
 }else{
  if(!bindings){bindings=new Map();localizedNodes.set(node,bindings)}
  bindings.set(attribute,value);
 }
 const text=messageText(value);
 if(attribute==='textContent'){if(node.textContent!==text)node.textContent=text}
 else if(attribute==='validationMessage')node.setCustomValidity(text);
 else if(node.getAttribute(attribute)!==text)node.setAttribute(attribute,text);
}
const NAV_KEYS={vision:'nav_vision',feel:'nav_feel',audio:'nav_audio',motion:'nav_motion',sticks:'nav_sticks',flash:'nav_flash',touch:'nav_touch',remap:'nav_remap',device:'nav_device',about:'nav_about'};
/* 旧版文案仍通过原文查找。已绑定 ID 的文案直接从词库读取。 */
const phrasesBySource=new Map();
for(const entry of Object.values(S)){
 const source=entry['zh-CN']?.trim();
 if(source)phrasesBySource.set(source,{...phrasesBySource.get(source),...entry});
}
const PAT=String(PATTERNS||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.lastIndexOf('|');if(i<=0)return null;return [new RegExp(l.slice(0,i).replace(/\\\\/g,'\\')),l.slice(i+1)]});

function trText(raw){
  if(!raw)return raw;
  const key=raw.trim();
  if(!key)return raw;
  const entry=phrasesBySource.get(key);
  if(entry?.[lang])return raw.replace(key,()=>entry[lang]);
  if(lang==='zh-TW')return raw;
  const localizedPatterns=lang==='ja'?JAPANESE_PATTERNS:lang==='ko'?KOREAN_PATTERNS:[];
  for(const [pattern,translated] of localizedPatterns){if(pattern.test(key))return key.replace(pattern,translated)}
  if(entry?.en)return raw.replace(key,()=>entry.en);
  for(const [re,rep] of PAT){ if(re.test(key))return key.replace(re,rep); }
  return raw;
}
/* 动态文案的翻译入口：中文环境原样返回 */
const phraseSources=new Map();
function LT(text){
 const result=lang==='zh-CN'?text:trText(text);
 if(result!==text){
  if(phraseSources.size>=512)phraseSources.delete(phraseSources.keys().next().value);
  phraseSources.set(result,text);
 }
 return result;
}
const originalPhrases=new WeakMap();
const originalAttributes=new WeakMap();
function walkPhrases(root){
 if(root.nodeType===3){
  if(localizedNodes.get(root.parentNode)?.has('textContent')||root.parentNode?.matches?.('#version,#device-title'))return;
  const value=root.nodeValue,prev=originalPhrases.get(root);
  const source=prev?.rendered===value?prev.source:phraseSources.get(value)??value;
  const rendered=LT(source);
  if(rendered!==value)root.nodeValue=rendered;
  if(rendered!==source||prev)originalPhrases.set(root,{source,rendered});
  return;
 }
 if(root===flashHost||['SCRIPT','STYLE','PRE'].includes(root.tagName)||root.getAttribute?.('translate')==='no'||root.id==='lang'||root.id==='art')return;
 if(root.nodeType===1){
  const bindings=localizedNodes.get(root);
  if(bindings)for(const [attribute,value] of bindings)paintLocalized(root,value,attribute);
  const label=root.getAttribute('data-i18n-label');
  if(label)paintLocalized(root,msg(label),'aria-label');
  const message=root.getAttribute('data-i18n');
  if(message&&Object.hasOwn(S,message)){paintLocalized(root,msg(message));return}
  const previous=originalAttributes.get(root)??{};
  for(const key of ['aria-label','title','placeholder']){
   if(bindings?.has(key)||key==='aria-label'&&label)continue;
   const value=root.getAttribute(key);if(!value)continue;
   const source=previous[key]?.rendered===value?previous[key].source:phraseSources.get(value)??value;
   const rendered=LT(source);if(rendered!==value)root.setAttribute(key,rendered);
   if(rendered!==source||previous[key])previous[key]={source,rendered};
  }
  if(Object.keys(previous).length)originalAttributes.set(root,previous);
 }
 for(const child of root.childNodes)walkPhrases(child);
 if(root.shadowRoot)walkPhrases(root.shadowRoot);
}
function applyPhrases(root){
  if(!root)return;
  walkPhrases(root);
}
/* 不再监听 DOM 变化：页面每 50ms 会重写状态行，监听会导致文字反复被替换而闪烁。
   改为在 render()/切换语言/打开弹窗时显式调用。 */
function mountLangSelect(){
 if($('lang'))return;
 const host=document.querySelector('header')||document.body;
 const sel=document.createElement('select');
 sel.id='lang';sel.className='lang-select';sel.setAttribute('aria-label','Language');
 for(const [code,label] of LANGS){const o=document.createElement('option');o.value=code;o.textContent=label;sel.append(o)}
 sel.value=lang;
 sel.onchange=()=>{if(!LANGS.some(([code])=>code===sel.value))return;lang=sel.value;try{localStorage.setItem('ds5.lang',lang)}catch(e){};applyI18n()};
 host.appendChild(sel);
}
function applyI18n(){
 document.documentElement.lang=lang;
 /* 注意：body 上也有 data-page（当前页标记），必须排除，否则会把整个页面文字替换掉 */
 document.querySelectorAll('.nav [data-page]').forEach(b=>paintLocalized(b,msg(NAV_KEYS[b.dataset.page])));
 const sel=$('lang');if(sel)sel.value=lang;
 applyPhrases(document.body);
 paintLocalized($('panel-title'),msg(NAV_KEYS[page]));
 paintMappingSource();
}
let device=null,baseline=null,draft={},page='feel',busy=false,epoch=0,profile=0,activeProfile=null,table=null,mapDirty=false,lastInput=0,lastPaint=0,tableBaseline=null,telemetry=null,restartNeeded=false;
let stickParts=[],visualInputActive=false;
let remapSource=0;
let triggerSide='left',triggerHighlight=null;
const triggerPresetKey='ds5.trigger-test';
const triggerModes=['feedback','weapon','vibration'];
function validTriggerPreset(p){
 return p&&triggerModes.includes(p.mode)&&Number.isInteger(p.strength)&&p.strength>=1&&p.strength<=8&&Number.isInteger(p.start)&&p.start>=(p.mode==='weapon'?2:0)&&p.start<=(p.mode==='weapon'?7:9);
}
let triggerPreset={mode:'feedback',strength:3,start:3},triggerPresetSaved=false,triggerPresetDraft=null;
try{const saved=JSON.parse(localStorage.getItem(triggerPresetKey));if(validTriggerPreset(saved)){triggerPreset=saved;triggerPresetSaved=true}}catch{}
const sourceParts=['square','cross','circle','triangle','l1','r1','l2','r2','create','options','stick-l','stick-r','ps','touchpad','mute','dpad-up','dpad-down','dpad-left','dpad-right',...Array(12).fill('touchpad')];
function paintTriggerHint(){
 const hint=$('art-trigger-hint');
 if(hint)paintLocalized(hint,page==='remap'?msg('phrase.select_l2_or_r2_on_the_diagram'):msg('phrase.select_l2_or_r2_on_the_diagram_2'));
 for(const part of $('art').querySelectorAll('[data-part="l2"],[data-part="r2"]')){
  const name=part.dataset.part.toUpperCase();
  const label=page==='remap'?msg('phrase.select_as_mapping_source'):msg('phrase.open_trigger_settings');
  paintLocalized(part,msg('trigger_action',{button:name,label}),'aria-label');
  let title=part.querySelector('title');
  if(!title){title=document.createElementNS('http://www.w3.org/2000/svg','title');part.prepend(title)}
  paintLocalized(title,msg('trigger_action',{button:name,label}));
 }
}
function paintMappingSource(){
 paintTriggerHint();
 const selected=page==='remap'?sourceParts[remapSource]:null;
 $('art').querySelectorAll('[data-part]').forEach(p=>{const on=p.dataset.part===selected;p.classList.toggle('mapping-source',on);if(on)p.setAttribute('data-mapping-label',messageText(names[remapSource]));else p.removeAttribute('data-mapping-label')});
 const label=$('mapping-selection');if(label){label.hidden=!selected;paintLocalized(label,selected?msg('map_selection',{source:names[remapSource]}):'')}
}
let firmwareVersion=null,flashHost=null,flashSession=null,firmwareURL=null;
function paintFirmware(){
 const state=firmwareStatus(firmwareVersion),notice=$('firmware-notice');
 notice.hidden=!device||!firmwareVersion?.match(/-(v1|v12)$/)||state.kind!=='update';
 paintLocalized(notice,msg('fw_update_notice'));
}
function renderFirmware(box){
 const state=firmwareStatus(firmwareVersion),summary=document.createElement('section');summary.className='test-card';
 const current=device?firmwareVersion||msg('fw_version_unreadable'):msg('fw_not_connected');
 const boardStatus=!firmwareVersion?.match(/-(v1|v12)$/)?msg('fw_board_unknown')
  :state.kind==='current'?msg('fw_status_current'):state.kind==='update'?msg('fw_status_update'):msg('fw_status_newer');
 for(const text of [msg('fw_device_version',{version:current}),boardStatus,msg('fw_release_help')]){
  const p=document.createElement('p');paintLocalized(p,text);summary.append(p);
 }
 const check=document.createElement('button');paintLocalized(check,msg('fw_detect_again'));check.dataset.firmwareCheck='true';check.disabled=!device||busy;check.onclick=()=>exclusive(async()=>{firmwareVersion=new TextDecoder().decode(payload(await hidWait(device.receiveFeatureReport(0xf8),'读取固件版本'),0xf8,1)).replace(/\0.*$/s,'');paintFirmware();render()});summary.append(check);
 const detectedBoard=firmwareVersion?.match(/-(v1|v12)$/)?.[1];
 const board=document.createElement('select');board.id='fw-board';
 option(board,'',msg('fw_board_placeholder'));
 for(const [id,label] of [['v1',msg('fw_board_v1')],['v12','V1.2 · RGB']])option(board,id,label);
  board.value=detectedBoard??'';board.dataset.detected=detectedBoard??'';
 const boardRow=row(msg('fw_target_board'));boardRow.append(board);summary.append(boardRow);
 const picker=document.createElement('label');const pickerLabel=document.createElement('span');paintLocalized(pickerLabel,msg('fw_pick_version'));picker.append(pickerLabel);
 const sel=document.createElement('select');sel.id='fw-version';
 picker.append(sel);
 const hint=document.createElement('p');hint.className='firmware-hint';
 const go=document.createElement('button');go.className='fw-open';paintLocalized(go,msg('fw_install_version'));
 let list=[],chosen=null;
 const loadImage=async (entry,boardId)=>{
   if(BOARD_FIRMWARE_IMAGES?.[boardId]&&catalogFor('-'+boardId)?.[0]?.file===entry.file)
   return Uint8Array.from(atob(BOARD_FIRMWARE_IMAGES[boardId]),c=>c.charCodeAt(0));
   if(globalThis.location?.protocol==='file:')throw Error('该镜像没有内嵌，请用 start-web.cmd 打开配置页。');
   const res=await fetch(`firmware/${boardId}/${entry.file}`);
   if(!res.ok)throw Error('服务器上没有 '+entry.file);
   return new Uint8Array(await res.arrayBuffer());
 };
 const applyChoice=()=>{
   chosen=list[Number(sel.value)]??null;
   if(!chosen){paintLocalized(hint,msg('fw_confirm_board'));go.disabled=true;return}
   go.disabled=flashSession?.isBusy()??false;
   paintLocalized(hint,'');
   for(const part of [msg('fw_selected',{version:chosen.version}),firmwareVersion===chosen.version?msg('fw_selected_current'):null,chosen.notes?legacy(chosen.notes):null]){
    if(!part)continue;
    if(hint.childNodes.length)hint.append(' · ');
    const label=document.createElement('span');paintLocalized(label,part);hint.append(label);
   }
  paintLocalized(go,firmwareVersion===chosen.version?msg('fw_reinstall_version'):msg('fw_install_version'));
 };
 sel.onchange=applyChoice;
  const selectBoard=()=>{list=catalogFor('-'+board.value)??[];sel.replaceChildren();for(const [i,v] of list.entries())option(sel,i,v.version,false);sel.value='0';applyChoice()};
  board.onchange=selectBoard;selectBoard();
 // 点击即弹窗；弹窗挂在 body 上、不依赖设备连接，拔掉接收器后仍可操作
  go.onclick=()=>{if(!chosen||flashSession?.isBusy())return;const boardId=board.value;fwDialogOpen(chosen.version,chosen,entry=>loadImage(entry,boardId))};
 summary.append(picker);summary.append(hint);summary.append(document.createElement('br'),go);box.append(summary);
 if(!flashHost){flashHost=document.createElement('div');flashHost.className='embedded-flasher';const root=flashHost.attachShadow({mode:'open'});root.innerHTML=FLASH_MARKUP;flashSession=globalThis.mountDongleFlash({querySelector:s=>root.querySelector(s),createElement:s=>document.createElement(s)})}
 box.append(flashHost);flashHost.hidden=true;
}
/* ---------- 固件更新弹窗 ----------
 * 烧录必须把接收器拔下来进入下载模式，此时本页与设备断开属正常现象，
 * 因此弹窗挂在 document.body 上、只在首次创建一次，页面重渲染或设备
 * 掉线都不会影响它；进度与日志从隐藏的烧录引擎轮询同步。
 */
let fwDialog=null,fwDialogTick=null,fwDialogGeneration=0;
function fwDialogNode(){
 if(fwDialog)return fwDialog;
 const m=document.createElement('div');m.className='fw-modal';m.hidden=true;
 m.innerHTML=`<div class="fw-card" role="dialog" aria-modal="true" aria-labelledby="fw-dialog-title">
  <h3 id="fw-dialog-title" data-i18n="phrase.update_dongle_firmware">更新接收器固件</h3>
  <p class="fw-version"></p>
  <ol class="fw-steps">
   <li data-i18n="phrase.unplug_the_dongle_hold_boot_then_replug">拔掉接收器，按住 BOOT 键不放，再插回电脑（此时本页与接收器断开，属正常）</li>
   <li data-i18n="phrase.release_boot_to_enter_download_mode">松开 BOOT：接收器进入下载模式</li>
   <li data-i18n="phrase.click_below_and_select_the_dongle_s">点下面按钮，在浏览器弹出的串口列表里选接收器的下载口</li>
  </ol>
  <p class="fw-device" data-i18n="phrase.device_status_reading">设备状态：读取中…</p>
  <div class="fw-bar"><progress max="100" value="0"></progress><span class="fw-pct">0%</span></div>
  <p class="fw-stage" data-i18n="phrase.preparing_firmware">正在准备固件…</p>
  <p class="fw-tip" hidden data-i18n="phrase.no_port_found_hold_boot_while_plugging_usb">串口列表里没有出现接收器？请按住 BOOT 键再插 USB，松手后会多出一个串口。</p>
  <details class="fw-details"><summary data-i18n="phrase.detailed_log">详细日志</summary><pre class="fw-log"></pre></details>
  <div class="fw-actions"><button class="fw-start primary" disabled data-i18n="phrase.select_serial_port_and_flash">选择串口并开始烧录</button><button class="fw-close" data-i18n="phrase.close">关闭</button></div>
 </div>`;
 document.body.append(m);
 applyPhrases(m);
 const q=s=>m.querySelector(s);
 q('.fw-close').onclick=()=>{if(flashSession?.isBusy())return;fwDialogGeneration++;m.hidden=true;if(fwDialogTick){clearInterval(fwDialogTick);fwDialogTick=null}};
 q('.fw-start').onclick=()=>{
  q('.fw-tip').hidden=false;
  if(!('serial' in navigator)){paintLocalized(q('.fw-stage'),legacy('当前浏览器不支持 Web Serial：请用桌面版 Chrome 或 Edge 打开本页'));return}
  if(!globalThis.isSecureContext){paintLocalized(q('.fw-stage'),legacy('本页不是安全上下文：请通过 https 或 localhost 访问，否则无法使用串口'));return}
  const fail=e=>{paintLocalized(q('.fw-stage'),legacy(e?.message??String(e)))};
  try{const p=flashSession?.start();if(p&&typeof p.catch==='function')p.catch(fail)}catch(e){fail(e)}
 };
 fwDialog=m;
 return m;
}
function fwDialogOpen(version,entry,loadImage){
 const m=fwDialogNode(),q=s=>m.querySelector(s);
 const generation=++fwDialogGeneration;
 let started=false;
 q('.fw-start').addEventListener('click',()=>{started=true},{once:true});
 q('.fw-version').textContent=version;
 q('.fw-bar progress').value=0;q('.fw-pct').textContent='0%';
 paintLocalized(q('.fw-stage'),legacy('正在准备固件…'));
 q('.fw-tip').hidden=true;
 paintLocalized(q('.fw-device'),legacy(device?'设备状态：仍与接收器连接（需按住 BOOT 拔插一次，才会出现下载串口）':'设备状态：未连接'));
 q('.fw-start').disabled=true;
 m.hidden=false;
 applyPhrases(m);
 if(fwDialogTick)clearInterval(fwDialogTick);
 fwDialogTick=setInterval(()=>{
  if(m.hidden){clearInterval(fwDialogTick);fwDialogTick=null;return}
  const sr=flashHost?.shadowRoot;if(!sr)return;
  const bar=sr.querySelector('#progress-bar'),st=sr.querySelector('#stage-text'),lg=sr.querySelector('#log');
  const pct=Number(bar?.value??0);
  q('.fw-bar progress').value=Math.round(pct*10)/10;q('.fw-pct').textContent=Math.round(pct)+'%';
   if(started&&'serial' in navigator&&globalThis.isSecureContext&&st?.textContent)paintLocalized(q('.fw-stage'),legacy(st.textContent));
  const stt=started&&'serial' in navigator&&globalThis.isSecureContext&&sr.querySelector('#status-text');
  if(stt?.textContent)paintLocalized(q('.fw-device'),msg('firmware_device_status',{state:legacy(stt.textContent)}));
  if(lg)q('.fw-log').textContent=(lg.textContent??'').slice(-8000);
 },300);
 loadImage(entry).then(async bytes=>{
   if(generation!==fwDialogGeneration)return;
  if(!flashSession?.setImage)throw Error('烧录组件未就绪，请回到“固件更新”页重试');
   if(!/^[0-9a-f]{64}$/i.test(entry.sha256??''))throw Error('固件发布清单缺少校验值');
   await flashSession.setImage(entry.file,bytes,version,entry.sha256,()=>generation===fwDialogGeneration);
   if(generation!==fwDialogGeneration)return;
  paintLocalized(q('.fw-stage'),legacy('固件已就绪。请按上面 3 步操作，然后点“选择串口并开始烧录”。'));
  q('.fw-start').disabled=false;
 }).catch(e=>{if(generation===fwDialogGeneration)paintLocalized(q('.fw-stage'),legacy(e.message??String(e)))});
}

const outputTester=createOutputTester({getDevice:()=>device,isConnected:()=>telemetry?.[13]===0xd3&&telemetry[14]===7,getColor:()=>['led_r','led_g','led_b'].map(k=>baseline?.[k]??210),notify:say,onState:paintStopTest});
const audioTester=createAudioTester({notify:say,onState:paintStopTest,onLevel:n=>{const meter=$('mic-level');if(meter){meter.value=n;paintLocalized($('mic-reading'),msg('microphone_level',{pct:Math.round(n)}))}}});
let triggerSequence=null,testGeneration=0;
let colorTimer=null,nextPreview=null,sendingColor=false;
function paintStopTest(){
 const button=$('test-stop');
 button.hidden=!(outputTester.isActive()||audioTester.isActive()||triggerSequence!==null||nextPreview);
 paintLocalized(button,msg('phrase.stop_test'));
}
function cancelTriggerSequence(){testGeneration++;clearTimeout(triggerSequence);triggerSequence=null;paintStopTest()}
function cancelColorPreview(){clearTimeout(colorTimer);colorTimer=null;nextPreview=null;paintStopTest()}
function stopTests(){cancelTriggerSequence();cancelColorPreview();audioTester.stop();return outputTester.stop()}
function scheduleColorPreview(){
 paintStopTest();
 if(colorTimer!==null||sendingColor||!nextPreview)return;
 colorTimer=setTimeout(async()=>{
  colorTimer=null;
  const preview=nextPreview;nextPreview=null;
  if(!preview||device!==preview.device||busy||document.hidden||$('qa-lights').disabled){paintStopTest();return}
  sendingColor=true;
  try{await testAction(()=>outputTester.previewColor(preview.rgb))}
  finally{sendingColor=false;scheduleColorPreview()}
 },60);
}
async function testAction(fn){try{await fn()}catch(e){say(e.message??String(e),'error')}}
const touchActions=[msg('map_touch'),msg('map_up'),msg('map_down'),msg('map_left'),msg('map_right'),msg('map_click')];
const names=[
 msg('map_square'),msg('map_cross'),msg('map_circle'),msg('map_triangle'),
 'L1','R1','L2','R2','Create','Options','L3','R3','PS',msg('map_touchpad_click'),msg('map_mute'),
 msg('map_dpad',{direction:msg('map_up')}),msg('map_dpad',{direction:msg('map_down')}),
 msg('map_dpad',{direction:msg('map_left')}),msg('map_dpad',{direction:msg('map_right')}),
 ...touchActions.map(action=>msg('map_left_zone',{action})),
 ...touchActions.map(action=>msg('map_right_zone',{action})),
];
const specs={
 vision:[],motion:[],
 sticks:[['stick_left_inner',msg('phrase.left_stick_inner_deadzone'),msg('phrase.ignore_small_movements_near_the_center'),0,30,1],['stick_left_outer',msg('phrase.left_stick_outer_deadzone'),msg('phrase.reach_full_output_earlier'),0,30,1],['stick_left_anti',msg('phrase.stick_anti_deadzone'),msg('phrase.ignore_small_movements_near_the_center_keep_minimum_output'),0,30,1],['stick_left_curve',msg('phrase.stick_curve'),msg('phrase.100_is_linear_below_is_softer_near_the_center'),50,200,1],['stick_left_diag',msg('phrase.stick_diagonal'),msg('phrase.compensate_the_radial_shrink_at_45_degrees'),0,100,1],['stick_left_restrict',msg('phrase.stick_axis_restrict'),msg('phrase.remove_slack_before_an_axis_responds'),0,30,1],['stick_flags',msg('phrase.uncap_outer_radius'),msg('phrase.allow_full_deflection_even_with_outer_trim')],['stick_right_inner',msg('phrase.right_stick_inner_deadzone'),msg('phrase.ignore_small_movements_near_the_center'),0,30,1],['stick_right_outer',msg('phrase.right_stick_outer_deadzone'),msg('phrase.reach_full_output_earlier'),0,30,1],['stick_right_anti',msg('phrase.stick_anti_deadzone'),msg('phrase.ignore_small_movements_near_the_center_keep_minimum_output'),0,30,1],['stick_right_curve',msg('phrase.stick_curve'),msg('phrase.100_is_linear_below_is_softer_near_the_center'),50,200,1],['stick_right_diag',msg('phrase.stick_diagonal'),msg('phrase.compensate_the_radial_shrink_at_45_degrees'),0,100,1],['stick_right_restrict',msg('phrase.stick_axis_restrict'),msg('phrase.remove_slack_before_an_axis_responds'),0,30,1],],
feel:[['haptics_gain',msg('phrase.haptic_strength'),'',1,2,.1],['trigger_reduce',msg('phrase.trigger_resistance'),msg('phrase.0_keeps_the_game_s_original_strength'),0,10,1]],
audio:[['speaker_volume','扬声器音量','',0,100,1],['headset_volume','耳机音量','',0,100,1],['speaker_gain','扬声器增益','',0,7,1],['audio_buffer_length','音频缓冲','',16,128,1],['audio_haptic','音频转触觉','',['关闭','自动（游戏优先）','强制']],['disable_speaker','关闭扬声器编码'],['disable_mic','关闭麦克风透传'],['lock_volume','锁定音量','忽略电脑和游戏的音量调整。']],
touch:[['tp_mode',msg('touch_mode'),'',[msg('control_off'),msg('touch_dpad'),msg('touch_left_mouse_right_dpad'),msg('touch_left_dpad_right_mouse'),msg('touch_zone_mapping')]],['tp_mouse_sensitivity',msg('touch_mouse_sensitivity'),'',1,32,1],['tp_block_raw',msg('touch_block_raw'),msg('touch_mapping_only')],['combo_window',msg('touch_combo_window'),msg('touch_combo_help'),0,50,1],['mask',msg('touch_cycle_modes'),msg('touch_cycle_help')]],
device:[['controller_mode',msg('device_usb_mode'),msg('device_restart_required'),['DualSense','DualSense Edge',msg('device_auto_detect')]],['polling_rate_mode',msg('device_polling'),msg('device_polling_help'),['500 Hz','1 kHz',msg('device_polling_realtime')]],['inactive_time',msg('device_idle_disconnect'),msg('device_idle_help'),0,60,1],['idle_save',msg('device_radio_saving'),msg('device_radio_help')],['enable_wake',msg('device_ps_wake')],['ps_shortcut_enabled',msg('device_ps_shortcuts'),msg('device_ps_shortcuts_help')],['enable_usb_sn',msg('device_usb_serial'),msg('device_restart_required')],['usb_stealth',msg('device_hide_usb'),msg('device_hide_usb_help')],['disable_led',msg('device_led_timeout'),msg('device_led_help')]]};
function val(k){return k in draft?draft[k]:baseline?.[k]}
const restartDevices=new WeakSet();
const restartFields=new Set(['polling_rate_mode','controller_mode','enable_usb_sn','ps_shortcut_enabled','usb_stealth','tp_mode','enable_wake']);
const scopedSavePages=new Set(['feel','audio','sticks']);
function settingsToSave(){
 if(!scopedSavePages.has(page))return {...draft};
 return Object.fromEntries(specs[page].map(([key])=>key).filter(key=>key in draft).map(key=>[key,draft[key]]));
}
function mappingChanges(){if(!table||!tableBaseline)return 0;let count=0;for(let i=0;i<31;i++)if(table.slice(i*4,i*4+4).some((v,j)=>v!==tableBaseline[i*4+j]))count++;return count}
function changedCount(){const keys=Object.keys(draft),colors=keys.filter(k=>k.startsWith('led_')).length;return keys.length-colors+(colors?1:0)+mappingChanges()}
function dirty(){return changedCount()>0}
function needsRestart(){return Object.keys(draft).some(k=>restartFields.has(k))||!!(mappingChanges()&&table.some((v,i)=>i%4===0&&v!==0))}
function paintQuickActions(){
 const state=telemetry?.length>=17&&telemetry[13]===0xD3?telemetry[14]:null;
  const ready=!!device&&!busy&&state===7;
 const labels={rumble:'qa_rumble',trigger:'phrase.test_both_triggers',lights:'qa_lights'};
  document.querySelectorAll('#controls button[data-hid="true"]').forEach(b=>b.disabled=!ready);
 for(const [id,key] of Object.entries(labels)){
  const b=$('qa-'+id);if(!b)continue;
   b.disabled=!ready;paintLocalized(b,msg(key));
 }
 const hint=$('qa-hint');
 paintStopTest();
 if(hint){paintLocalized(hint,ready?msg('qa_hint'):'')}
}
const hex2=n=>(n??255).toString(16).padStart(2,'0');
function paintHeroColor(){
 const wrap=$('qa-color-wrap'),input=$('qa-color'),label=$('qa-color-label');
 if(!wrap||!input)return;
 wrap.hidden=!device;
 if(label){paintLocalized(label,msg('lightbar_preview'))}
 const hex=connectionColorHex();
 if(input.value.toLowerCase()!==hex.toLowerCase())input.value=hex;
 input.disabled=!device||busy;
 const picker=$('vision-color');if(picker){if(picker.value!==hex)picker.value=hex;picker.disabled=!device||busy}
 const testColor=$('test-color');
 if(testColor){
  const changed=colorFields.some(key=>key in draft);
  paintColorSwatch(testColor,hex);
  const saved=$('test-saved-color'),save=$('test-save-color'),status=$('test-color-status');
  paintColorSwatch(saved,baseline?'#'+colorFields.map(key=>hex2(baseline[key])).join(''):null);
  save.disabled=!device||busy||!changed;
  paintLocalized(status,!device?legacy('连接接收器后可保存灯色。'):busy&&colorSaving?legacy('正在保存并发送灯色…'):changed?legacy(colorSaveFailed?'未确认保存，请重试。':'当前选色尚未保存。'):lastColorWrite??legacy('当前选色与接收器读取值一致。'));
  paintLocalized(save,legacy(changed&&colorSaveFailed?'重试保存灯色':'保存为连接灯色'));
 }
}
const colorFields=['led_r','led_g','led_b'];
let colorSaving=false,colorSaveFailed=false,lastColorWrite=null;
function paintColorSwatch(node,hex){node.textContent=hex?.toUpperCase()??'—';node.style.setProperty('--preview-color',hex??'transparent')}
function connectionColor(){return colorFields.map(k=>val(k)??255)}
function connectionColorHex(){return '#'+connectionColor().map(hex2).join('')}
function stageColor(input){
 if(!device||busy)return;
 const hex=input.value;
 if(!/^#[0-9a-f]{6}$/i.test(hex))return;
 if(hex==='#000000'){paintHeroColor();say('当前固件不能保存纯黑灯色，会把它转换为白色。','error');return}
 colorSaveFailed=false;
 colorFields.forEach((key,i)=>set(key,parseInt(hex.slice(1+i*2,3+i*2),16)));
 if(!$('qa-lights').disabled){cancelTriggerSequence();nextPreview={device,rgb:connectionColor()};scheduleColorPreview()}
}
function paintVerdict(){
 const box=$('verdict');if(!box)return;
 const state=telemetry?.length>=17&&telemetry[13]===0xD3?telemetry[14]:null;
 const pct=telemetry?.[11],known=Number.isInteger(pct)&&pct>=0&&pct<=100;
 let kind='warn',title=msg('verdict_checking'),detail='';
 if(!navigator.hid){kind='bad';title=msg('verdict_unsupported')}
 else if(!device){kind='warn';title=msg('verdict_no_device')}
 else if(state===7){
  kind='ok';title=msg('verdict_ready');
  const model=$('device-title').textContent||'';
  detail=[model,known?`${pct}%`:''].filter(Boolean).join(' · ');
  }else if(state===null){title=msg('phrase.controller_status_unknown_3');detail=msg('phrase.waiting_for_controller_status_press_a_button')}
  else if(state>0&&state<7){title=msg('phrase.connecting_controller');detail=msg('verdict_pair_hint')}
  else{kind='warn';title=telemetry?.[15]?msg('phrase.waiting_for_paired_controller'):msg('verdict_no_controller');detail=telemetry?.[15]?msg('phrase.press_ps_to_reconnect'):msg('phrase.hold_create_ps_until_the_light_flashes')}
 if(box.dataset.state!==kind)box.dataset.state=kind;
 const tt=$('verdict-title'),dd=$('verdict-detail');
 paintLocalized(tt,title);
 paintLocalized(dd,detail);
 paintQuickActions();
 paintHeroColor();
}
function paintConnection(){
 $('dot').classList.toggle('on',!!device);
 paintLocalized($('connection'),device?msg('status_connected'):msg('status_disconnected'));
 const states=[msg('phrase.waiting_for_controller'),msg('phrase.searching_for_controller'),msg('phrase.connecting_over_bluetooth'),msg('phrase.querying_controller_services'),msg('phrase.connecting_control_channel'),msg('phrase.connecting_input_channel'),msg('phrase.controller_handshaking'),msg('phrase.controller_connected'),msg('phrase.controller_disconnecting')];
 const state=telemetry?.length>=17&&telemetry[13]===0xD3?telemetry[14]:null;
 $('controller-dot').classList.toggle('on',!!device&&state===7);
 $('controller-dot').classList.toggle('working',!!device&&state!==null&&state>0&&state<7);
 paintLocalized($('controller-connection'),!device?msg('ctrl_unknown'):state===null?msg('phrase.controller_status_pending'):states[state]??msg('phrase.controller_status_unknown_2'));
 paintLocalized($('controller-connection'),state===null?'':msg('link_bound',{count:telemetry[15]}),'title');
 const pct=telemetry?.[11],known=Number.isInteger(pct)&&pct>=0&&pct<=100;
 const power=telemetry?.[12];
 paintLocalized($('power-status'),!device||!known?msg('phrase.battery_pending'):msg('power_summary',{pct,state:power===1?msg('phrase.charging'):power===2?msg('phrase.charged'):power===0?msg('phrase.on_battery'):msg('phrase.battery_status_unknown')}));
 $('power-status').dataset.level=known&&pct<=10&&telemetry[12]===0?'low':'normal';
 paintVerdict();
}
function paintRemapStatus(){
 const node=$('mapping-state');
 if(!node)return;
 const status=busy?msg('remap_busy'):!device?msg('remap_connect'):!table?msg('remap_unavailable')
   :msg('remap_group_status',{editing:profile+1,active:activeProfile+1});
 paintLocalized(node,status);
}
function refresh(){
 const enabled=!!device&&!busy;
 /* After a disconnect baseline/table are null; computing the change count then
  * used to throw and leave every control (and the exclusive queue) stuck. */
 let count=0;mapDirty=false;
 try{count=baseline?changedCount():0;mapDirty=table?mappingChanges()>0:false}catch{count=0;mapDirty=false}
 const scoped=scopedSavePages.has(page);
 const deviceCount=scoped?Object.keys(settingsToSave()).length:count;
 const browserCount=page==='feel'&&triggerPresetDraft?1:0;
 const localCount=deviceCount+browserCount;
 $('save').disabled=busy||!(deviceCount?enabled:browserCount);$('revert').disabled=busy||!(deviceCount?enabled:browserCount);
 paintLocalized($('revert'),scoped?msg('phrase.discard_changes_on_this_page'):msg('revert'));
 $('reload').disabled=!enabled;$('reboot').disabled=!enabled||!!count;
 $('connect').disabled=busy;paintLocalized($('connect'),device?msg('disconnect'):msg('connect'));
 const changeStatus=scoped
   ?(localCount?msg('save_page_dirty',{count:localCount}):msg('phrase.no_unsaved_changes_on_this_page'))
   :(count?msg('save_all_dirty',{count}):msg('saved'));
 const changeSummary=scoped&&count>deviceCount
   ?msg('save_dirty_summary',{page:changeStatus,count:count-deviceCount})
   :changeStatus;
 paintLocalized($('dirty'),changeSummary);
 const restartDraft=!scoped&&needsRestart();$('restart-hint').hidden=!restartDraft&&!restartNeeded;
 paintLocalized($('restart-hint'),restartDraft?msg('phrase.some_changes_need_a_restart_restart_the'):restartNeeded?msg('phrase.settings_applied_and_save_requested_restart_the'):'');
 paintLocalized($('save'),busy?msg('phrase.working'):scoped?msg('phrase.save_this_page'):msg('apply'));
 document.querySelectorAll('#controls input,#controls select,#controls button').forEach(e=>e.disabled=!enabled);
 document.querySelectorAll('#controls [data-local-test]').forEach(e=>e.disabled=busy);
 paintConnection();
 if(page==='remap'){
  paintRemapStatus();
  if(!table)document.querySelectorAll('#controls input,#controls select,#controls button').forEach(e=>e.disabled=true);
 }
  if(page==='flash'){
   const board=$('fw-board'),versions=$('fw-version'),go=document.querySelector('.fw-open');
   const locked=busy||flashSession?.isBusy();
   board.disabled=!!board.dataset.detected||!!locked;
   versions.disabled=!!locked||!versions.options.length;
   go.disabled=versions.disabled;
  }
}
const audioLiveKeys=new Set(['speaker_volume','headset_volume','speaker_gain']);
let audioApplyTimer=null;
async function applyAudioLive(){
  const d=device;
  if(!d||busy)return;
  try{
    const wanted=settingsToSave();
    if(!Object.keys(wanted).some(k=>audioLiveKeys.has(k)))return;
    const bytes=patch(await readCfg(d),wanted);
    if(d!==device)return;
    await d.sendFeatureReport(0xf6,command(1,bytes));
  }catch(e){/* live preview is best effort */}
}
function scheduleAudioApply(){
  if(typeof setTimeout!=='function')return;
  if(audioApplyTimer)clearTimeout(audioApplyTimer);
  audioApplyTimer=setTimeout(()=>{audioApplyTimer=null;void applyAudioLive()},200);
}
function set(k,v){const same=k==='haptics_gain'?Math.fround(v)===Math.fround(baseline?.[k]):v===baseline?.[k];if(same)delete draft[k];else draft[k]=v;refresh();if(k.startsWith('led_'))paintLight();else if(audioLiveKeys.has(k))scheduleAudioApply()}
function option(select,value,label,translateLegacy=true){const o=document.createElement('option');o.value=value;if(!translateLegacy)o.setAttribute('translate','no');paintLocalized(o,translateLegacy?bindCopy(label):label);select.append(o)}
function row(label,hint,group=false){const r=document.createElement(group?'div':'label');if(group){r.setAttribute('role','group');paintLocalized(r,bindCopy(label),'aria-label')}r.className='row';const s=document.createElement('span');const caption=document.createElement('span');paintLocalized(caption,bindCopy(label));s.append(caption);if(hint){const h=document.createElement('small');paintLocalized(h,bindCopy(hint));s.append(h)}r.append(s);return r}
function render(){renderPanel();applyPhrases(document.body)}
function renderPanel(){ if(flashSession?.isBusy()&&page!=='flash'){page='flash';say('正在烧录，请等待完成后切换分类');return}document.body.dataset.page=page;paintMappingSource();paintLocalized($('panel-title'),msg(NAV_KEYS[page]));paintLocalized($('panel-sub'),page==='flash'?msg('phrase.device_version_latest_local_firmware_browser_update'):page==='vision'?msg('phrase.preview_a_color_then_save_it_as'):page==='motion'?msg('phrase.diagnostic_settings_are_stored_in_this_browser'):scopedSavePages.has(page)?msg('phrase.tests_are_temporary_save_submits_only_this'):page==='about'?msg('phrase.oled_visual_language_bl616_protocol'):msg('phrase.changes_are_only_sent_when_you_click'));const box=$('controls');box.replaceChildren();document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 if(page==='flash'){renderFirmware(box);refresh();return}
 if(page==='about'){
  const card=document.createElement('section');card.className='test-card';
  const intro=document.createElement('p');paintLocalized(intro,msg('about_description'));card.append(intro);
  const hw=document.createElement('p');hw.className='hint';paintLocalized(hw,msg('about_hardware'));card.append(hw);
  const sup=document.createElement('p');sup.className='hint';paintLocalized(sup,msg('about_support'));card.append(sup);
  const dc=document.createElement('a');dc.href='https://discord.com/invite/s3xcU2PgqZ';dc.target='_blank';dc.rel='noreferrer';paintLocalized(dc,msg('about_discord'));card.append(dc);
  const lic=document.createElement('a');lic.href='LICENSES.txt';paintLocalized(lic,msg('about_licenses'));card.append(lic);
  box.append(card);refresh();return}
 if(page==='remap'){renderRemap(box);refresh();return}
 if(page==='sticks'){
  const hasStick=baseline?('stick_left_inner' in baseline):false;
  const hasWarp=baseline?('stick_left_curve' in baseline):false;
  const p=document.createElement('p');p.className='hint';
  paintLocalized(p,!device?msg('phrase.connect_the_dongle_to_read_stick_settings')
    :!hasStick?msg('phrase.stick_deadzones_require_oc14_or_newer_firmware')
    :!hasWarp?msg('phrase.warp_params_need_oc15')
    :msg('phrase.the_diagram_and_coordinates_show_usb_output'));
  box.append(p);
 }
 const inlineSettings=new Map();
 /* 未连接时不显示摇杆字段；连接后按固件实际具备的字段过滤 */
 const pageSpecs=page==='sticks'
  ? (baseline?specs.sticks.filter(([k])=>k==='stick_flags'?('stick_left_curve' in baseline):(k in baseline)):[])
  : specs[page];
 for(const [k,label,hint,min,max,step]of pageSpecs){
  if(k==='mask'){const g=document.createElement('fieldset');g.className='row';const title=document.createElement('span');const caption=document.createElement('span');paintLocalized(caption,label);title.append(caption);const help=document.createElement('small');paintLocalized(help,hint);title.append(help);g.append(title);const choices=document.createElement('div');[msg('control_off'),msg('touch_dpad'),msg('touch_left_mouse'),msg('touch_right_mouse'),msg('touch_zones')].forEach((choice,i)=>{const l=document.createElement('label');l.style.display='block';const c=document.createElement('input');c.type='checkbox';c.checked=!!(val('tp_mode_enabled_mask')&(1<<i));c.onchange=()=>{let mask=val('tp_mode_enabled_mask')??1;mask=c.checked?mask|(1<<i):mask&~(1<<i);if(!mask){c.checked=true;say(msg('touch_keep_mode'));return}set('tp_mode_enabled_mask',mask)};const caption=document.createElement('span');paintLocalized(caption,choice);l.append(c,caption);choices.append(l)});g.append(choices);box.append(g);continue}
  const r=row(label,hint,min!==undefined&&!Array.isArray(min));let c;
  if(k==='color'){c=document.createElement('input');c.type='color';c.value='#'+['led_r','led_g','led_b'].map(n=>(val(n)??255).toString(16).padStart(2,'0')).join('');c.oninput=()=>['led_r','led_g','led_b'].forEach((n,i)=>set(n,parseInt(c.value.slice(1+i*2,3+i*2),16)))}
  else if(Array.isArray(min)){c=document.createElement('select');min.forEach((t,i)=>option(c,i,t));c.value=val(k)??0;c.onchange=()=>set(k,Number(c.value))}
  else if(min!==undefined){
   r.classList.add('range-row');c=document.createElement('div');c.className='range-control';
   const slider=document.createElement('input'),number=document.createElement('input');
   slider.type='range';number.type='number';
   for(const input of [slider,number]){input.min=min;input.max=max;input.step=step;input.value=Number((val(k)??min).toFixed(2));input.dataset.field=k;paintLocalized(input,input===number?msg('precise_value',{label:bindCopy(label)}):bindCopy(label),'aria-label')}
   slider.oninput=()=>{const n=Number(slider.value);number.value=n;paintLocalized(number,'','validationMessage');set(k,n)};
    number.oninput=()=>{const n=number.value===''?NaN:Number(number.value),valid=Number.isFinite(n)&&n>=min&&n<=max&&Math.abs((n-min)/step-Math.round((n-min)/step))<0.00001;paintLocalized(number,valid?'':msg('invalid_step'),'validationMessage');if(valid){slider.value=n;set(k,n)}};
   c.append(slider,number)
  }
  else{c=document.createElement('input');c.type='checkbox';c.checked=!!val(k);c.onchange=()=>set(k,+c.checked)}r.append(c);
  if(page==='feel')inlineSettings.set(k,r);else box.append(r)
 }
 if(page==='device'){
  const diagnostics=document.createElement('details');diagnostics.className='latency-panel';
  diagnostics.innerHTML='<summary data-i18n="device_latency">诊断 · 板内蓝牙输入至 USB 提交完成</summary><p id="latency-state"></p><div class="latency-grid"><div><span data-i18n="device_latency_last">最新</span><strong id="latency-last">—</strong></div><div><span data-i18n="device_latency_average">平均</span><strong id="latency-average">—</strong></div><div><span data-i18n="device_latency_max">最大</span><strong id="latency-max">—</strong></div></div><p class="hint" id="latency-detail"></p>';
  box.append(diagnostics);paintLatency(telemetry);
 }
 if(['vision','feel','audio','motion'].includes(page))renderTests(box,inlineSettings);
 refresh();paintLight()
}
function renderTests(box,inlineSettings){
 function validTestNumber(input){
  const value=Number(input.value);
  return input.value.trim()!==''&&Number.isInteger(value)&&value>=Number(input.min)&&value<=Number(input.max);
 }
 function testNumber(input){
  const value=Number(input.value);
  if(!validTestNumber(input))throw new RangeError(messageText(msg('invalid_integer',{min:input.min,max:input.max})));
  return value;
 }
 function section(title,hint){const s=document.createElement('section');s.className='test-card';const h=document.createElement('h3');paintLocalized(h,bindCopy(title));s.append(h);if(hint){const p=document.createElement('p');p.className='hint';paintLocalized(p,bindCopy(hint));s.append(p)}box.append(s);return s}
 function input(s,id,label,type,value,min,max){const r=row(label),c=document.createElement('input');c.id=id;c.dataset.localTest='true';c.type=type;c.value=value;if(min!==undefined){c.min=min;c.max=max;c.step=1}r.append(c);s.append(r);return c}
 function select(s,id,label,choices){const r=row(label),c=document.createElement('select');c.id=id;c.dataset.localTest='true';for(const [v,t]of choices)option(c,v,t);r.append(c);s.append(r);return c}
 function button(s,id,label,fn,hid=true){const b=document.createElement('button');b.id=id;paintLocalized(b,bindCopy(label));b.dataset.hid=String(hid);if(!hid)b.dataset.localTest='true';b.onclick=()=>testAction(()=>{if(hid){cancelTriggerSequence();cancelColorPreview()}return fn()});s.append(b);return b}
 if(page==='feel'){
 const rumble=section(msg('phrase.rumble_and_haptics'),msg('phrase.haptic_gain_can_be_saved_the_standard'));
 rumble.append(inlineSettings.get('haptics_gain'));
 const left=input(rumble,'rumble-left',msg('phrase.left_test_strength_0_255'),'number',80,0,255),right=input(rumble,'rumble-right',msg('phrase.right_test_strength_0_255'),'number',80,0,255);
 button(rumble,'test-rumble',msg('phrase.rumble_2s'),()=>outputTester.run('rumble',{left:testNumber(left),right:testNumber(right)}));
 const trigger=section(msg('phrase.adaptive_triggers'),msg('phrase.save_resistance_reduction_to_the_dongle_to'));
 trigger.append(inlineSettings.get('trigger_reduce'));
 const trial=document.createElement('div');trial.className='trigger-trial';
 const note=document.createElement('p');note.className='hint';paintLocalized(note,msg('phrase.save_this_page_remembers_these_test_parameters'));trial.append(note);trigger.append(trial);
 const side=select(trial,'trigger-side',msg('phrase.trigger_under_test'),[['left',msg('phrase.l2_left_trigger')],['right',msg('phrase.r2_right_trigger')]]);
 side.value=triggerSide;
 const selected=document.createElement('p');selected.id='trigger-selection';selected.className='hint';selected.setAttribute('role','status');trial.append(selected);
 side.onchange=()=>{triggerSide=side.value;paintTriggerSelection()};
 paintTriggerSelection();
 const mode=select(trial,'trigger-mode',msg('phrase.test_effect'),[['feedback',msg('phrase.constant_resistance')],['weapon',msg('phrase.section_resistance')],['vibration',msg('phrase.trigger_vibration_30_hz')]]);
 const preset=triggerPresetDraft??triggerPreset;
 mode.value=preset.mode;
 const force=input(trial,'trigger-force',msg('phrase.test_strength_1_8'),'number',preset.strength,1,8),start=input(trial,'trigger-start',msg('phrase.test_start_position'),'number',preset.start,0,9);
 const presetStatus=document.createElement('p');presetStatus.id='trigger-preset-status';presetStatus.className='hint';presetStatus.setAttribute('role','status');trial.append(presetStatus);
 const readPreset=()=>({mode:mode.value,strength:testNumber(force),start:testNumber(start)});
 button(trial,'test-trigger',msg('phrase.trigger_test_2s'),()=>outputTester.run('trigger',{side:side.value,...readPreset()}));
 const updatePreset=()=>{
  start.min=mode.value==='weapon'?2:0;start.max=mode.value==='weapon'?7:9;
  if(mode.value==='weapon'){if(Number(start.value)<2)start.value=2;if(Number(start.value)>7)start.value=7}
  try{
   const next=readPreset();
   triggerPresetDraft=Object.keys(next).some(key=>next[key]!==triggerPreset[key])?next:null;
   paintLocalized(presetStatus,triggerPresetDraft?msg('phrase.test_parameters_changed_select_save_this_page'):triggerPresetSaved?msg('phrase.test_parameters_are_saved_in_this_browser'):msg('phrase.using_default_test_parameters'));
  }catch(e){triggerPresetDraft={mode:mode.value,strength:force.value,start:start.value};const invalid=!validTestNumber(force)?force:start;paintLocalized(presetStatus,msg('invalid_integer',{min:invalid.min,max:invalid.max}))}
  refresh();
 };
 mode.onchange=()=>updatePreset();force.oninput=()=>updatePreset();start.oninput=()=>updatePreset();updatePreset();
 return;
 }
 if(page==='vision'){
 const lights=section('手柄灯光','选色时实时试亮；停止调色 5 秒后恢复配置灯色。满意后点「保存为连接灯色」。');
 const picker=input(lights,'vision-color','连接灯色','color',connectionColorHex());picker.oninput=()=>stageColor(picker);
 const colorRow=row('当前选色（左侧预览）',null,true),color=document.createElement('output');color.id='test-color';colorRow.append(color);lights.append(colorRow);
 const savedRow=row('接收器配置灯色',null,true),saved=document.createElement('output');saved.id='test-saved-color';savedRow.append(saved);lights.append(savedRow);
 const colorStatus=document.createElement('p');colorStatus.id='test-color-status';colorStatus.className='hint';colorStatus.setAttribute('role','status');lights.append(colorStatus);
 const saveColor=button(lights,'test-save-color','保存为连接灯色',saveConnectionColor,false);saveColor.classList.add('primary');
 button(lights,'test-lights','再试 5 秒',()=>outputTester.previewColor(connectionColor()));
 const advanced=document.createElement('details');const summary=document.createElement('summary');summary.textContent='高级：玩家指示灯';advanced.append(summary);lights.append(advanced);
 const brightness=select(advanced,'test-brightness','亮度',[[0,'明亮'],[1,'中等'],[2,'暗淡']]);
 const players=select(advanced,'test-players','玩家指示灯',[[4,'1 · 中间'],[10,'2 · 内侧'],[21,'3 · 间隔'],[27,'4 · 外侧与内侧'],[31,'全部点亮']]);
 button(advanced,'test-player-lights','试灯条和玩家灯 5 秒（结束后关闭玩家灯）',()=>outputTester.run('lights',{rgb:connectionColor(),brightness:Number(brightness.value),players:Number(players.value)}));
 return;
 }
 if(page==='audio'){
 const audio=section('音频与麦克风测试','这里的设备选择只用于测试。上方的接收器音量、增益及透传设置可在本页保存。麦克风只显示相对电平，不录音、不回放。');
 const out=select(audio,'test-output',msg('phrase.audio_output'),[['',msg('phrase.system_default_output')]]),source=select(audio,'test-input',msg('phrase.microphone_input'),[['',msg('phrase.system_default_microphone')]]);
 async function devices(){if(!navigator.mediaDevices?.enumerateDevices)throw Error('此浏览器无法列出音频设备，请检查安全上下文');const devices=await navigator.mediaDevices.enumerateDevices();if(!out.isConnected)return;const oldOut=out.value,oldIn=source.value;for(const [s,kind,label,old]of [[out,'audiooutput','输出',oldOut],[source,'audioinput','麦克风',oldIn]]){s.replaceChildren();option(s,'',kind==='audiooutput'?msg('phrase.system_default_output'):msg('phrase.system_default_microphone'));devices.filter(d=>d.kind===kind&&d.deviceId).forEach((d,i)=>option(s,d.deviceId,d.label||`${label} ${i+1}（名称未授权）`,!d.label));s.value=[...s.options].some(o=>o.value===old)?old:''}say('已更新音频设备列表；名称可能需要麦克风权限后才显示')}
 button(audio,'test-devices',msg('phrase.refresh_audio_devices'),devices,false);
 button(audio,'test-tone',msg('phrase.play_1s_test_tone'),async()=>{await applyAudioLive();return audioTester.tone(out.value)},false);
 button(audio,'test-microphone',msg('phrase.start_mic_level_30s'),()=>audioTester.microphone(source.value),false);
 const meter=document.createElement('meter');meter.id='mic-level';meter.min=0;meter.max=100;meter.value=0;paintLocalized(meter,msg('phrase.mic_relative_level'),'aria-label');const reading=document.createElement('span');reading.id='mic-reading';paintLocalized(reading,msg('microphone_level',{pct:0}));audio.append(meter,reading);
 return;
 }
 const gyro=section('陀螺仪 / 加速度','这些参数只影响本浏览器的诊断显示，修改后立即记住，不写入接收器，也不改变游戏输入。转动手柄时陀螺仪数值应随之变化，静止时加速度约等于 1g。');
 const gWrap=document.createElement('div');gWrap.id='gyro-readout';gyro.append(gWrap);
 function axisRow(parent,id,label){const r=row(label);const m=document.createElement('meter');m.id=id+'-meter';m.min=-32768;m.max=32767;m.value=0;m.setAttribute('aria-label',label);const t=document.createElement('span');t.id=id;t.textContent='—';r.append(m,t);parent.append(r);}
 for(const[ax,lb]of[['x','陀螺仪 X'],['y','陀螺仪 Y'],['z','陀螺仪 Z']])axisRow(gWrap,'gyro-'+ax,lb);
 for(const[ax,lb]of[['x','加速度 X'],['y','加速度 Y'],['z','加速度 Z']])axisRow(gWrap,'acc-'+ax,lb);
 const gstamp=document.createElement('p');gstamp.id='gyro-stamp';gstamp.className='hint';gstamp.textContent=LT('等待输入报告…');gWrap.append(gstamp);
 input(gyro,'gyro-smooth','平滑强度（0–95%）','number',Math.round(gyroCfg.smooth*100),0,95).oninput=e=>{const v=Math.max(0,Math.min(95,Number(e.target.value)||0));gyroCfg.smooth=v/100;gyroSaveCfg()};
 input(gyro,'gyro-accsmooth','加速度平滑（0–95%）','number',Math.round((gyroCfg.accSmooth??0.85)*100),0,95).oninput=e=>{const v=Math.max(0,Math.min(95,Number(e.target.value)||0));gyroCfg.accSmooth=v/100;gyroSaveCfg()};
 input(gyro,'gyro-dead','死区（原始单位）','number',gyroCfg.deadband,0,500).oninput=e=>{const v=Math.max(0,Math.min(500,Number(e.target.value)||0));gyroCfg.deadband=v;gyroSaveCfg()};
 const autoBias=select(gyro,'gyro-autobias','自动零偏（仅影响网页显示）',[['1','开启'],['0','关闭']]);autoBias.value=gyroCfg.autoBias?'1':'0';autoBias.onchange=e=>{gyroCfg.autoBias=e.target.value==='1';gyroBias=null;gyroBiasFrames=0;gyroSaveCfg();say(gyroCfg.autoBias?'自动零偏已开启，请保持手柄静止':'自动零偏已关闭，不再自动扣除零偏')};
 const greset=document.createElement('button');greset.id='gyro-defaults';greset.textContent=LT('恢复默认参数');greset.dataset.localTest='true';greset.onclick=()=>{gyroCfg={...GYRO_DEFAULTS};gyroSmooth=null;gyroBias=null;gyroBiasFrames=0;accSmooth=null;gyroSaveCfg();render();say('已恢复默认：平滑 75%、死区 25、自动零偏开启')};gyro.append(greset);
 button(gyro,'gyro-acc-cal','加速度校准（平放）',()=>{
  if(!accSmooth)throw Error('还没有收到输入报告：请先连接手柄并静止 2 秒');
  /* 找到重力主导轴，理论值为该轴 ±1g，其余为 0 */
  const d=accSmooth.map(v=>Math.abs(v)).indexOf(Math.max(...accSmooth.map(v=>Math.abs(v))));
  const sign=accSmooth[d]<0?-1:1;
  accBias=accSmooth.map((v,i)=>v-(i===d?sign*8192:0));
  accSaveBias();
  say(`已校准：${['X','Y','Z'][d]} 轴为重力方向，零偏已记录（`+accBias.map(v=>(v/8192).toFixed(2)).join(' / ')+'）');
 },false);
 button(gyro,'gyro-acc-clear','清除加速度校准',()=>{accBias=null;accSaveBias();say('已清除加速度校准，恢复原始读数')},false);
 button(gyro,'gyro-zero','归零校准',()=>{if(!gyroRaw)throw Error('还没有收到输入报告：请先连接手柄并按下任意键');gyroBase=gyroAxes(gyroRaw,GYRO_OFF);gyroSmooth=null;gyroBias=null;gyroBiasFrames=0;say('已把当前姿态记为零点')},false);
 const gpeak=document.createElement('p');gpeak.id='gyro-peak-result';gpeak.className='hint';gpeak.textContent=LT('转动一下手柄，这里会自动显示最近 2 秒的峰值与主变化轴');gWrap.append(gpeak);
 button(gyro,'gyro-copy','复制原始数据',async()=>{if(!gyroRaw)throw Error('还没有收到输入报告');const hex=[...gyroRaw].map(b=>b.toString(16).padStart(2,'0')).join(' ');try{await navigator.clipboard.writeText(hex);say('已复制，可直接发回用于校正偏移')}catch{say(hex)}},false);
}
async function exclusive(fn){if(busy)return;busy=true;try{refresh();await fn()}catch(e){say(e.message??String(e),'error')}finally{busy=false;try{refresh()}catch(e){console.error(e)}}}
function hidWait(promise,label,ms=5000){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error(`${label}超时，请关闭其他配置页并重新插拔接收器后重试。`)),ms);Promise.resolve(promise).then(v=>{clearTimeout(timeout);resolve(v)},e=>{clearTimeout(timeout);reject(e)})})}
async function readCfg(d=device){return hidWait(d.receiveFeatureReport(0xf7),'读取配置')}
/* ---- Compatibility diagnostics (firmware 0xFA) ----
 * The single most useful bundle for a support ticket: model, address, EIR name,
 * handshake result, pairing/scan counters and audio health.  Read-only; the
 * card is skipped automatically when the firmware has no 0xFA report. */
let diagText='',diagTick=0;
const dhex=n=>n.toString(16).toUpperCase().padStart(2,'0');
function paintDiag(b,fw){
 const u16=i=>b[i]|(b[i+1]<<8);
 const addr=[...b.slice(6,12)].map(dhex).join(':');
 const name=new TextDecoder().decode(b.slice(26,58)).replace(/\0+$/,'').trim();
 const flags=b[1],edge=!!(flags&1),hsOk=!!(flags&2);
 const board=b[58]===1?'v1':b[58]===2?'v1.2':'unknown';
 const usb=b[59]===1?'High-Speed':b[59]===0?'Full-Speed':b[59]===2?'not configured':'n/a';
 diagText=[
  `Model: ${edge?'DualSense Edge':(hsOk?'DualSense (non-Edge)':'unknown')}`,
  `Address: ${addr||'-'}`,
  `EIR name: ${name||'(no name in EIR)'}`,
  `HID handshake: ${hsOk?'ok':'incomplete'} (0x${dhex(b[3])})`,
  `Bonded: ${b[4]}   Blacklist: ${b[5]}`,
  `Scan rounds: ${u16(12)}   connect fail: ${u16(14)}   handshake fail: ${u16(16)}`,
  `Encode: ${(u16(18)/10).toFixed(1)} ms avg / ${(u16(20)/10).toFixed(1)} ms max`,
  `PCM overruns: ${u16(22)}   fill: ${u16(24)}`,
  `Board: ${board}   USB: ${usb}`,
  `Firmware: ${fw||'-'}`,
  `Captured: ${new Date().toISOString().slice(0,19).replace('T',' ')} UTC`
 ].join('\n');
 let box=document.getElementById('diag-card');
 if(!box){
  box=document.createElement('section');
  box.id='diag-card';box.className='test-card';
  const h=document.createElement('h3');h.textContent='Compatibility diagnostics';box.append(h);
  const pre=document.createElement('pre');pre.id='diag-text';
  pre.style.cssText='white-space:pre-wrap;font-size:12px;line-height:1.5;margin:8px 0;user-select:text';
  box.append(pre);
  const btn=document.createElement('button');btn.textContent='Copy diagnostics';
  btn.onclick=async()=>{try{await navigator.clipboard.writeText(diagText);btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy diagnostics',1500)}catch{btn.textContent='Copy failed - select manually'}};
  box.append(btn);
  const dl=document.createElement('button');dl.textContent='Download .txt';dl.style.marginLeft='8px';
  dl.onclick=()=>{const blob=new Blob([diagText],{type:'text/plain'});const a=document.createElement('a');
   a.href=URL.createObjectURL(blob);a.download='ds5dongle-diagnostics.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
  box.append(dl);
  /* battery-card is a metric tile inside .axis-grid; appending after the tile
   * squeezed the panel into a grid cell.  Place it after the whole grid so it
   * spans the device panel width. */
  const tile=document.getElementById('battery-card');
  const grid=tile?.closest?.('.axis-grid');
  if(grid)grid.insertAdjacentElement('afterend',box);
  else if(tile)tile.insertAdjacentElement('afterend',box);
  else document.body.append(box);
 }
 const pre=document.getElementById('diag-text');
 if(pre)pre.textContent=diagText;
}
async function refreshDiag(){
 if(!device||busy)return;
 try{
  const r=await hidWait(device.receiveFeatureReport(0xfa),'read diagnostics',1000);
  const b=payload(r,0xfa,26);
  paintDiag(b,firmwareVersion);
 }catch{
  /* Firmware older than oc46 has no 0xFA report.  Show the card with an
   * explanation instead of hiding it, so users know the feature exists. */
  paintDiagNotice('Diagnostics unavailable: firmware too old (needs oc46 or newer).');
 }
}
function paintDiagNotice(text){
 if(document.getElementById('diag-card'))return;
 const box=document.createElement('section');
 box.id='diag-card';box.className='test-card';
 const h=document.createElement('h3');h.textContent='Compatibility diagnostics';box.append(h);
 const p=document.createElement('p');p.id='diag-text';
 p.style.cssText='font-size:12px;line-height:1.5;margin:8px 0';
 p.textContent=text;box.append(p);
 const tile=document.getElementById('battery-card');
 const grid=tile?.closest?.('.axis-grid');
 if(grid)grid.insertAdjacentElement('afterend',box);
 else if(tile)tile.insertAdjacentElement('afterend',box);
 else document.body.append(box);
}async function saveStatus(d,check,shift){
 for(let attempt=0;attempt<14;attempt++){
  check();
  const b=payload(await hidWait(d.receiveFeatureReport(0xf9),'确认保存状态',1000),0xf9,13);
  check();
  if(b[13]!==0xd3||!(b[16]&2))return false;
  const state=(b[16]>>shift)&3;
  if(state===2)return true;
  if(state===3)throw Error('Flash 写入失败，设置可能已临时应用。请重试保存。');
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('未能确认 Flash 写入结果，请重试保存。');
}
async function readTable(p){const d=device;await hidWait(d.sendFeatureReport(0xfb,command(3,[p],127)),'选择映射组');const m=remapRead(await hidWait(d.receiveFeatureReport(0xfb),'读取按键映射'),p);if(device!==d)throw Error('读取映射期间设备已断开');activeProfile=m.active;return m}
function moveSticks(axes){
 const offset=v=>{v=Number.isFinite(v)?Math.max(0,Math.min(255,v)):128;return v>=127&&v<=128?0:(v<127?(v-127)/127:(v-128)/127)*9};
 for(let i=0;i<stickParts.length;i++){
  const {node,base}=stickParts[i],dx=offset(axes[i*2]),dy=offset(axes[i*2+1]);
  node.setAttribute('transform',`translate(${dx.toFixed(2)} ${dy.toFixed(2)}) ${base}`.trim());
  const amount=Math.min(1,Math.hypot(dx,dy)/9);
  node.classList.toggle('moving',amount>0);
  node.style.setProperty('--stick-tint',`${(amount*45).toFixed(1)}%`);
  node.style.setProperty('--stick-glow',`rgba(164,119,240,${(amount*.3).toFixed(3)})`);
 }
}
function resetLiveVisuals(){
 if(!visualInputActive)return;
 visualInputActive=false;
 for(const {node,base}of stickParts){if(base)node.setAttribute('transform',base);else node.removeAttribute('transform');node.classList.remove('moving');node.style.removeProperty('--stick-tint');node.style.removeProperty('--stick-glow')}
 for(const stop of $('art').querySelectorAll('[data-edge]'))stop.setAttribute('offset','0');
 $('art').querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));
}
function clearInput(){lastInput=0;lastPaint=0;touchTrail=[];for(const d of touchDots)d.style.display='none';resetLiveVisuals();paintBattery(null);paintLatency(null);for(const id of ['left-axis','right-axis','triggers','battery','gyro-live','accel-live'])$(id).textContent='—'}

const savedDrafts=new WeakMap();
function disconnected(){gyroBase=null;gyroRaw=null;gyroSmooth=null;gyroBias=null;gyroBiasFrames=0;accSmooth=null;void stopTests();epoch++;if(device){if(dirty())savedDrafts.set(device,{draft,profile,table:mapDirty?table.slice():null});device.removeEventListener('inputreport',onInput)}device=null;firmwareVersion=null;paintLocalized($('version'),msg('console_name'));paintFirmware();baseline=null;draft={};table=null;tableBaseline=null;telemetry=null;mapDirty=false;restartNeeded=false;clearInput();render()}
async function load(){const cfg=decode(await readCfg());const m=await readTable(profile);baseline=cfg;draft={};table=m.table;tableBaseline=m.table.slice();mapDirty=false;render()}
const HID_FILTERS=[{vendorId:0x054c,productId:0x0ce6},{vendorId:0x054c,productId:0x0df2}];
const pickConfigDevice=list=>list?.find(d=>d.collections.some(c=>c.featureReports.some(r=>r.reportId===0xf7)));
async function attachDevice(d){
 if(!d)throw Error('未选择包含配置报告的接收器接口');
 lastColorWrite=null;colorSaveFailed=false;
 let expired=false;const connectionEpoch=epoch;
 const step=async(label,fn)=>{say(label+'…');let result;try{result=await hidWait(fn(),label,label==='验证设备身份'?12000:5000)}catch(e){throw Error(label+'：'+(e.message??e))}if(expired||epoch!==connectionEpoch)throw Error('连接已中断，请重新连接');return result};
 try{
  if(!d.opened)await step('打开接收器',()=>{const opening=d.open();opening.then(()=>{if(expired)void d.close().catch(()=>{})},()=>{});return opening});
  if(PRODUCTION_AUTH){await step('验证设备身份',()=>authenticateHid(d,AUTH_AUTHORITY));say('设备身份验证通过')}
  const v=payload(await step('读取固件信息',()=>d.receiveFeatureReport(0xf8)),0xf8,1);const fw=new TextDecoder().decode(v).replace(/\0.*$/s,'');if(!/^(LCT616|M0S|BL618)-DS5 /.test(fw))throw Error('这不是本工程支持的 BL616 接收器');
  const cfg=decode(await step('读取配置',()=>d.receiveFeatureReport(0xf7)));
   let m=null,mapError=null;
   try{
    await step('选择映射组',()=>d.sendFeatureReport(0xfb,command(3,[profile],127)));
    m=remapRead(await step('读取按键映射',()=>d.receiveFeatureReport(0xfb)),profile);activeProfile=m.active;
   }catch(e){if(epoch!==connectionEpoch||!d.opened)throw e;mapError=e}
   const pending=savedDrafts.get(d);
   device=d;firmwareVersion=fw;paintFirmware();baseline=cfg;draft=pending?.draft??{};table=m?.table??null;tableBaseline=table?.slice()??null;if(m){if(pending?.table&&pending.profile===profile)table=pending.table;savedDrafts.delete(d)}mapDirty=false;restartNeeded=restartDevices.has(d);epoch++;render();d.addEventListener('inputreport',onInput);paintLocalized($('version'),fw);$('device-title').textContent=d.productId===0x0df2?'DualSense Edge':'DualSense';showArt(d.productId===0x0df2);say(mapError?'已连接，但映射读取失败：'+mapError.message:pending?'已恢复此接收器的未保存草稿。':'已读取当前设置。修改后点击应用并保存。',mapError?'error':'info');return true;
 }catch(e){expired=true;disconnected();if(d.opened)await hidWait(d.close(),'关闭设备接口',500).catch(()=>{});throw e}
}
/* 浏览器已经记住授权时，无需点击即可静默重连（老用户零操作） */
async function autoReconnect(){
 if(device)return false;
 if(!navigator.hid?.getDevices)return false;
 let known=[];try{known=await navigator.hid.getDevices()}catch{return false}
 const d=pickConfigDevice(known);
 if(!d)return false;
 try{await exclusive(()=>attachDevice(d));return Boolean(device)}catch{return false}
}
$('connect').onclick=()=>exclusive(async()=>{
 if(device){const d=device;await hidWait(stopTests(),'停止测试',3000).catch(()=>{});disconnected();if(d.opened)await hidWait(d.close(),'关闭设备接口',1000).catch(()=>{});say(msg('phrase.disconnected'));return}
 if(!navigator.hid)throw Error('请使用支持 WebHID 的 Chrome / Edge');
 const list=await navigator.hid.requestDevice({filters:HID_FILTERS});
 await attachDevice(pickConfigDevice(list));
});
 navigator.hid?.addEventListener('disconnect',e=>{if(e.device===device){restartDevices.delete(e.device);disconnected();say(msg('phrase.dongle_disconnected_keep_this_page_open_and'))}});
$('revert').onclick=()=>{if($('revert').disabled)return;const scoped=scopedSavePages.has(page);if(scoped){for(const key of Object.keys(settingsToSave()))delete draft[key];if(page==='feel')triggerPresetDraft=null}else{draft={};table=tableBaseline?.slice()??null;savedDrafts.delete(device);mapDirty=false}render();say(scoped?'已丢弃本页草稿，其他页面的改动保留。':'已丢弃未提交的草稿。此操作不会撤回已发送到设备的配置。')};
$('reload').onclick=()=>{if(dirty()&&!confirm(messageText(msg('phrase.reloading_discards_unsaved_changes_continue'))))return;return exclusive(async()=>{lastColorWrite=null;colorSaveFailed=false;await load();say(msg('phrase.settings_reloaded_from_device'))})};
function saveSession(){
 const d=device,myEpoch=epoch;
 const check=()=>{if(d!==device||myEpoch!==epoch)throw Error('保存期间设备已断开')};
 const send=async(id,bytes,label)=>{check();await hidWait(d.sendFeatureReport(id,bytes),label);check()};
 return {d,check,send};
}
async function writeSettings(wanted,{d,check,send}){
 const updated=patch(await readCfg(d),wanted);
 await send(0xf6,command(1,updated),'应用配置');
 const readback=decode(await readCfg(d));check();
 if(Object.entries(wanted).some(([key,value])=>!Number.isFinite(readback[key])||Math.abs(readback[key]-value)>0.00001))throw Error('配置回读不一致，未请求保存');
 await send(0xf6,command(2),'请求保存配置');
 say(msg('phrase.settings_applied_confirming_the_save'));
 return {readback,confirmed:await saveStatus(d,check,2)};
}
async function stopBeforeSave(check){
 if(!await hidWait(stopTests(),'停止测试'))throw Error('无法停止手柄测试，请先断开手柄复位。');
 check();
}
async function applySavedColor(readback,confirmed,{d,check}){
 const saved=confirmed?'已保存连接灯色。':'已请求保存连接灯色，旧固件无法确认写入。';
 if(telemetry?.[13]!==0xd3||telemetry[14]!==7)return msg('joined_status',{first:legacy(saved),second:legacy('未确认手柄在线，下次连接时会发送配置灯色。')});
 try{
  check();
  const rgb=colorFields.map(key=>readback[key]);
  await hidWait(d.sendReport(2,testOutput('lights',{rgb},d.productId===0x0df2)),'即时发送灯色',1500);
  check();
  return msg('joined_status',{first:legacy(saved),second:legacy('已向接收器发送即时换色指令。')});
 }catch{
  return msg('joined_status',{first:legacy(saved),second:legacy('即时换色指令未送达，请重新连接手柄。')});
 }
}
function saveConnectionColor(){
 if(!device||busy||!colorFields.some(key=>key in draft))return;
 colorSaving=true;
 return exclusive(async()=>{
  const session=saveSession(),rgb=connectionColor();
  try{
   if(rgb.every(value=>value===0))throw Error('当前固件无法保存纯黑灯色。');
   await stopBeforeSave(session.check);
   const {readback,confirmed}=await writeSettings(Object.fromEntries(colorFields.map((key,i)=>[key,rgb[i]])),session);
   for(const key of colorFields){baseline[key]=readback[key];delete draft[key]}
   colorSaveFailed=false;
   const status=await applySavedColor(readback,confirmed,session);
   if(device===session.d){lastColorWrite=status;say(status)}
  }catch(e){if(device===session.d)colorSaveFailed=true;throw e}
  finally{colorSaving=false}
 });
}
$('save').onclick=()=>{
 if($('save').disabled)return;
 const preset=page==='feel'?triggerPresetDraft:null;
 if(preset&&!validTriggerPreset(preset)){say(msg('phrase.correct_the_trigger_test_parameters_first'),'error');return}
 for(const c of document.querySelectorAll('#controls input:not([data-local-test])'))if(c.checkValidity&&!c.checkValidity()){say(msg('phrase.correct_the_invalid_setting_first'),'error');c.reportValidity?.();return}
 return exclusive(async()=>{
  const scoped=scopedSavePages.has(page);
  const session=saveSession(),{d,check,send}=session,wanted=settingsToSave(),requiresRestart=!scoped&&needsRestart();
  const writingDevice=Object.keys(wanted).length>0||(!scoped&&mapDirty);
  let browserSaved=false;
  if(preset){
   try{localStorage.setItem(triggerPresetKey,JSON.stringify(preset))}
   catch{throw Error('无法保存测试参数：浏览器存储不可用，接收器设置未提交。')}
   triggerPreset=preset;triggerPresetSaved=true;triggerPresetDraft=null;browserSaved=true;
   paintLocalized($('trigger-preset-status'),msg('phrase.test_parameters_saved_in_this_browser'));
  }
  if(!writingDevice){render();say(msg('phrase.test_parameters_saved_in_this_browser'));return}
  try{
  await stopBeforeSave(check);
  if(['led_r','led_g','led_b'].some(key=>key in wanted)&&connectionColorHex()==='#000000')throw Error('当前固件无法保存纯黑灯色。');
  let confirmed=true,colorStatus=null;
  if(Object.keys(wanted).length){
   const result=await writeSettings(wanted,session);
   const readback=result.readback;confirmed=result.confirmed;
   restartNeeded=restartNeeded||Object.keys(wanted).some(k=>restartFields.has(k));if(restartNeeded)restartDevices.add(d);
   baseline=readback;for(const key of Object.keys(wanted))delete draft[key];
   if(colorFields.some(key=>key in wanted)){
    colorSaveFailed=false;colorStatus=await applySavedColor(readback,confirmed,session);
    check();lastColorWrite=colorStatus;
   }
  }
  if(mapDirty&&!scoped){
   try{
    const expected=table.slice();
    await send(0xfb,remapWrite(profile,expected),'写入按键映射');
    const m=await readTable(profile);check();
    if(expected.some((v,i)=>m.table[i]!==v))throw Error('回读不一致');
    say('映射已应用，正在确认保存…');
    confirmed=(await saveStatus(d,check,4))&&confirmed;
    tableBaseline=m.table.slice();mapDirty=false;
   }catch(e){throw Error('映射未确认保存：'+(e.message??e))}
  }
  check();restartNeeded=restartNeeded||requiresRestart;if(restartNeeded)restartDevices.add(d);render();const saveResult=legacy(confirmed?'已保存到接收器。':'已应用并请求保存。旧固件无法确认 Flash 写入，请稍候再拔出。');
  const parts=[browserSaved?msg('phrase.test_parameters_saved_in_this_browser'):null,colorStatus].filter(Boolean);
  say(parts.reduce((first,second)=>msg('joined_status',{first,second}),saveResult))
  }catch(e){if(browserSaved)throw Error('测试参数已保存到此浏览器。接收器：'+(e.message??e));throw e}
 });
};
$('reboot').onclick=()=>exclusive(async()=>{
 const d=device,myEpoch=epoch;
 await hidWait(stopTests(),'停止测试');
 const check=()=>{if(device!==d||epoch!==myEpoch)throw Error('设备已断开，重启流程已取消')};
 await restartReceiver({read:async()=>{check();return payload(await hidWait(d.receiveFeatureReport(0xf9),'读取断开状态',1000),0xf9,17)},send:async cmd=>{check();await hidWait(d.sendFeatureReport(0xf6,command(cmd)),'发送重启流程指令',1000)},notify:say});
 restartDevices.delete(d);disconnected();if(d.opened)await hidWait(d.close(),'关闭设备接口',500).catch(()=>{});
 say(msg('phrase.controller_disconnected_and_restart_requested_click_connect'));
});
function renderRemap(box){const state=document.createElement('p');state.id='mapping-state';state.className='hint';state.setAttribute('role','status');box.append(state);const r=row(msg('map_group'),msg('map_group_help'));const p=document.createElement('select');[1,2].forEach(group=>option(p,group-1,msg('map_group_number',{group})));p.value=profile;p.onchange=()=>{const next=Number(p.value);if(mapDirty){p.value=profile;say('请先保存或重新读取，再切换映射组');return}exclusive(async()=>{try{const m=await readTable(next);profile=next;table=m.table;tableBaseline=m.table.slice();render()}catch(e){p.value=profile;throw e}})};r.append(p);box.append(r);
 const activate=document.createElement('button');paintLocalized(activate,msg('map_use_group'));activate.onclick=()=>exclusive(async()=>{if(mapDirty)throw Error('请先保存本组更改再切换');await hidWait(device.sendFeatureReport(0xfb,command(5,[profile],127)),'切换映射组');const m=await readTable(profile);if(m.active!==profile)throw Error('切换映射组失败');say(`已切换到映射组 ${profile+1}`)});box.append(activate);
 const source=document.createElement('select');source.id='mapping-source';names.forEach((n,i)=>option(source,i,n));source.value=remapSource;const sr=row(msg('map_source'),msg('map_source_help'));sr.append(source);box.append(sr);const area=document.createElement('div');box.append(area);
 function edit(){const id=Number(source.value),o=id*4,t=table?.[o]??0;remapSource=id;paintMappingSource();area.replaceChildren();const tr=row(msg('map_to'));const type=document.createElement('select');[msg('map_controller'),msg('map_keyboard'),msg('map_mouse')].forEach((n,i)=>option(type,i,n));type.value=t;type.onchange=()=>{if(!table)return;table[o]=Number(type.value);table[o+1]=table[o]===0?id:0;table[o+2]=0;table[o+3]=0;mapDirty=true;edit();refresh()};tr.append(type);area.append(tr);
 const vr=row(t===1?msg('map_keycode'):msg('map_target'));let target;if(t===1){target=document.createElement('input');target.type='number';target.min=0;target.max=255;target.value=table?.[o+1]??0;target.oninput=()=>{const v=Number(target.value);if(target.value===''||!Number.isInteger(v)||v<0||v>255){paintLocalized(target,msg('invalid_integer',{min:0,max:255}),'validationMessage');return}paintLocalized(target,'','validationMessage');table[o+1]=v;mapDirty=true;refresh()}}
 else{target=document.createElement('select');(t===0?names:[msg('map_mouse_left'),msg('map_mouse_right'),msg('map_mouse_middle')]).forEach((n,i)=>option(target,i,n));target.value=table?.[o+1]??id;target.onchange=()=>{table[o+1]=Number(target.value);mapDirty=true;refresh()}}vr.append(target);area.append(vr);
 if(t!==0){const rr=row(msg('map_block_original'));const c=document.createElement('input');c.type='checkbox';c.checked=!!(table?.[o+3]&1);c.onchange=()=>{table[o+3]=(table[o+3]&~1)|+c.checked;mapDirty=true;refresh()};rr.append(c);area.append(rr)}
 if(t===1){for(const [label,offset]of [[msg('map_modifiers'),2],[msg('map_flags'),3]]){const rr=row(label);const c=document.createElement('input');c.type='number';c.min=0;c.max=offset===3?3:255;c.value=table?.[o+offset]??0;c.oninput=()=>{const v=Number(c.value);if(c.value===''||!Number.isInteger(v)||v<0||v>Number(c.max)){paintLocalized(c,msg('invalid_integer',{min:0,max:c.max}),'validationMessage');return}paintLocalized(c,'','validationMessage');table[o+offset]=v;mapDirty=true;refresh()};rr.append(c);area.append(rr)}}
 const hint=document.createElement('p');hint.className='hint';paintLocalized(hint,msg('map_keycode_help'));area.append(hint);refresh()}
 source.onchange=edit;edit()
}
function paintLight(){const rgb=['led_r','led_g','led_b'].map(k=>val(k)??210);$('art').style.setProperty('--ctl-led',`rgb(${rgb.join(',')})`)}
function showArt(edge){$('art').innerHTML=edge?EDGE_ART:STANDARD_ART;stickParts=['stick-l','stick-r'].map(id=>$('art').querySelector(`[data-part="${id}"]`)).map(node=>({node,base:node.getAttribute('transform')??''}));visualInputActive=false;for(const p of $('art').querySelectorAll('[data-part]')){p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',p.dataset.part)}paintLight();paintMappingSource()}
function paintTriggerSelection(){
 const status=$('trigger-selection');
 if(status)paintLocalized(status,triggerSide==='left'?msg('phrase.l2_selected_press_the_test_button_to'):msg('phrase.r2_selected_press_the_test_button_to'));
}
function selectPart(target){
 const id=target.closest('[data-part]')?.dataset.part;
 if(!id||flashSession?.isBusy())return;
 const isTrigger=id==='l2'||id==='r2';
 if(isTrigger&&page!=='remap'){
  void stopTests();
  triggerSide=id==='l2'?'left':'right';
  qaGoto('feel','test-trigger');
  $('trigger-side').value=triggerSide;
  paintTriggerSelection();
  const card=$('test-trigger').closest('.test-card');
  clearTimeout(triggerHighlight);card.classList.add('trigger-target');
  triggerHighlight=setTimeout(()=>card.classList.remove('trigger-target'),1800);
  return;
 }
 if(!(isTrigger&&page==='remap')){
  void stopTests();page=id==='touchpad'?'touch':['speaker','mute'].includes(id)?'audio':id==='lightbar'?'vision':id==='body'?'feel':'remap';render();
 }
 const idx=sourceParts.indexOf(id),source=$('mapping-source');
 if(page==='remap'&&idx>=0&&source){source.value=idx;source.dispatchEvent(new Event('change'))}
}
$('art').onclick=e=>selectPart(e.target);$('art').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPart(e.target)}};
function paintInput(i,source){lastInput=Date.now();if(lastInput-lastPaint<33)return;lastPaint=lastInput;visualInputActive=true;moveSticks(i.axes);for(const [n,v]of [['l2',i.triggers[0]],['r2',i.triggers[1]]])for(const stop of $('art').querySelectorAll(`#ctl-${n}-fill [data-edge]`))stop.setAttribute('offset',String(v/255));paintLocalized($('input-state'),source==='接收器 HID'?msg('live_input_hid'):msg('live_input_browser'));$('left-axis').textContent=`${i.axes[0]} / ${i.axes[1]}`;$('right-axis').textContent=`${i.axes[2]} / ${i.axes[3]}`;$('triggers').textContent=i.triggers.map(v=>Math.round(v/255*100)+'%').join(' / ');$('art').querySelectorAll('[data-part]').forEach(p=>p.classList.toggle('pressed',i.parts.has(p.dataset.part)))}
/* ---- 陀螺仪 / 加速度（六轴）----
 * 偏移按 DualSense USB 输入报告布局，相对 p[0]=LX：
 * 陀螺仪 16..21 -> p[15..20]，加速度 22..27 -> p[21..26]，int16 小端。
 * 若实测数值不随转动变化，用「复制原始数据」回传即可校正。 */
const GYRO_OFF=15, ACC_OFF=21;
/* performance 在部分环境（测试沙箱 / 老浏览器）不存在，回退到 Date.now */
const nowMs=()=>(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
let gyroBase=null, gyroRaw=null, gyroStamp=0;
let gyroPeak={start:0,max:[0,0,0]};   /* 最近 2 秒滚动峰值，常开、无需点击 */
/* 显示用：指数平滑 + 自动零偏 + 死区。
 * MEMS 陀螺仪静止时有零偏与噪声，直接显示原始值会一直跳；
 * 这里在显示层做处理，不影响上报给系统的数据。 */
let gyroSmooth=null, gyroBias=null, gyroBiasFrames=0, accSmooth=null;
/* 加速度零偏校准：把"平放"这一姿态的读数与理论值(0,±1,0)对比求得偏置 */
let accBias=null;
try{const j=JSON.parse(localStorage.getItem('ds5.accBias')||'null');if(Array.isArray(j)&&j.length===3)accBias=j}catch(e){}
function accSaveBias(){try{if(accBias)localStorage.setItem('ds5.accBias',JSON.stringify(accBias));else localStorage.removeItem('ds5.accBias')}catch(e){}}
/* 显示处理参数：可在「测试中心 → 陀螺仪」里调，保存在本机浏览器 */
const GYRO_DEFAULTS={smooth:0.75,deadband:25,autoBias:true,accSmooth:0.85};
let gyroCfg={...GYRO_DEFAULTS};
try{const saved=JSON.parse(localStorage.getItem('ds5.gyro')||'null');if(saved&&typeof saved==='object')gyroCfg={...gyroCfg,...saved}}catch(e){}
function gyroSaveCfg(){try{localStorage.setItem('ds5.gyro',JSON.stringify(gyroCfg))}catch(e){}}
function s16(p,o){const v=(p[o+1]<<8)|p[o];return v>32767?v-65536:v}
function gyroAxes(p,off){return [0,1,2].map(i=>s16(p,off+i*2))}
function onGyro(p){
 if(p.length<28)return;
 gyroRaw=p;
 if(!$('gyro-readout') && !$('gyro-live') && !$('accel-live'))return;
 const now=nowMs();
 if(now-gyroStamp<50)return;            /* 节流 20 Hz，避免高频 DOM 更新 */
 gyroStamp=now;
 const gRaw=gyroAxes(p,GYRO_OFF),acc=gyroAxes(p,ACC_OFF),base=gyroBase||[0,0,0];
 /* 指数平滑 */
 if(!gyroSmooth)gyroSmooth=gRaw.slice();
 for(let i=0;i<3;i++)gyroSmooth[i]=gyroSmooth[i]*gyroCfg.smooth+gRaw[i]*(1-gyroCfg.smooth);
 /* 自动零偏：连接后前 20 帧取平均（此时通常静止）；手动「归零校准」会覆盖它 */
 if(!gyroBias){gyroBias=[0,0,0];gyroBiasFrames=0}
 if(gyroCfg.autoBias&&!gyroBase&&gyroBiasFrames<20){for(let i=0;i<3;i++)gyroBias[i]=(gyroBias[i]*gyroBiasFrames+gRaw[i])/(gyroBiasFrames+1);gyroBiasFrames++}
 /* 送到界面的是扣掉零偏、过死区后的平滑值 */
 const g=[0,1,2].map(i=>{const v=gyroSmooth[i]-(gyroBase?base[i]:gyroBias[i]);return Math.abs(v)<gyroCfg.deadband?0:v});
 /* 加速度：只平滑，不扣零偏（重力是真实读数） */
 const A=gyroCfg.accSmooth ?? 0.85;
 if(!accSmooth)accSmooth=acc.slice();
 for(let i=0;i<3;i++)accSmooth[i]=accSmooth[i]*A+acc[i]*(1-A);
 const accS=accSmooth;
 const accC=accS.map((v,i)=>v-(accBias?accBias[i]:0));
 const accMag=Math.sqrt(accC[0]*accC[0]+accC[1]*accC[1]+accC[2]*accC[2])/8192;
 ['x','y','z'].forEach((ax,i)=>{
  const gv=g[i],av=Math.round(accC[i]);
  const gt=$('gyro-'+ax),gm=$('gyro-'+ax+'-meter');
  if(gt)gt.textContent=String(Math.round(gv));
  if(gm)gm.value=Math.max(-32768,Math.min(32767,gv));
  const at=$('acc-'+ax),am=$('acc-'+ax+'-meter');
  if(at)at.textContent=String(av);
  if(am)am.value=Math.max(-32768,Math.min(32767,av));
 });
 const gl=$('gyro-live'),al=$('accel-live');
 if(gl)gl.textContent=`${(g[0]/1024).toFixed(2)} / ${(g[1]/1024).toFixed(2)} / ${(g[2]/1024).toFixed(2)}`;
 if(al)al.textContent=`${(accC[0]/8192).toFixed(2)} / ${(accC[1]/8192).toFixed(2)} / ${(accC[2]/8192).toFixed(2)}  |a|=${accMag.toFixed(2)}`;
 const st=$('gyro-stamp');
 if(st)st.textContent=LT(gyroBase?'已归零，显示相对值':'实时数据（未归零）');
 /* 最近 2 秒的滚动峰值：一直显示，用户只需转动手柄 */
 if(now-gyroPeak.start>2000)gyroPeak={start:now,max:[0,0,0]};
 for(let i=0;i<3;i++){
  const v=Math.abs(g[i]);
  if(v>gyroPeak.max[i])gyroPeak.max[i]=v;
 }
 const m=gyroPeak.max,names=['X','Y','Z'];
 if(m[0]+m[1]+m[2]>50){
  const top=m.indexOf(Math.max(...m));
  const deg=m.map(v=>(v/1024).toFixed(2));
  const r=$('gyro-peak-result');
  if(r)r.textContent=`最近 2 秒峰值：X ${deg[0]}  Y ${deg[1]}  Z ${deg[2]} °/s → 主变化轴 ${names[top]}`;
 }
}
/* ---- 触摸板实时指示 ----
 * DS5 输入报告里的触摸数据（相对 p[0]=LX）：
 *   touch0 = p[32..35]，touch1 = p[36..39]
 *   b0 bit7 = 未接触；x = (b2&0x0F)<<8 | b1；y = b3<<4 | (b2>>4)
 *   触控板分辨率 1920 x 1080
 * 把触点画到手柄图 [data-part="touchpad"] 的区域内。
 */
let touchBox=null, touchDots=[], touchTrail=[];
const TOUCH_TRAIL=14;              /* 拖尾长度（帧） */
function touchFirst(p){
 for(const off of [32,36]){
  if(off+3>=p.length)continue;
  if(p[off]&0x80)continue;                       /* bit7 = 未接触 */
  const x=((p[off+2]&0x0F)<<8)|p[off+1];
  const y=(p[off+3]<<4)|((p[off+2]&0xF0)>>4);
  return {x:Math.min(1,x/1920),y:Math.min(1,y/1080)};
 }
 return null;
}
function setupTouchDot(){
 touchDots=[];touchBox=null;touchTrail=[];
 const art=$('art');if(!art)return;
 const pad=art.querySelector('[data-part="touchpad"]');if(!pad)return;
 const svg=art.querySelector('svg');if(!svg)return;
 try{touchBox=pad.getBBox()}catch(e){return}
 if(!touchBox||!touchBox.width||!touchBox.height)return;
 const base=Math.max(4,Math.min(touchBox.width,touchBox.height)*0.07);
 for(let i=0;i<TOUCH_TRAIL;i++){
  const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
  const f=1-i/TOUCH_TRAIL;                      /* 越旧越小越淡 */
  dot.setAttribute('r',String(base*(0.35+0.65*f)));
  dot.setAttribute('fill','#22C55E');
  dot.setAttribute('opacity',String(0.15+0.75*f));
  dot.setAttribute('pointer-events','none');
  dot.style.display='none';
  svg.appendChild(dot);
  touchDots.push(dot);
 }
}
function paintTouch(p){
 const art=$('art');if(!art)return;
 if(!touchDots.length||!touchDots[0].isConnected)setupTouchDot();
 if(!touchDots.length||!touchBox)return;
 const t=touchFirst(p);
 if(!t){
  touchTrail=[];
  for(const d of touchDots)d.style.display='none';
  return;
 }
 touchTrail.push(t);
 if(touchTrail.length>TOUCH_TRAIL)touchTrail.shift();
 for(let i=0;i<TOUCH_TRAIL;i++){
  const d=touchDots[i],pt=touchTrail[touchTrail.length-1-i];
  if(!pt){d.style.display='none';continue}
  d.style.display='';
  d.setAttribute('cx',String(touchBox.x+pt.x*touchBox.width));
  d.setAttribute('cy',String(touchBox.y+pt.y*touchBox.height));
 }
}
function onInput(e){
 if(e.device!==device||e.reportId!==1||$('gamepad').value!=='')return;
 const bytes=new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength);
 const i=inputParts(bytes);
 if(i)paintInput(i,'接收器 HID');
 paintTouch(bytes);
 onGyro(bytes);
}
let batterySignature='';
function paintBattery(b){
 const pct=b?.[11],state=b?.[12];
 const signature=`${pct}:${state}:${b?.[0]}:${b?.[1]}:${b?.[13]}:${b?.[14]}:${b?.[15]}:${b?.[16]}`;
 if(signature===batterySignature)return;
 batterySignature=signature;
 const known=Number.isInteger(pct)&&pct>=0&&pct<=100;
 const low=known&&pct<=10&&state===0;
 const charging=known&&pct<=10&&state===1;
 $('battery').textContent=known?`${pct}%`:'—';
 $('battery-card').dataset.level=low?'low':'normal';
 $('battery-alert').hidden=!low&&!charging;
 $('battery-alert').dataset.kind=charging?'charging':'low';
 paintLocalized($('battery-warning'),low?msg('battery_low',{pct}):charging?msg('battery_low_charging',{pct}):'');
 /* 信号 / 配对数量 / USB 速率（遥测已包含，见 usb_gamepad.c 遥测布局） */
 const ls=$('link-status');
 if(ls){
  if(!b){paintLocalized(ls,msg('link_summary',{signal:msg('link_signal_missing'),count:'—',speed:'—'}))}
  else{
   const rssi=b[0]>127?b[0]-256:b[0];
    const links=b.length>=17&&b[13]===0xd3;
    const signal=links&&b[14]===7&&rssi!==1&&rssi!==127?msg('link_signal_rssi',{value:rssi}):msg('link_signal_missing');
    const speed=links&&(b[16]&2)?((b[1]&0x40)?'HS':'FS'):msg('link_speed_unknown');
    paintLocalized(ls,msg('link_summary',{signal,count:links?b[15]:'—',speed}));
  }
 }
 paintLocalized($('battery-explanation'),low?msg('phrase.fast_blue_flashing_means_low_battery_not'):charging?msg('phrase.controller_is_charging_the_low_battery_flash'):'');
}
function paintLatency(b){if(!$('latency-average'))return;   /* 面板已移除时静默跳过 */
 const l=b?decodeLatency(b):null,ms=v=>(v/1000).toFixed(3)+' ms';
 const connected=b?.[13]===0xd3&&b[14]===7;
 $('latency-last').textContent=l?.recent&&connected?ms(l.last):'—';
 $('latency-average').textContent=l?.count?ms(l.average):'—';
 $('latency-max').textContent=l?.count?ms(l.max):'—';
 paintLocalized($('latency-state'),!b?msg('device_latency_connect'):!l?msg('device_latency_unsupported'):!l.count?msg('device_latency_waiting'):l.recent&&connected?msg('device_latency_live'):msg('device_latency_stale'));
 paintLocalized($('latency-detail'),legacy(l?.count?`最近一份：${l.queueWait!==undefined?`队列 ${ms(l.queueWait)} + ${l.pendingWait!==undefined?`处理 ${ms(l.processingOnly)} + 提交等待 ${ms(l.pendingWait)}`:`处理 / 提交等待 ${ms(l.processing)}`}`:`固件 / 排队 ${ms(l.queue)}`} + USB FIFO 写入 / 等待 ${ms(l.usb)} · 最小 ${ms(l.min)} · 累计 ${l.count} 份就绪报告`:''));
 if(!l?.count)paintLocalized($('latency-detail'),msg('device_latency_help'));
}
let polling=false;setInterval(async()=>{
 if(document.hidden||!device||busy||polling)return;
 polling=true;const d=device;
  try{const b=payload(await hidWait(d.receiveFeatureReport(0xf9),'读取设备状态'),0xf9,13);if(device===d){telemetry=b;if(b[13]!==0xd3||b[14]!==7)void stopTests();paintBattery(b);paintLatency(b);paintConnection();if((++diagTick%5)===0)void refreshDiag()}}
  catch{if(device===d){void stopTests();telemetry=null;paintBattery(null);paintLatency(null);paintConnection()}}
 finally{polling=false}
},2000);
const padNames=['cross','circle','square','triangle','l1','r1','l2','r2','create','options','stick-l','stick-r','dpad-up','dpad-down','dpad-left','dpad-right','ps','touchpad'];
setInterval(()=>{if(document.hidden)return;const pads=[...(navigator.getGamepads?.()??[])].filter(Boolean),s=$('gamepad'),signature=pads.map(p=>p.index+':'+p.id).join('|');if(s.dataset.signature!==signature){const old=s.value;s.replaceChildren();option(s,'',msg('phrase.dongle_hid_only'));for(const p of pads)option(s,p.index,p.id,false);s.value=[...s.options].some(o=>o.value===old)?old:'';s.dataset.signature=signature}
 if(device&&s.value!==''){const p=pads.find(p=>p.index===Number(s.value));if(p?.mapping==='standard'){const parts=new Set(p.buttons.flatMap((b,i)=>b.pressed&&padNames[i]?[padNames[i]]:[]));paintInput({parts,axes:p.axes.slice(0,4).map(v=>Math.round((v+1)*127.5)),triggers:[p.buttons[6]?.value??0,p.buttons[7]?.value??0].map(v=>Math.round(v*255))},'手动选择的浏览器手柄')}else paintLocalized($('input-state'),msg('phrase.this_gamepad_has_no_standard_layout_use'))}
 if(!device||Date.now()-lastInput>3000){paintLocalized($('input-state'),device?msg('phrase.waiting_for_controller_input_if_the_browser'):msg('phrase.after_connecting_click_a_part_of_the'));for(const id of ['left-axis','right-axis','triggers'])$(id).textContent='—';resetLiveVisuals()}},50);
$('gamepad').onchange=()=>{lastInput=0;lastPaint=0;resetLiveVisuals();for(const id of ['left-axis','right-axis','triggers'])$(id).textContent='—'};
/* 点击快捷验证后同时打开右侧对应设置块，玩家可以接着调参数 */
function qaGoto(pageId,anchorId){
 if(page!==pageId){page=pageId;render()}
 const anchor=$(anchorId);
 const target=anchor?.closest?.('.test-card')??anchor;
 try{target?.scrollIntoView?.({block:'center',behavior:'smooth'})}catch{try{target?.scrollIntoView?.()}catch{}}
}
$('qa-color').oninput=()=>stageColor($('qa-color'));
$('qa-rumble').onclick=()=>{if($('qa-rumble').disabled)return;qaGoto('feel','test-rumble');return $('test-rumble')?.onclick()};
/* 扳机：先左后右各 2 秒。模式必须用 feedback/vibration/weapon，rigid 不存在 */
 $('qa-trigger').onclick=()=>{if($('qa-trigger').disabled)return;qaGoto('feel','test-trigger');return testAction(async()=>{
  const d=device,stopping=stopTests(),generation=testGeneration;
  if(!await stopping||generation!==testGeneration||device!==d)return;
  await outputTester.run('trigger',{side:'left',mode:'feedback',strength:5,start:0});
  if(generation!==testGeneration||device!==d)return;
  triggerSequence=setTimeout(()=>{triggerSequence=null;paintStopTest();if(d&&device===d&&page==='feel'&&!document.hidden)void testAction(()=>outputTester.run('trigger',{side:'right',mode:'feedback',strength:5,start:0}))},2300);
  paintStopTest();
})};
$('qa-lights').onclick=()=>{if($('qa-lights').disabled)return;qaGoto('vision','test-lights');return $('test-lights')?.onclick()};
$('test-stop').onclick=()=>testAction(async()=>{
 if($('test-stop').hidden)return;
 const active=outputTester.isActive();
 if(await stopTests()&&!active)say('网页测试已停止。');
});
$('theme').onclick=()=>{document.body.classList.toggle('light');try{localStorage.setItem('bl616-theme',document.body.classList.contains('light')?'light':'dark')}catch{}};try{document.body.classList.toggle('light',localStorage.getItem('bl616-theme')==='light')}catch{}
paintLocalized($('input-state'),msg('phrase.after_connecting_click_a_part_of_the'));
paintLocalized($('version'),msg('console_name'));
mountLangSelect();applyI18n();
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{void stopTests();page=b.dataset.page;render()});
globalThis.addEventListener?.('blur',()=>{void stopTests()});globalThis.addEventListener?.('pagehide',()=>{void stopTests()});document.addEventListener('visibilitychange',()=>{if(document.hidden)void stopTests()});
$('firmware-notice').onclick=()=>{void stopTests();page='flash';render()};
showArt(false);render();
void autoReconnect();
