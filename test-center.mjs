// Independently encoded from the DualSense output layout and Nielk1's trigger protocol notes.
const integer=(n,min,max)=>{if(!Number.isInteger(n)||n<min||n>max)throw Error('测试参数超出范围');return n};
export function triggerEffect(mode='off',strength=3,start=3){
 const b=new Uint8Array(11);b[0]=5;if(mode==='off')return b;
 integer(strength,1,8);integer(start,0,9);
 if(mode==='weapon'){if(start<2||start>7)throw Error('段落阻力起点需为 2–7');b[0]=0x25;const mask=(1<<start)|(1<<8);b[1]=mask&255;b[2]=mask>>8;b[3]=strength-1;return b}
 if(!['feedback','vibration'].includes(mode))throw Error('未知扳机效果');
 b[0]=mode==='feedback'?0x21:0x26;let mask=0,packed=0;for(let i=start;i<10;i++){mask|=1<<i;packed|=(strength-1)<<(i*3)}
 b[1]=mask&255;b[2]=mask>>8;new DataView(b.buffer).setUint32(3,packed>>>0,true);if(mode==='vibration')b[9]=30;return b;
}
export function testOutput(kind,values={},edge=false){
 const b=new Uint8Array(edge?63:47);
 if(kind==='rumble'){b[0]=3;b[2]=integer(values.right??0,0,255);b[3]=integer(values.left??0,0,255)}
 else if(kind==='trigger'){if(!['left','right'].includes(values.side))throw Error('未知扳机');b[0]=values.side==='left'?8:4;b.set(triggerEffect(values.mode,values.strength,values.start),values.side==='left'?21:10)}
 else if(kind==='lights'){
  b[1]=0x04;
  if(values.mic!=null){b[1]|=0x01;b[8]=integer(values.mic,0,2)}
  if(values.players!=null){b[1]|=0x10;b[43]=integer(values.players,0,31)}
  b[38]=0x03;b[41]=2;b[42]=integer(values.brightness??0,0,2);
  const rgb=values.rgb??[0,0,0];if(rgb.length!==3)throw Error('灯色无效');rgb.forEach((v,i)=>b[44+i]=integer(v,0,255))
 }
 else throw Error('未知测试');return b;
}
export function createOutputTester({getDevice,isConnected,getColor,notify,onState=()=>{},timer=setTimeout,cancel=clearTimeout}){
 let generation=0,active=null,timeout=null,queue=Promise.resolve();
 const send=(d,b)=>{const task=queue.catch(()=>{}).then(()=>{if(!d.opened)throw Error('设备接口已关闭');return d.sendReport(2,b)});queue=task;return task};
 async function stop(){generation++;cancel(timeout);timeout=null;const previous=active;active=null;onState();if(!previous)return true;
  const {d,kind,values,color}=previous;
  const reset=kind==='lights'?{rgb:color,players:values.players==null?null:0,brightness:values.brightness==null?null:0}:kind==='trigger'?{side:values.side,mode:'off'}:{};
  try{await send(d,testOutput(kind,reset,d.productId===0x0df2));notify(kind==='lights'?'已发送连接灯色；若试过玩家灯，会将其关闭。':'已发送停止测试指令');return true}
  catch(e){notify('停止指令未送达，请断开手柄以复位：'+e.message,'error');return false}
 }
 async function run(kind,values){
  const myGeneration=generation+1;const stopping=stop();const reset=await stopping;if(generation!==myGeneration)return;if(!reset)throw Error('上次测试复位失败，请先断开手柄复位，再重新测试');
  const d=getDevice();if(!d?.opened||!isConnected())throw Error('请先连接手柄，并等待顶部显示“手柄已连接”');
  const b=testOutput(kind,values,d.productId===0x0df2);active={d,kind,values,color:getColor().slice()};onState();
  try{await send(d,b);if(generation!==myGeneration)return;notify('测试指令已发送 · '+(kind==='lights'?'5':'2')+' 秒后自动复位');timeout=timer(()=>{void stop()},kind==='lights'?5000:2000)}
  catch(e){await stop();throw e}
 }
 async function previewColor(rgb,{hold=false}={}){
  const d=getDevice();
  if(!d?.opened||!isConnected())return;
  if(active?.d!==d||active.kind!=='lights'||active.values.players!=null||active.values.mic!=null||active.values.brightness!=null){
   if(!hold)return run('lights',{rgb});
   /* hold: take ownership of the light without any auto-revert timer, so the
    * colour the user picks stays on the controller until they stop or save. */
   const reset=await stop();if(!reset)throw Error('上次测试复位失败，请先断开手柄复位，再重新测试');
   generation++;cancel(timeout);timeout=null;
   active={d,kind:'lights',values:{rgb},color:getColor().slice()};onState();
   return send(d,testOutput('lights',{rgb},d.productId===0x0df2));
  }
  const token=++generation;
  cancel(timeout);timeout=null;
  try{
   await send(d,testOutput('lights',{rgb},d.productId===0x0df2));
   if(!hold&&token===generation)timeout=timer(()=>{void stop()},5000);
  }catch(e){if(token===generation)await stop();throw e}
 }
 return {run,previewColor,stop,isActive:()=>active!==null};
}

export function createAudioTester({env=globalThis,notify,onLevel=()=>{},onState=()=>{}}){
 let generation=0,context=null,stream=null,tick=null,timeout=null,pendingMic=false;
 function stop(){generation++;pendingMic=false;env.clearInterval(tick);env.clearTimeout(timeout);tick=timeout=null;stream?.getTracks().forEach(t=>t.stop());stream=null;const c=context;context=null;if(c)void c.close().catch(()=>{});onLevel(0);onState();}
 async function tone(output=''){
  stop();const token=generation;const Audio=env.AudioContext??env.webkitAudioContext;if(!Audio)throw Error('浏览器不支持音频测试');
  const c=new Audio();context=c;onState();
  try{if(output){if(!c.setSinkId)throw Error('此浏览器无法选择输出设备，请在系统声音设置中选择');await c.setSinkId(output)}await c.resume();if(token!==generation)return;
   const oscillator=c.createOscillator(),gain=c.createGain();oscillator.frequency.value=440;gain.gain.value=.707;oscillator.connect(gain).connect(c.destination);oscillator.start();oscillator.stop(c.currentTime+1);timeout=env.setTimeout(()=>{stop();notify('测试音已结束')},1100);notify('正在播放 1 秒测试音 · 请确认所选输出设备')
  }catch(e){if(token===generation)stop();throw e}
 }
 async function microphone(input=''){
  stop();const token=generation;if(!env.navigator.mediaDevices?.getUserMedia)throw Error('无法使用麦克风，请检查浏览器权限与安全上下文');
  pendingMic=true;onState();
  let acquired;
  try{acquired=await env.navigator.mediaDevices.getUserMedia({audio:{...(input?{deviceId:{exact:input}}:{}),echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
  catch(e){if(token===generation)stop();throw e}
  if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return}pendingMic=false;stream=acquired;onState();
  try{const Audio=env.AudioContext??env.webkitAudioContext;context=new Audio();await context.resume();if(token!==generation)return;const analyser=context.createAnalyser();analyser.fftSize=1024;context.createMediaStreamSource(stream).connect(analyser);const samples=new Float32Array(1024);
   tick=env.setInterval(()=>{analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length);onLevel(Math.min(100,Math.max(0,(20*Math.log10(Math.max(rms,.001))+60)/60*100)))},50);
   timeout=env.setTimeout(()=>{stop();notify('麦克风测试已结束')},30000);notify('正在读取麦克风电平 · 不录音、不回放，30 秒后停止')
  }catch(e){if(token===generation)stop();throw e}
 }
 return {tone,microphone,stop,isActive:()=>!!(context||stream||pendingMic)};
}
