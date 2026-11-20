// Protocol capability, not a version-string guess: bit7 supports this flow,
// bit6 holds reconnect, bit0 means an ACL object still exists.
export async function restartReceiver({read,send,pause=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now(),notify=()=>{}}){
 const valid=b=>{if(b.length<17||b[13]!==0xd3)throw Error('无法读取蓝牙状态，已取消重启');return b};
 const initial=valid(await read());if(!(initial[16]&0x80))throw Error('当前固件不支持先断开再重启，请升级到 oc12 或正常拔插接收器');
 let prepared=false;
 try{
  notify('正在断开手柄，等待蓝牙连接释放…');prepared=true;await send(4);
  const deadline=now()+5000;
  for(;;){
   const b=valid(await read());if(!(b[16]&0x40))throw Error('固件已取消断开准备，未发送重启');
   if(b[14]===0&&!(b[16]&1))break;
   if(now()>=deadline)throw Error('手柄断开超时，未发送重启，请稍后重试');
   await pause(100);
  }
  notify('手柄已断开，正在请求接收器重启…');await send(3);prepared=false;
 }catch(e){if(prepared)await send(5).catch(()=>{});throw e}
}
