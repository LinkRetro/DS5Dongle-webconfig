import {fields,decode,patch,command,payload,remapRead,remapWrite,inputParts,decodeLatency} from './protocol.mjs';
import {createOutputTester,createAudioTester} from './test-center.mjs';
import {LANGS,S,detectLang,makeT} from './i18n.mjs';
import {PHRASES,PATTERNS} from './i18n_phrases.mjs';
import {authenticateHid} from './auth.mjs';
import {restartReceiver} from './restart.mjs';
const $=id=>document.getElementById(id),say=(t,level='info')=>{$('message').textContent=(lang==='zh-CN'||lang==='zh-TW')?t:trText(t);$('message').dataset.level=level};

/* ---- 多语言 ---- */
let lang=detectLang();
const t=makeT(()=>lang);
const NAV_KEYS={feel:'nav_feel',audio:'nav_audio',test:'nav_test',flash:'nav_flash',touch:'nav_touch',remap:'nav_remap',device:'nav_device',about:'nav_about'};
const METRIC_KEYS=['left_stick','right_stick','triggers','battery','gyro','accel'];
/* 文案替换：精确表 + 正则表，覆盖动态文案；同时处理烧录弹窗的 shadow DOM */
const PH=new Map(String(PHRASES||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.indexOf('|');return i>0?[l.slice(0,i),l.slice(i+1)]:null}).filter(Boolean));
const PAT=String(PATTERNS||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.indexOf('|');if(i<=0)return null;try{return [new RegExp(l.slice(0,i)),l.slice(i+1)]}catch(e){return null}}).filter(Boolean);

function trText(raw){
  if(!raw)return raw;
  const key=raw.trim();
  if(!key)return raw;
  if(PH.has(key))return raw.replace(key,PH.get(key));
  for(const [re,rep] of PAT){ if(re.test(key))return key.replace(re,rep); }
  return raw;
}
/* 动态文案的翻译入口：中文环境原样返回 */
function LT(text){return (lang==='zh-CN'||lang==='zh-TW')?text:trText(text)}
function walkPhrases(root){
  try{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const jobs=[];
    while(walker.nextNode()){
      const n=walker.currentNode;
      const out=trText(n.nodeValue);
      if(out!==n.nodeValue)jobs.push([n,out]);
    }
    for(const [n,out] of jobs)n.nodeValue=out;
    root.querySelectorAll('option').forEach(o=>{const out=trText(o.textContent);if(out!==o.textContent)o.textContent=out});
  }catch(e){}
}
function applyPhrases(root){
  if(!root)return;
  if(lang==='zh-CN'||lang==='zh-TW')return;
  walkPhrases(root);
  try{
    root.querySelectorAll('*').forEach(el=>{if(el.shadowRoot)applyPhrases(el.shadowRoot)});
  }catch(e){}
}
let langTimer=null;
function schedulePhrases(){
  if(lang==='zh-CN'||lang==='zh-TW')return;
  if(langTimer)return;
  langTimer=setTimeout(()=>{langTimer=null;applyPhrases(document.body)},60);
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
 sel.onchange=()=>{lang=sel.value;try{localStorage.setItem('ds5.lang',lang)}catch(e){};applyI18n()};
 host.appendChild(sel);
}
function applyI18n(){
 document.documentElement.lang=lang;
 /* 注意：body 上也有 data-page（当前页标记），必须排除，否则会把整个页面文字替换掉 */
 document.querySelectorAll('[data-page]:not(body)').forEach(b=>{const k=NAV_KEYS[b.dataset.page];if(k)b.textContent=t(k)});
 document.querySelectorAll('.axis-grid .metric .muted').forEach((el,i)=>{const k=METRIC_KEYS[i];if(k)el.textContent=t(k)});
 const sel=$('lang');if(sel)sel.value=lang;
 try{refresh()}catch(e){}
}
let device=null,baseline=null,draft={},page='feel',busy=false,epoch=0,profile=0,table=null,mapDirty=false,lastInput=0,lastPaint=0,tableBaseline=null,telemetry=null,restartNeeded=false;
let stickParts=[],visualInputActive=false;
let remapSource=0;
const sourceParts=['square','cross','circle','triangle','l1','r1','l2','r2','create','options','stick-l','stick-r','ps','touchpad','mute','dpad-up','dpad-down','dpad-left','dpad-right',...Array(12).fill('touchpad')];
function paintMappingSource(){
 const selected=page==='remap'?sourceParts[remapSource]:null;
 $('art').querySelectorAll('[data-part]').forEach(p=>{const on=p.dataset.part===selected;p.classList.toggle('mapping-source',on);if(on)p.setAttribute('data-mapping-label',names[remapSource]);else p.removeAttribute('data-mapping-label')});
 const label=$('mapping-selection');if(label){label.hidden=!selected;label.textContent=selected?`正在映射：${names[remapSource]} · 蓝色高亮为编辑来源，紫色为实时按下`:''}
}
let firmwareVersion=null,flashHost=null,flashSession=null,firmwareURL=null;
function paintFirmware(){const state=firmwareStatus(firmwareVersion),notice=$('firmware-notice');notice.hidden=!device||!['update','manual'].includes(state.kind);notice.textContent=`${state.text} · 查看固件更新`;}
function renderFirmware(box){
 const latest=latestFor(firmwareVersion);const state=firmwareStatus(firmwareVersion),summary=document.createElement('section');summary.className='test-card';
 for(const text of [`设备固件：${device?firmwareVersion??'读取失败':'尚未连接，无法检测'}`,`本工程最新：${latest.version} · ${latest.board}`,`发布：${latest.date} · High-Speed / 125µs · ${latest.size} 字节`,device?state.text:'请先连接接收器读取版本；进入 BOOT 后配置接口会消失。','版本比较依据随页面发布的本工程清单，并非在线查询官方全部版本。']){const p=document.createElement('p');p.textContent=text;summary.append(p)}
 const check=document.createElement('button');check.textContent=LT('重新检测设备版本');check.dataset.firmwareCheck='true';check.disabled=!device||busy;check.onclick=()=>exclusive(async()=>{firmwareVersion=new TextDecoder().decode(payload(await hidWait(device.receiveFeatureReport(0xf8),'读取固件版本'),0xf8,1)).replace(/\0.*$/s,'');paintFirmware();render()});summary.append(check);
 const catalog=catalogFor(firmwareVersion),boardId=firmwareVersion?.match(/-(v1|v12)$/)?.[1];
 const list=catalog??[{version:latest.version,tag:'oc8',file:null,notes:'旧版 oc8 无法识别 V1/V1.2，请核对硬件'}];
 const picker=document.createElement('label');picker.textContent=LT('固件版本：');
 const sel=document.createElement('select');sel.id='fw-version';
 for(const [i,v] of list.entries()){const o=document.createElement('option');o.value=String(i);o.textContent=v.version+(v.tag?' · '+v.tag:'');sel.append(o)}
 picker.append(sel);
 const hint=document.createElement('p');hint.className='firmware-hint';
 const go=document.createElement('button');go.className='fw-open';go.textContent=LT('更新到此版本');
 let chosen=list[0];
 const loadImage=async entry=>{
  if(!entry)return null;
  if(!entry.file){
  if(!BUNDLED_FIRMWARE)throw Error('固件需要通过 HTTP 访问：请用 start-web.cmd 打开页面，或把 index.html 与 firmware 目录一起上传到服务器。');
  return Uint8Array.from(atob(BUNDLED_FIRMWARE),c=>c.charCodeAt(0));
 }
  if(boardId&&BOARD_FIRMWARE_IMAGES?.[boardId]&&catalog?.[boardId]?.versions?.[0]?.file===entry.file)
   return Uint8Array.from(atob(BOARD_FIRMWARE_IMAGES[boardId]),c=>c.charCodeAt(0));
  if(boardId){const res=await fetch(`firmware/${boardId}/${entry.file}`);if(res.ok)return new Uint8Array(await res.arrayBuffer());throw Error('服务器上没有 '+entry.file)}
  throw Error('无法获取固件文件');
 };
 const applyChoice=()=>{
  chosen=list[Number(sel.value)]??list[0];
  hint.textContent=`已选择：${chosen.version}${firmwareVersion&&chosen.version===firmwareVersion?'（设备当前版本）':''}${chosen.notes?' · '+chosen.notes:''}`;
  go.textContent=LT(firmwareVersion&&chosen.version===firmwareVersion?'重写当前版本':'更新到此版本');
 };
 sel.onchange=applyChoice;
 applyChoice();
 // 点击即弹窗；弹窗挂在 body 上、不依赖设备连接，拔掉接收器后仍可操作
 go.onclick=()=>fwDialogOpen(chosen.version,chosen,loadImage);
 summary.append(picker);summary.append(hint);summary.append(document.createElement('br'),go);box.append(summary);
 if(!flashHost){flashHost=document.createElement('div');flashHost.className='embedded-flasher';const root=flashHost.attachShadow({mode:'open'});root.innerHTML=FLASH_MARKUP;flashSession=globalThis.mountDongleFlash({querySelector:s=>root.querySelector(s),createElement:s=>document.createElement(s)})}
 box.append(flashHost);flashHost.hidden=true;
}
/* ---------- 固件更新弹窗 ----------
 * 烧录必须把接收器拔下来进入下载模式，此时本页与设备断开属正常现象，
 * 因此弹窗挂在 document.body 上、只在首次创建一次，页面重渲染或设备
 * 掉线都不会影响它；进度与日志从隐藏的烧录引擎轮询同步。
 */
let fwDialog=null,fwDialogTick=null;
function fwDialogNode(){
 if(fwDialog)return fwDialog;
 const m=document.createElement('div');m.className='fw-modal';m.hidden=true;
 m.innerHTML=`<div class="fw-card" role="dialog" aria-modal="true" aria-label="更新接收器固件">
  <h3>更新接收器固件</h3>
  <p class="fw-version"></p>
  <ol class="fw-steps">
   <li>拔掉接收器，<strong>按住 BOOT 键不放</strong>，再插回电脑（此时本页与接收器断开，属正常）</li>
   <li>松开 BOOT：接收器进入下载模式</li>
   <li>点下面按钮，在浏览器弹出的串口列表里选接收器的下载口</li>
  </ol>
  <p class="fw-device">设备状态：读取中…</p>
  <div class="fw-bar"><progress max="100" value="0"></progress><span class="fw-pct">0%</span></div>
  <p class="fw-stage">正在准备固件…</p>
  <p class="fw-tip" hidden>串口列表里没有出现接收器？请按住 BOOT 键再插 USB，松手后会多出一个串口。</p>
  <details class="fw-details"><summary>详细日志</summary><pre class="fw-log"></pre></details>
  <div class="fw-actions"><button class="fw-start primary" disabled>选择串口并开始烧录</button><button class="fw-close">关闭</button></div>
 </div>`;
 document.body.append(m);
 const q=s=>m.querySelector(s);
 q('.fw-close').onclick=()=>{m.hidden=true;if(fwDialogTick){clearInterval(fwDialogTick);fwDialogTick=null}};
 q('.fw-start').onclick=()=>{
  q('.fw-tip').hidden=false;
  if(!('serial' in navigator)){q('.fw-stage').textContent=LT('当前浏览器不支持 Web Serial：请用桌面版 Chrome 或 Edge 打开本页');return}
  if(!globalThis.isSecureContext){q('.fw-stage').textContent=LT('本页不是安全上下文：请通过 https 或 localhost 访问，否则无法使用串口');return}
  const fail=e=>{q('.fw-stage').textContent=(e&&e.message)||String(e)};
  try{const p=flashSession?.start();if(p&&typeof p.catch==='function')p.catch(fail)}catch(e){fail(e)}
 };
 fwDialog=m;
 return m;
}
function fwDialogOpen(version,entry,loadImage){
 const m=fwDialogNode(),q=s=>m.querySelector(s);
 q('.fw-version').textContent=version;
 q('.fw-bar progress').value=0;q('.fw-pct').textContent='0%';
 q('.fw-stage').textContent=LT('正在准备固件…');
 q('.fw-tip').hidden=true;
 q('.fw-device').textContent=LT(device?'设备状态：仍与接收器连接（需按住 BOOT 拔插一次，才会出现下载串口）':'设备状态：未连接');
 q('.fw-start').disabled=true;
 m.hidden=false;
 if(fwDialogTick)clearInterval(fwDialogTick);
 fwDialogTick=setInterval(()=>{
  if(m.hidden){clearInterval(fwDialogTick);fwDialogTick=null;return}
  const sr=flashHost?.shadowRoot;if(!sr)return;
  const bar=sr.querySelector('#progress-bar'),st=sr.querySelector('#stage-text'),lg=sr.querySelector('#log');
  const pct=Number(bar?.value??0);
  q('.fw-bar progress').value=pct;q('.fw-pct').textContent=pct+'%';
  if(st?.textContent)q('.fw-stage').textContent=st.textContent;
  const stt=sr.querySelector('#status-text');
  if(stt?.textContent)q('.fw-device').textContent=LT('设备状态：')+stt.textContent;
  if(lg)q('.fw-log').textContent=(lg.textContent??'').slice(-8000);
 },300);
 loadImage(entry).then(async bytes=>{
  if(!flashSession?.setImage)throw Error('烧录组件未就绪，请回到“固件更新”页重试');
  await flashSession.setImage(entry.file??'firmware.bin',bytes,version);
  q('.fw-stage').textContent=LT('固件已就绪。请按上面 3 步操作，然后点“选择串口并开始烧录”。');
  q('.fw-start').disabled=false;
 }).catch(e=>{q('.fw-stage').textContent=e.message??String(e)});
}

const outputTester=createOutputTester({getDevice:()=>device,isConnected:()=>telemetry?.[13]===0xd3&&telemetry[14]===7,getColor:()=>['led_r','led_g','led_b'].map(k=>baseline?.[k]??210),notify:say});
const audioTester=createAudioTester({notify:say,onLevel:n=>{const meter=$('mic-level');if(meter){meter.value=n;$('mic-reading').textContent=`${Math.round(n)}% · 相对电平`}}});
function stopTests(){audioTester.stop();return outputTester.stop()}
async function testAction(fn){try{await fn()}catch(e){say(e.message??String(e),'error')}}
const names=['□ 方块','× 叉键','○ 圆圈','△ 三角','L1','R1','L2','R2','Create','Options','L3','R3','PS','触摸板点击','静音','方向上','方向下','方向左','方向右','左区触摸','左区上','左区下','左区左','左区右','左区点击','右区触摸','右区上','右区下','右区左','右区右','右区点击'];
const specs={
feel:[['color','灯条颜色','重连手柄后显示；游戏仍可控制灯光。'],['haptics_gain','触觉增益','',1,2,.1],['trigger_reduce','扳机阻力减弱','0 为游戏原始强度。',0,10,1],['disable_led','接收器一分钟后熄灯']],
audio:[['speaker_volume','扬声器音量','',0,127,1],['headset_volume','耳机音量','',0,127,1],['speaker_gain','扬声器增益','',0,7,1],['audio_buffer_length','音频缓冲','',16,128,1],['audio_haptic','音频转触觉','',['关闭','自动（游戏优先）','强制']],['disable_speaker','关闭扬声器编码'],['disable_mic','关闭麦克风透传'],['lock_volume','锁定音量','忽略电脑和游戏的音量调整。']],
touch:[['tp_mode','触摸板模式','',['关闭','方向键','左鼠标 / 右方向键','左方向键 / 右鼠标','分区映射']],['tp_mouse_sensitivity','鼠标灵敏度','',1,32,1],['tp_block_raw','屏蔽原始触摸和点击','仅映射模式启用时生效。'],['combo_window','组合键保持时间','单位 100ms；0 为立即触发。',0,50,1],['mask','允许循环切换的模式','Create + 触摸板在勾选模式间切换。']],
device:[['controller_mode','USB 手柄模式','重启后生效。',['DualSense','DualSense Edge','自动识别']],['polling_rate_mode','回报率','重启后生效。500 Hz / 1 kHz 为 USB 端点轮询率；「实时」在 V1 上等于 1 ms，在 V1.2 上为 125 µs。实际可达上报率受蓝牙链路限制（约 1 kHz）。',['500 Hz','1 kHz','实时']],['inactive_time','闲置断开时间','单位分钟，0 为关闭。',0,60,1],['idle_save','闲置射频省电','关闭可尝试改善主机挂起后的手柄重连。'],['enable_wake','PS 键唤醒主机'],['ps_shortcut_enabled','PS 扩展键盘快捷键','可能增加 USB 键盘接口，重启后生效。'],['enable_usb_sn','USB 序列号','重启后生效。'],['usb_stealth','USB 隐身','手柄连接前隐藏 USB，重启后生效。']]};
const titles={feel:'灯光与触觉',audio:'音频',test:'测试中心',flash:'固件更新',touch:'触摸板与鼠标',remap:'按键映射',device:'接收器',about:'关于这个界面'};
function val(k){return k in draft?draft[k]:baseline?.[k]}
const restartDevices=new WeakSet();
const restartFields=new Set(['polling_rate_mode','controller_mode','enable_usb_sn','ps_shortcut_enabled','usb_stealth','tp_mode','enable_wake']);
function mappingChanges(){if(!table||!tableBaseline)return 0;let count=0;for(let i=0;i<31;i++)if(table.slice(i*4,i*4+4).some((v,j)=>v!==tableBaseline[i*4+j]))count++;return count}
function changedCount(){const keys=Object.keys(draft),colors=keys.filter(k=>k.startsWith('led_')).length;return keys.length-colors+(colors?1:0)+mappingChanges()}
function dirty(){return changedCount()>0}
function needsRestart(){return Object.keys(draft).some(k=>restartFields.has(k))||!!(mappingChanges()&&table.some((v,i)=>i%4===0&&v!==0))}
function paintQuickActions(){
 const state=telemetry?.length>=17&&telemetry[13]===0xD3?telemetry[14]:null;
 const ready=!!device&&state===7;
 const labels={rumble:'qa_rumble',trigger:'qa_trigger',lights:'qa_lights'};
 for(const [id,key] of Object.entries(labels)){
  const b=$('qa-'+id);if(!b)continue;
  b.disabled=!ready;b.textContent=t(key);
 }
 const hint=$('qa-hint');
 if(hint){const text=ready?t('qa_hint'):'';if(hint.textContent!==text)hint.textContent=text}
}
function paintVerdict(){
 const box=$('verdict');if(!box)return;
 const state=telemetry?.length>=17&&telemetry[13]===0xD3?telemetry[14]:null;
 const pct=telemetry?.[11],known=Number.isInteger(pct)&&pct>=0&&pct<=100;
 let kind='warn',title=t('verdict_checking'),detail='';
 if(!navigator.hid){kind='bad';title=t('verdict_unsupported')}
 else if(!device){kind='warn';title=t('verdict_no_device')}
 else if(state===7){
  kind='ok';title=t('verdict_ready');
  const model=$('device-title').textContent||'';
  detail=[model,known?`${pct}%`:''].filter(Boolean).join(' · ');
 }else if(state===null||(state>0&&state<7)){kind='warn';title=t('verdict_no_controller');detail=t('verdict_pair_hint')}
 else{kind='warn';title=t('verdict_no_controller')}
 if(box.dataset.state!==kind)box.dataset.state=kind;
 const tt=$('verdict-title'),dd=$('verdict-detail');
 if(tt&&tt.textContent!==title)tt.textContent=title;
 if(dd&&dd.textContent!==detail)dd.textContent=detail;
 paintQuickActions();
}
function paintConnection(){
 $('dot').classList.toggle('on',!!device);
 $('connection').textContent=LT(device?'接收器已连接':'尚未连接接收器');
 const states=['等待手柄连接','正在搜索手柄','正在建立蓝牙连接','查询手柄服务','连接控制通道','连接输入通道','手柄握手中','手柄已连接','手柄正在断开'];
 const state=telemetry?.length>=17&&telemetry[13]===0xD3?telemetry[14]:null;
 $('controller-dot').classList.toggle('on',!!device&&state===7);
 $('controller-dot').classList.toggle('working',!!device&&state!==null&&state>0&&state<7);
 $('controller-connection').textContent=LT(!device?'手柄状态未读取':state===null?'手柄状态待更新':states[state]??'手柄状态未知');
 $('controller-connection').title=state===null?'':`已绑定 ${telemetry[15]} 个手柄`;
 const pct=telemetry?.[11],known=Number.isInteger(pct)&&pct>=0&&pct<=100;
 $('power-status').textContent=!device||!known?LT('电量待更新'):`${pct}% · ${LT(telemetry[12]===1?'正在充电':telemetry[12]===2?'已充满':telemetry[12]===0?'使用电池':'电池状态未知')}`;
 $('power-status').dataset.level=known&&pct<=10&&telemetry[12]===0?'low':'normal';
 paintVerdict();
}
function refresh(){
 const enabled=!!device&&!busy;
 /* After a disconnect baseline/table are null; computing the change count then
  * used to throw and leave every control (and the exclusive queue) stuck. */
 let count=0;mapDirty=false;
 try{count=baseline?changedCount():0;mapDirty=table?mappingChanges()>0:false}catch{count=0;mapDirty=false}
 $('save').disabled=!enabled||!count;$('revert').disabled=!enabled||!count;
 $('reload').disabled=!enabled;$('reboot').disabled=!enabled||!!count;
 $('connect').disabled=busy;$('connect').textContent=device?t('disconnect'):t('connect');
 $('dirty').textContent=count?LT(`有 ${count} 项未应用`):LT('没有未应用的更改');
 const restartDraft=needsRestart();$('restart-hint').hidden=!restartDraft&&!restartNeeded;
 $('restart-hint').textContent=LT(restartDraft?'本次包含需重启生效的设置，保存后请重启接收器。':restartNeeded?'设置已应用并请求保存，重启接收器后生效。':'');
 $('save').textContent=LT(busy?'正在处理…':'应用并保存');
 document.querySelectorAll('#controls input,#controls select,#controls button').forEach(e=>e.disabled=!enabled);
 if(page==='test')document.querySelectorAll('#controls input,#controls select,#controls button').forEach(e=>e.disabled=e.dataset.hid==='true'?!enabled:false);
 paintConnection();
 if(page==='remap'){
  const state=$('mapping-state');if(state)state.textContent=LT(busy?'正在读取或保存映射，请稍候…':!device?'尚未连接接收器：请先点击右上角连接，读取成功后才能编辑映射。':'选择来源后可编辑下方目标；蓝色高亮不会锁定编辑。');
 }
 if(page==='flash')document.querySelectorAll('#controls button').forEach(e=>e.disabled=e.dataset.firmwareCheck==='true'?(!device||busy):false);
}
function set(k,v){const same=k==='haptics_gain'?Math.fround(v)===Math.fround(baseline?.[k]):v===baseline?.[k];if(same)delete draft[k];else draft[k]=v;refresh();if(k.startsWith('led_'))paintLight()}
function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o)}
function row(label,hint,group=false){const r=document.createElement(group?'div':'label');if(group){r.setAttribute('role','group');r.setAttribute('aria-label',label)}r.className='row';const s=document.createElement('span');s.textContent=label;if(hint){const h=document.createElement('small');h.textContent=hint;s.append(h)}r.append(s);return r}
function render(){ if(flashSession?.isBusy()&&page!=='flash'){page='flash';say('正在烧录，请等待完成后切换分类');return}document.body.dataset.page=page;setTimeout(()=>applyPhrases(document.body),0);paintMappingSource();$('panel-title').textContent=titles[page];$('panel-sub').textContent=LT(page==='flash'?'设备版本 · 本工程最新固件 · 页面内升级':page==='test'?'临时测试立即发送，不写入保存设置。':page==='about'?'OLED 视觉语言 · BL616 专用协议':'设置只在点击“应用并保存”后发送。');const box=$('controls');box.replaceChildren();document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 if(page==='flash'){renderFirmware(box);refresh();return}
 if(page==='test'){renderTests(box);refresh();return}
 if(page==='about'){const p=document.createElement('p');p.className='hint';p.textContent=LT('适用于本工程配置版本 4（oc2 及后续本地版本）。复用 MarcelineVPQ OLED 配置器的手柄画作与界面布局思路。包含临时震动、扳机、灯光和音频测试；未包含 Pico OLED、UF2 刷机、校准和游戏自动配置功能。配置通过 WebHID 读写；真实按键数据取决于浏览器开放的输入报告，也可手动选择浏览器手柄输入源。');box.append(p);const a=document.createElement('a');a.href='LICENSES.txt';a.textContent=LT('第三方许可与来源');box.append(a);refresh();return}
 if(page==='remap'){renderRemap(box);refresh();return}
 for(const [k,label,hint,min,max,step]of specs[page]){
  if(k==='mask'){const g=document.createElement('fieldset');g.className='row';const title=document.createElement('span');title.textContent=label;g.append(title);const choices=document.createElement('div');['关闭','方向键','左鼠标','右鼠标','分区'].forEach((t,i)=>{const l=document.createElement('label');l.style.display='block';const c=document.createElement('input');c.type='checkbox';c.checked=!!(val('tp_mode_enabled_mask')&(1<<i));c.onchange=()=>{let mask=val('tp_mode_enabled_mask')??1;mask=c.checked?mask|(1<<i):mask&~(1<<i);if(!mask){c.checked=true;say('至少保留一种循环模式');return}set('tp_mode_enabled_mask',mask)};l.append(c,document.createTextNode(t));choices.append(l)});g.append(choices);box.append(g);continue}
  const r=row(label,hint,min!==undefined&&!Array.isArray(min));let c;
  if(k==='color'){c=document.createElement('input');c.type='color';c.value='#'+['led_r','led_g','led_b'].map(n=>(val(n)??255).toString(16).padStart(2,'0')).join('');c.oninput=()=>['led_r','led_g','led_b'].forEach((n,i)=>set(n,parseInt(c.value.slice(1+i*2,3+i*2),16)))}
  else if(Array.isArray(min)){c=document.createElement('select');min.forEach((t,i)=>option(c,i,t));c.value=val(k)??0;c.onchange=()=>set(k,Number(c.value))}
  else if(min!==undefined){
   r.classList.add('range-row');c=document.createElement('div');c.className='range-control';
   const slider=document.createElement('input'),number=document.createElement('input');
   slider.type='range';number.type='number';
   for(const input of [slider,number]){input.min=min;input.max=max;input.step=step;input.value=Number((val(k)??min).toFixed(2));input.dataset.field=k;input.setAttribute('aria-label',label+(input===number?'精确值':''))}
   slider.oninput=()=>{const n=Number(slider.value);number.value=n;number.setCustomValidity('');set(k,n)};
   number.oninput=()=>{const n=number.value===''?NaN:Number(number.value),valid=Number.isFinite(n)&&n>=min&&n<=max&&Math.abs((n-min)/step-Math.round((n-min)/step))<0.00001;number.setCustomValidity(valid?'':'请输入范围内的有效步进值');if(valid)slider.value=n;set(k,n)};
   c.append(slider,number)
  }
  else{c=document.createElement('input');c.type='checkbox';c.checked=!!val(k);c.onchange=()=>set(k,+c.checked)}r.append(c);box.append(r)
 } refresh();paintLight()
}
function renderTests(box){
 const intro=document.createElement('p');intro.className='hint';intro.textContent=LT('建议退出游戏后测试，游戏可能覆盖输出。震动与扳机限时 2 秒，灯光限时 5 秒；切换分类、离开窗口或断开时发送停止。页面被强制关闭或 USB 拔出时无法保证停止指令送达，可关闭手柄复位。');box.append(intro);
 const stop=document.createElement('button');stop.id='test-stop';stop.className='test-stop';stop.textContent=LT('■ 停止全部测试 / 复位');stop.onclick=()=>testAction(async()=>{
  const had=await stopTests();
  if(!device)throw Error('请先连接接收器：复位指令需要通过接收器下发');
  await outputTester.resetAll();
  say(had?'已停止全部测试，并复位手柄输出（震动归零 / 扳机松开 / 灯光恢复）':'当前没有测试在运行，已发送一次复位（震动归零 / 扳机松开 / 灯光恢复）');
});box.append(stop);
 function section(title,hint){const s=document.createElement('section');s.className='test-card';const h=document.createElement('h3');h.textContent=title;s.append(h);if(hint){const p=document.createElement('p');p.className='hint';p.textContent=hint;s.append(p)}box.append(s);return s}
 function input(s,id,label,type,value,min,max){const r=row(label),c=document.createElement('input');c.id=id;c.type=type;c.value=value;if(min!==undefined){c.min=min;c.max=max;c.step=1}r.append(c);s.append(r);return c}
 function select(s,id,label,choices){const r=row(label),c=document.createElement('select');c.id=id;for(const [v,t]of choices)option(c,v,t);r.append(c);s.append(r);return c}
 function button(s,id,label,fn,hid=true){const b=document.createElement('button');b.id=id;b.textContent=label;b.dataset.hid=String(hid);b.onclick=()=>testAction(fn);s.append(b);return b}
 const rumble=section('普通震动','左右独立调节。与高清音频触觉不同；当前固件设置可能影响体感。');
 const left=input(rumble,'rumble-left','左侧强度（0–255）','number',80,0,255),right=input(rumble,'rumble-right','右侧强度（0–255）','number',80,0,255);
 button(rumble,'test-rumble','震动 2 秒',()=>outputTester.run('rumble',{left:Number(left.value),right:Number(right.value)}));
 const trigger=section('自适应扳机','独立测试 L2 或 R2；使用当前固件的扳机减弱设置。起点 0–9，段落阻力起点为 2–7、终点固定为 8。');
 const side=select(trigger,'trigger-side','测试扳机',[['left','L2 左扳机'],['right','R2 右扳机']]);
 const mode=select(trigger,'trigger-mode','效果',[['feedback','持续阻力'],['weapon','段落阻力'],['vibration','扳机振动（30 Hz）']]);
 const force=input(trigger,'trigger-force','强度（1–8）','number',3,1,8),start=input(trigger,'trigger-start','起点（0–9）','number',3,0,9);
 button(trigger,'test-trigger','扳机测试 2 秒',()=>outputTester.run('trigger',{side:side.value,mode:mode.value,strength:Number(force.value),start:Number(start.value)}));
 const lights=section('实时灯光','临时点亮 5 秒；复位到已读取的连接色，玩家灯和麦克风指示灯关闭。橙灯测试仅控制指示灯，不改变实际静音状态。');
 const color=input(lights,'test-color','灯条颜色','color','#66c7ff');
 const brightness=select(lights,'test-brightness','亮度',[[0,'明亮'],[1,'中等'],[2,'暗淡']]);
 const players=select(lights,'test-players','玩家指示灯',[[0,'关闭'],[4,'1 · 中间'],[10,'2 · 内侧'],[21,'3 · 间隔'],[27,'4 · 外侧与内侧'],[31,'全部点亮']]);
 const mic=select(lights,'test-mic-led','麦克风指示灯',[[0,'关闭'],[1,'常亮'],[2,'呼吸']]);
 button(lights,'test-lights','灯光测试 5 秒',()=>outputTester.run('lights',{rgb:[1,3,5].map(i=>parseInt(color.value.slice(i,i+2),16)),brightness:Number(brightness.value),players:Number(players.value),mic:Number(mic.value)}));
 const audio=section('音频与麦克风','浏览器音频设备与接收器 HID 分开选择。请在下方或系统声音设置中选择 DS5Dongle 的扬声器 / 麦克风；默认设备可能是电脑音箱。麦克风只显示相对电平，不录音、不回放。');
 const out=select(audio,'test-output','声音输出',[['','系统默认输出']]),source=select(audio,'test-input','麦克风输入',[['','系统默认麦克风']]);
 async function devices(){if(!navigator.mediaDevices?.enumerateDevices)throw Error('此浏览器无法列出音频设备，请检查安全上下文');const devices=await navigator.mediaDevices.enumerateDevices();if(!out.isConnected)return;const oldOut=out.value,oldIn=source.value;for(const [s,kind,label,old]of [[out,'audiooutput','输出',oldOut],[source,'audioinput','麦克风',oldIn]]){s.replaceChildren();option(s,'',kind==='audiooutput'?'系统默认输出':'系统默认麦克风');devices.filter(d=>d.kind===kind&&d.deviceId).forEach((d,i)=>option(s,d.deviceId,d.label||`${label} ${i+1}（名称未授权）`));s.value=[...s.options].some(o=>o.value===old)?old:''}say('已更新音频设备列表；名称可能需要麦克风权限后才显示')}
 button(audio,'test-devices','刷新音频设备',devices,false);
 button(audio,'test-tone','播放 1 秒测试音',()=>audioTester.tone(out.value),false);
 button(audio,'test-microphone','开始麦克风电平（30 秒）',()=>audioTester.microphone(source.value),false);
 const gyro=section('陀螺仪 / 加速度','实时读取手柄六轴原始值。转动手柄时陀螺仪数值应随之变化，静止时加速度约等于 1g。若数值不随动作变化，请用「复制原始数据」回传，我们据实校正报告偏移。');
 const gWrap=document.createElement('div');gWrap.id='gyro-readout';gyro.append(gWrap);
 function axisRow(parent,id,label){const r=row(label);const m=document.createElement('meter');m.id=id+'-meter';m.min=-32768;m.max=32767;m.value=0;m.setAttribute('aria-label',label);const t=document.createElement('span');t.id=id;t.textContent='—';r.append(m,t);parent.append(r);}
 for(const[ax,lb]of[['x','陀螺仪 X'],['y','陀螺仪 Y'],['z','陀螺仪 Z']])axisRow(gWrap,'gyro-'+ax,lb);
 for(const[ax,lb]of[['x','加速度 X'],['y','加速度 Y'],['z','加速度 Z']])axisRow(gWrap,'acc-'+ax,lb);
 const gstamp=document.createElement('p');gstamp.id='gyro-stamp';gstamp.className='hint';gstamp.textContent=LT('等待输入报告…');gWrap.append(gstamp);
 input(gyro,'gyro-smooth','平滑强度（0–95%）','number',Math.round(gyroCfg.smooth*100),0,95).oninput=e=>{const v=Math.max(0,Math.min(95,Number(e.target.value)||0));gyroCfg.smooth=v/100;gyroSaveCfg()};
 input(gyro,'gyro-accsmooth','加速度平滑（0–95%）','number',Math.round((gyroCfg.accSmooth??0.85)*100),0,95).oninput=e=>{const v=Math.max(0,Math.min(95,Number(e.target.value)||0));gyroCfg.accSmooth=v/100;gyroSaveCfg()};
 input(gyro,'gyro-dead','死区（原始单位）','number',gyroCfg.deadband,0,500).oninput=e=>{const v=Math.max(0,Math.min(500,Number(e.target.value)||0));gyroCfg.deadband=v;gyroSaveCfg()};
 select(gyro,'gyro-autobias','自动零偏',[['1','开启'],['0','关闭']]).onchange=e=>{gyroCfg.autoBias=e.target.value==='1';gyroBias=null;gyroBiasFrames=0;gyroSaveCfg();say(gyroCfg.autoBias?'自动零偏已开启，静止 2 秒重新学习零点':'自动零偏已关闭，显示原始偏移')};
 const greset=document.createElement('button');greset.id='gyro-defaults';greset.textContent=LT('恢复默认参数');greset.dataset.hid='false';greset.onclick=()=>{gyroCfg={...GYRO_DEFAULTS};gyroSmooth=null;gyroBias=null;gyroBiasFrames=0;accSmooth=null;gyroSaveCfg();render();say('已恢复默认：平滑 75%、死区 25、自动零偏开启')};gyro.append(greset);
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
 const meter=document.createElement('meter');meter.id='mic-level';meter.min=0;meter.max=100;meter.value=0;meter.setAttribute('aria-label','麦克风相对电平');const reading=document.createElement('span');reading.id='mic-reading';reading.textContent=LT('0% · 相对电平');audio.append(meter,reading);
}
async function exclusive(fn){if(busy)return;busy=true;try{refresh();await fn()}catch(e){say(e.message??String(e),'error')}finally{busy=false;try{refresh()}catch(e){console.error(e)}}}
function hidWait(promise,label,ms=5000){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error(`${label}超时，请关闭其他配置页并重新插拔接收器后重试。`)),ms);Promise.resolve(promise).then(v=>{clearTimeout(timeout);resolve(v)},e=>{clearTimeout(timeout);reject(e)})})}
async function readCfg(){return hidWait(device.receiveFeatureReport(0xf7),'读取配置')}
async function readTable(p){const d=device;await hidWait(d.sendFeatureReport(0xfb,command(3,[p],127)),'选择映射组');const m=remapRead(await hidWait(d.receiveFeatureReport(0xfb),'读取按键映射'),p);if(device!==d)throw Error('读取映射期间设备已断开');return m}
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
function clearInput(){lastInput=0;lastPaint=0;touchTrail=[];for(const d of touchDots)d.style.display='none';resetLiveVisuals();paintBattery(null);paintLatency(null);for(const id of ['left-axis','right-axis','triggers','battery'])$(id).textContent='—'}

function disconnected(){gyroBase=null;gyroRaw=null;gyroSmooth=null;gyroBias=null;gyroBiasFrames=0;accSmooth=null;void stopTests();epoch++;if(device)device.removeEventListener('inputreport',onInput);device=null;firmwareVersion=null;paintFirmware();baseline=null;draft={};table=null;tableBaseline=null;telemetry=null;mapDirty=false;restartNeeded=false;clearInput();render()}
async function load(){const cfg=decode(await readCfg());const m=await readTable(profile);baseline=cfg;draft={};table=m.table;tableBaseline=m.table.slice();mapDirty=false;render()}
const HID_FILTERS=[{vendorId:0x054c,productId:0x0ce6},{vendorId:0x054c,productId:0x0df2}];
const pickConfigDevice=list=>list?.find(d=>d.collections.some(c=>c.featureReports.some(r=>r.reportId===0xf7)));
async function attachDevice(d){
 if(!d)throw Error('未选择包含配置报告的接收器接口');
 let expired=false;const connectionEpoch=epoch;
 const step=async(label,fn)=>{say(label+'…');const result=await hidWait(fn(),label,label==='验证设备身份'?12000:5000);if(expired||epoch!==connectionEpoch)throw Error('连接已中断，请重新连接');return result};
 try{
  if(!d.opened)await step('打开接收器',()=>{const opening=d.open();opening.then(()=>{if(expired)void d.close().catch(()=>{})},()=>{});return opening});
  if(PRODUCTION_AUTH){await step('验证设备身份',()=>authenticateHid(d,AUTH_AUTHORITY));say('设备身份验证通过')}
  const v=payload(await step('读取固件信息',()=>d.receiveFeatureReport(0xf8)),0xf8,1);const fw=new TextDecoder().decode(v).replace(/\0.*$/s,'');if(!/^(LCT616|M0S|BL618)-DS5 /.test(fw))throw Error('这不是本工程支持的 BL616 接收器');
  const cfg=decode(await step('读取配置',()=>d.receiveFeatureReport(0xf7)));
  await step('选择映射组',()=>d.sendFeatureReport(0xfb,command(3,[profile],127)));
  const m=remapRead(await step('读取按键映射',()=>d.receiveFeatureReport(0xfb)),profile);
  device=d;firmwareVersion=fw;paintFirmware();baseline=cfg;draft={};table=m.table;tableBaseline=m.table.slice();mapDirty=false;restartNeeded=restartDevices.has(d);epoch++;render();d.addEventListener('inputreport',onInput);$('version').textContent=fw;$('device-title').textContent=d.productId===0x0df2?'DualSense Edge':'DualSense';showArt(d.productId===0x0df2);say('已读取当前设置。修改后点击应用并保存。');return true;
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
 if(device){const d=device;await hidWait(stopTests(),'停止测试',3000).catch(()=>{});disconnected();if(d.opened)await hidWait(d.close(),'关闭设备接口',1000).catch(()=>{});say('已断开连接');return}
 if(!navigator.hid)throw Error('请使用支持 WebHID 的 Chrome / Edge');
 const list=await navigator.hid.requestDevice({filters:HID_FILTERS});
 await attachDevice(pickConfigDevice(list));
});
navigator.hid?.addEventListener('disconnect',e=>{if(e.device===device){restartDevices.delete(e.device);disconnected();say('接收器已断开，未保存更改已清除。')}});
$('revert').onclick=()=>{if(busy||!device)return;draft={};table=tableBaseline?.slice()??null;mapDirty=false;render();say('已撤销本页未应用的更改，设备设置未修改')};
$('reload').onclick=()=>{if(dirty()&&!confirm('重新读取会放弃未保存更改，继续吗？'))return;exclusive(async()=>{await load();say('已重新读取设备设置')})};
$('save').onclick=()=>exclusive(async()=>{
 for(const c of document.querySelectorAll('#controls input'))if(c.checkValidity&&!c.checkValidity())throw Error('请先修正无效的输入值');
 const current=await readCfg(),updated=patch(current,draft),wanted={...draft};
 const myEpoch=epoch,requiresRestart=needsRestart();
 if(Object.keys(wanted).length){await device.sendFeatureReport(0xf6,command(1,updated));const readback=decode(await readCfg());if(Object.entries(wanted).some(([k,v])=>Math.abs(readback[k]-v)>0.00001))throw Error('配置回读不一致，未请求保存');await device.sendFeatureReport(0xf6,command(2));restartNeeded=restartNeeded||Object.keys(wanted).some(k=>restartFields.has(k));if(restartNeeded)restartDevices.add(device);baseline=readback;draft={}}
 if(mapDirty){const expected=table.slice();await device.sendFeatureReport(0xfb,remapWrite(profile,expected));const m=await readTable(profile);if(expected.some((v,i)=>m.table[i]!==v))throw Error('映射回读不一致，请重新读取后重试');tableBaseline=m.table.slice();mapDirty=false}
 if(myEpoch!==epoch)throw Error('保存期间设备已断开');restartNeeded=restartNeeded||requiresRestart;if(restartNeeded)restartDevices.add(device);render();say('设备回读一致，已请求异步保存。请稍候再拔出；此固件不提供 Flash 写入结果查询。')
});
$('reboot').onclick=()=>exclusive(async()=>{
 const d=device,myEpoch=epoch;
 await hidWait(stopTests(),'停止测试');
 const check=()=>{if(device!==d||epoch!==myEpoch)throw Error('设备已断开，重启流程已取消')};
 await restartReceiver({read:async()=>{check();return payload(await hidWait(d.receiveFeatureReport(0xf9),'读取断开状态',1000),0xf9,17)},send:async cmd=>{check();await hidWait(d.sendFeatureReport(0xf6,command(cmd)),'发送重启流程指令',1000)},notify:say});
 restartDevices.delete(d);disconnected();if(d.opened)await hidWait(d.close(),'关闭设备接口',500).catch(()=>{});
 say('已确认手柄断开并发送重启请求。等待设备重新出现后点击连接。');
});
function renderRemap(box){const state=document.createElement('p');state.id='mapping-state';state.className='hint';state.setAttribute('role','status');box.append(state);const r=row('映射组','编辑组与当前使用组分别选择。');const p=document.createElement('select');option(p,0,'组 1');option(p,1,'组 2');p.value=profile;p.onchange=()=>{const next=Number(p.value);if(mapDirty){p.value=profile;say('请先保存或重新读取，再切换映射组');return}exclusive(async()=>{try{const m=await readTable(next);profile=next;table=m.table;tableBaseline=m.table.slice();render()}catch(e){p.value=profile;throw e}})};r.append(p);box.append(r);
 const activate=document.createElement('button');activate.textContent=LT('使用当前编辑组');activate.onclick=()=>exclusive(async()=>{await device.sendFeatureReport(0xfb,command(5,[profile],127));const m=await readTable(profile);if(m.active!==profile)throw Error('切换映射组失败');say(`已切换到映射组 ${profile+1}`)});box.append(activate);
 const source=document.createElement('select');source.id='mapping-source';names.forEach((n,i)=>option(source,i,n));source.value=remapSource;const sr=row('来源按键','蓝色高亮标出左侧手柄图的对应位置；触摸分区来源会标出触摸板。');sr.append(source);box.append(sr);const area=document.createElement('div');box.append(area);
 function edit(){const id=Number(source.value),o=id*4,t=table?.[o]??0;remapSource=id;paintMappingSource();area.replaceChildren();const tr=row('映射到');const type=document.createElement('select');['手柄按键','键盘按键','鼠标按键'].forEach((n,i)=>option(type,i,n));type.value=t;type.onchange=()=>{if(!table)return;table[o]=Number(type.value);table[o+1]=table[o]===0?id:0;table[o+2]=0;table[o+3]=0;mapDirty=true;edit();refresh()};tr.append(type);area.append(tr);
 const vr=row(t===1?'USB HID 键码':'目标');let target;if(t===1){target=document.createElement('input');target.type='number';target.min=0;target.max=255;target.value=table?.[o+1]??0;target.oninput=()=>{const v=Number(target.value);if(target.value===''||!Number.isInteger(v)||v<0||v>255){target.setCustomValidity('请输入 0–255 整数');return}target.setCustomValidity('');table[o+1]=v;mapDirty=true;refresh()}}
 else{target=document.createElement('select');(t===0?names:['左键','右键','中键']).forEach((n,i)=>option(target,i,n));target.value=table?.[o+1]??id;target.onchange=()=>{table[o+1]=Number(target.value);mapDirty=true;refresh()}}vr.append(target);area.append(vr);
 if(t!==0){const rr=row('屏蔽原始手柄按键');const c=document.createElement('input');c.type='checkbox';c.checked=!!(table?.[o+3]&1);c.onchange=()=>{table[o+3]=(table[o+3]&~1)|+c.checked;mapDirty=true;refresh()};rr.append(c);area.append(rr)}
 if(t===1){for(const [label,offset]of [['修饰键位掩码 / 第二键码',2],['标志（0–3；位 1 为第二键码）',3]]){const rr=row(label);const c=document.createElement('input');c.type='number';c.min=0;c.max=offset===3?3:255;c.value=table?.[o+offset]??0;c.oninput=()=>{const v=Number(c.value);if(c.value===''||!Number.isInteger(v)||v<0||v>Number(c.max)){c.setCustomValidity('数值超出范围');return}c.setCustomValidity('');table[o+offset]=v;mapDirty=true;refresh()};rr.append(c);area.append(rr)}}
 const hint=document.createElement('p');hint.className='hint';hint.textContent=LT('键码示例：A=4、空格=44、回车=40。修饰键：Ctrl=1、Shift=2、Alt=4。新增键鼠映射需重启接收器以枚举接口。');area.append(hint);refresh()}
 source.onchange=edit;edit()
}
function paintLight(){const rgb=['led_r','led_g','led_b'].map(k=>val(k)??210);$('art').style.setProperty('--ctl-led',`rgb(${rgb.join(',')})`)}
function showArt(edge){$('art').innerHTML=edge?EDGE_ART:STANDARD_ART;stickParts=['stick-l','stick-r'].map(id=>$('art').querySelector(`[data-part="${id}"]`)).map(node=>({node,base:node.getAttribute('transform')??''}));visualInputActive=false;for(const p of $('art').querySelectorAll('[data-part]')){p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',p.dataset.part)}paintLight();paintMappingSource()}
function selectPart(target){const id=target.closest('[data-part]')?.dataset.part;if(!id)return;void stopTests();page=id==='touchpad'?'touch':['speaker','mute'].includes(id)?'audio':['l2','r2','lightbar','body'].includes(id)?'feel':'remap';render();if(page==='remap'){const ids=['square','cross','circle','triangle','l1','r1','l2','r2','create','options','stick-l','stick-r','ps','touchpad','mute','dpad-up','dpad-down','dpad-left','dpad-right'];const idx=ids.indexOf(id);if(idx>=0){const selects=$('controls').querySelectorAll('select');selects[1].value=idx;selects[1].dispatchEvent(new Event('change'))}}}
$('art').onclick=e=>selectPart(e.target);$('art').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPart(e.target)}};
function paintInput(i,source){lastInput=Date.now();if(lastInput-lastPaint<33)return;lastPaint=lastInput;visualInputActive=true;moveSticks(i.axes);for(const [n,v]of [['l2',i.triggers[0]],['r2',i.triggers[1]]])for(const stop of $('art').querySelectorAll(`#ctl-${n}-fill [data-edge]`))stop.setAttribute('offset',String(v/255));$('input-state').textContent=`实时输入 · ${source}（USB 输出，已应用映射）`;$('left-axis').textContent=`${i.axes[0]} / ${i.axes[1]}`;$('right-axis').textContent=`${i.axes[2]} / ${i.axes[3]}`;$('triggers').textContent=i.triggers.map(v=>Math.round(v/255*100)+'%').join(' / ');$('art').querySelectorAll('[data-part]').forEach(p=>p.classList.toggle('pressed',i.parts.has(p.dataset.part)))}
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
  const gv=g[i]-base[i],av=Math.round(accC[i]);
  const gt=$('gyro-'+ax),gm=$('gyro-'+ax+'-meter');
  if(gt)gt.textContent=String(gv);
  if(gm)gm.value=Math.max(-32768,Math.min(32767,gv));
  const at=$('acc-'+ax),am=$('acc-'+ax+'-meter');
  if(at)at.textContent=String(av);
  if(am)am.value=Math.max(-32768,Math.min(32767,av));
 });
 const gl=$('gyro-live'),al=$('accel-live');
 if(gl)gl.textContent=`${(g[0]/1024).toFixed(1)} / ${(g[1]/1024).toFixed(1)} / ${(g[2]/1024).toFixed(1)}`;
 if(al)al.textContent=`${(accC[0]/8192).toFixed(2)} / ${(accC[1]/8192).toFixed(2)} / ${(accC[2]/8192).toFixed(2)}  |a|=${accMag.toFixed(2)}`;
 const st=$('gyro-stamp');
 if(st)st.textContent=LT(gyroBase?'已归零，显示相对值':'实时数据（未归零）');
 /* 最近 2 秒的滚动峰值：一直显示，用户只需转动手柄 */
 if(now-gyroPeak.start>2000)gyroPeak={start:now,max:[0,0,0]};
 for(let i=0;i<3;i++){
  const v=Math.abs(g[i]-base[i]);
  if(v>gyroPeak.max[i])gyroPeak.max[i]=v;
 }
 const m=gyroPeak.max,names=['X','Y','Z'];
 if(m[0]+m[1]+m[2]>50){
  const top=m.indexOf(Math.max(...m));
  const deg=m.map(v=>(v/1024).toFixed(1));
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
 const signature=`${pct}:${state}`;
 if(signature===batterySignature)return;
 batterySignature=signature;
 const known=Number.isInteger(pct)&&pct>=0&&pct<=100;
 const low=known&&pct<=10&&state===0;
 const charging=known&&pct<=10&&state===1;
 $('battery').textContent=known?`${pct}%`:'—';
 $('battery-card').dataset.level=low?'low':'normal';
 $('battery-alert').hidden=!low&&!charging;
 $('battery-alert').dataset.kind=charging?'charging':'low';
 $('battery-warning').textContent=LT(low?`电量 ${pct}% · 建议充电`:charging?`电量 ${pct}% · 正在充电`:'');
 /* 信号 / 配对数量 / USB 速率（遥测已包含，见 usb_gamepad.c 遥测布局） */
 const ls=$('link-status');
 if(ls){
  if(!b){ls.textContent=LT('信号 — · 已配对 — · USB —')}
  else{
   const rssi=b[0]>127?b[0]-256:b[0];
   const bars=rssi>=-55?4:rssi>=-65?3:rssi>=-75?2:rssi>=-85?1:0;
   const bonds=b[15],hs=(b[1]&0x40)!==0;
   ls.textContent=LT(`信号 ${bars?('▮'.repeat(bars)+'▯'.repeat(4-bars)):'—'} (${rssi} dBm) · 已配对 ${bonds} 只 · USB ${hs?'HS':'FS'}`);
  }
 }
 $('battery-explanation').textContent=LT(low?'板载蓝灯快速闪烁是低电量提示，不代表连接失败。请给手柄充电。':charging?'手柄已开始充电。设备更新电池状态后，低电量闪灯提示会解除。':'');
}
function paintLatency(b){if(!$('latency-average'))return;   /* 面板已移除时静默跳过 */
 const l=b?decodeLatency(b):null,ms=v=>(v/1000).toFixed(3)+' ms';
 const connected=b?.[13]===0xd3&&b[14]===7;
 $('latency-last').textContent=l?.recent&&connected?ms(l.last):'—';
 $('latency-average').textContent=l?.count?ms(l.average):'—';
 $('latency-max').textContent=l?.count?ms(l.max):'—';
 $('latency-state').textContent=LT(!b?'连接后读取':!l?'需 oc4 或更新固件':!l.count?'等待首个 HID 就绪样本':l.recent&&connected?'实时采样':'暂无新样本');
 $('latency-detail').textContent=LT(l?.count?`最近一份：${l.queueWait!==undefined?`队列 ${ms(l.queueWait)} + ${l.pendingWait!==undefined?`处理 ${ms(l.processingOnly)} + 提交等待 ${ms(l.pendingWait)}`:`处理 / 提交等待 ${ms(l.processing)}`}`:`固件 / 排队 ${ms(l.queue)}`} + USB FIFO 写入 / 等待 ${ms(l.usb)} · 最小 ${ms(l.min)} · 累计 ${l.count} 份就绪报告`:'由固件逐报告计时，不使用浏览器推算。');
}
let polling=false;setInterval(async()=>{
 if(document.hidden||!device||busy||polling)return;
 polling=true;const d=device;
 try{const b=payload(await hidWait(d.receiveFeatureReport(0xf9),'读取设备状态'),0xf9,13);if(device===d){telemetry=b;if(b[13]!==0xd3||b[14]!==7)void outputTester.stop();paintBattery(b);paintLatency(b);paintConnection()}}
 catch{if(device===d){void outputTester.stop();telemetry=null;paintBattery(null);paintLatency(null);paintConnection()}}
 finally{polling=false}
},2000);
const padNames=['cross','circle','square','triangle','l1','r1','l2','r2','create','options','stick-l','stick-r','dpad-up','dpad-down','dpad-left','dpad-right','ps','touchpad'];
setInterval(()=>{if(document.hidden)return;const pads=[...(navigator.getGamepads?.()??[])].filter(Boolean),s=$('gamepad'),signature=pads.map(p=>p.index+':'+p.id).join('|');if(s.dataset.signature!==signature){const old=s.value;s.replaceChildren();option(s,'','仅接收器 HID 输入');for(const p of pads)option(s,p.index,p.id);s.value=[...s.options].some(o=>o.value===old)?old:'';s.dataset.signature=signature}
 if(device&&s.value!==''){const p=pads.find(p=>p.index===Number(s.value));if(p?.mapping==='standard'){const parts=new Set(p.buttons.flatMap((b,i)=>b.pressed&&padNames[i]?[padNames[i]]:[]));paintInput({parts,axes:p.axes.slice(0,4).map(v=>Math.round((v+1)*127.5)),triggers:[p.buttons[6]?.value??0,p.buttons[7]?.value??0].map(v=>Math.round(v*255))},'手动选择的浏览器手柄')}else $('input-state').textContent=LT('此手柄未提供标准布局，请使用接收器 HID 输入。')}
 if(!device||Date.now()-lastInput>3000){{const _st=$('input-state'),_zh=(lang==='zh-CN'||lang==='zh-TW'),_raw=device?'等待手柄输入；若浏览器屏蔽 HID 输入，可手动选择上方的手柄输入源。':'连接接收器后，可点击手柄打开相应设置。',_msg=_zh?_raw:trText(_raw);if(_st.textContent!==_msg)_st.textContent=_msg;}for(const id of ['left-axis','right-axis','triggers'])$(id).textContent='—';resetLiveVisuals()}},50);
$('gamepad').onchange=()=>{lastInput=0;lastPaint=0;resetLiveVisuals();for(const id of ['left-axis','right-axis','triggers'])$(id).textContent='—'};
/* 点击快捷验证后同时打开右侧对应设置块，玩家可以接着调参数 */
function qaGoto(pageId,anchorId){
 if(page!==pageId){page=pageId;render()}
 const anchor=$(anchorId);
 const target=anchor?.closest?.('.test-card')??anchor;
 try{target?.scrollIntoView?.({block:'center',behavior:'smooth'})}catch{try{target?.scrollIntoView?.()}catch{}}
}
$('qa-rumble').onclick=()=>{if(!device)return;qaGoto('test','test-rumble');testAction(()=>outputTester.run('rumble',{left:140,right:140}))};
/* 扳机：先左后右各 2 秒。模式必须用 feedback/vibration/weapon，rigid 不存在 */
$('qa-trigger').onclick=()=>{if(!device)return;qaGoto('test','test-trigger');testAction(async()=>{
 await outputTester.run('trigger',{side:'left',mode:'feedback',strength:5,start:0});
 setTimeout(()=>{if(device)void outputTester.run('trigger',{side:'right',mode:'feedback',strength:5,start:0}).catch(()=>{})},2300);
})};
$('qa-lights').onclick=()=>{if(!device)return;qaGoto('test','test-lights');testAction(()=>outputTester.run('lights',{rgb:[102,199,255],brightness:1}))};
$('theme').onclick=()=>{document.body.classList.toggle('light');try{localStorage.setItem('bl616-theme',document.body.classList.contains('light')?'light':'dark')}catch{}};try{document.body.classList.toggle('light',localStorage.getItem('bl616-theme')==='light')}catch{}
mountLangSelect();applyI18n();
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{void stopTests();page=b.dataset.page;render()});
globalThis.addEventListener?.('blur',()=>{void stopTests()});globalThis.addEventListener?.('pagehide',()=>{void stopTests()});document.addEventListener('visibilitychange',()=>{if(document.hidden)void stopTests()});
$('firmware-notice').onclick=()=>{void stopTests();page='flash';render()};
showArt(false);render();
void autoReconnect();
