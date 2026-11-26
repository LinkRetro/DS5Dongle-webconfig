export const SIZE=32, VERSION=6;
/* config v8 body size (packed struct): 40 (v7) + 9 warp bytes = 49 */
export const BODY_SIZE={7:40,8:49,9:49,10:50,11:51,12:52,13:53,14:54,15:58,16:60};
export const CONFIG_VERSION=16;
export const fields={haptics_gain:[1,1,2,'float'],speaker_volume:[5,0,100],headset_volume:[6,0,100],speaker_gain:[7,0,7],inactive_time:[8,0,60],disable_led:[9,0,1],polling_rate_mode:[10,0,2],audio_buffer_length:[11,16,128],controller_mode:[12,0,2],enable_usb_sn:[13,0,1],ps_shortcut_enabled:[14,0,1],disable_mic:[15,0,1],disable_speaker:[16,0,1],enable_wake:[17,0,1],trigger_reduce:[18,0,10],lock_volume:[19,0,1],usb_stealth:[21,0,1],led_r:[22,0,255],led_g:[23,0,255],led_b:[24,0,255],tp_mode:[25,0,4],tp_mode_enabled_mask:[26,1,31],tp_mouse_sensitivity:[27,1,32],audio_haptic:[28,0,2],idle_save:[29,0,1],combo_window:[30,0,50],tp_block_raw:[31,0,1],gyro_aim_mode:[32,0,2],gyro_sensitivity:[33,1,100],gyro_deadzone:[34,0,50],gyro_invert_flags:[35,0,7],gyro_sens_y:[49,1,100],headset_mono:[50,0,1],mute_button_mode:[51,0,2],auto_stealth:[52,0,2],output_mode:[53,0,1],edge_l4_target:[58,0,12],edge_r4_target:[59,0,12]};
export function payload(view,id,min){const b=new Uint8Array(view.buffer,view.byteOffset,view.byteLength);if(b.length<min+1||b[0]!==id)throw Error('设备返回的数据不完整或格式不匹配');return b.slice(1)}
Object.assign(fields,{stick_left_inner:[36,0,30],stick_left_outer:[37,0,30],stick_right_inner:[38,0,30],stick_right_outer:[39,0,30],stick_left_anti:[40,0,30],stick_right_anti:[41,0,30],stick_left_curve:[42,50,200],stick_right_curve:[43,50,200],stick_left_diag:[44,0,100],stick_right_diag:[45,0,100],stick_left_restrict:[46,0,30],stick_right_restrict:[47,0,30],stick_flags:[48,0,3]});
export function decode(view){
 const head=payload(view,0xf7,SIZE);const ver=head[0];
 if(![4,5,6,7,8,9,10,11,12,13,14,15,16].includes(ver))throw Error(`固件配置版本 ${ver} 不兼容，需要 oc14 或更新固件`);
 const size=BODY_SIZE[ver]??SIZE;
 const b=payload(view,0xf7,size);
 if(b.length<size)throw Error('摇杆配置报告不完整');
 const d=new DataView(b.buffer,b.byteOffset,b.byteLength);
 return Object.fromEntries(Object.entries(fields).filter(([, [offset]])=>offset<size).map(([k,[o,,,t]])=>[k,t==='float'?d.getFloat32(o,true):b[o]]));
}
export function patch(view,changes){const supported=decode(view),raw=payload(view,0xf7,SIZE),b=raw.slice(0,(BODY_SIZE[raw[0]]??SIZE)),d=new DataView(b.buffer);for(const [k,v]of Object.entries(changes)){if(!Object.hasOwn(supported,k))throw Error('当前固件不支持此配置项：'+k);const[o,min,max,t]=fields[k];if(!Number.isFinite(v)||v<min||v>max||(t!=='float'&&!Number.isInteger(v)))throw Error(`${k} 超出有效范围`);if(t==='float')d.setFloat32(o,v,true);else b[o]=v}return b}
export function command(cmd,data=[],size=63){if(data.length+1>size)throw Error('报告数据过长');const p=new Uint8Array(size);p[0]=cmd;p.set(data,1);return p}
export function remapRead(view,profile){const b=payload(view,0xfb,126);if(b[0]>7||b[1]!==profile)throw Error('映射组回读不匹配');const table=b.slice(2,126);for(let i=0;i<31;i++){const[t,v,m,f]=table.slice(i*4,i*4+4);if(t>2||(t===0&&v>30)||(t===2&&v>2)||(f&~3))throw Error('映射表包含不支持的字段')}return {active:b[0],table}}
export function remapWrite(profile,table){if(!(profile>=0&&profile<8)||table.length!==124)throw Error('映射格式错误');remapRead(new DataView(Uint8Array.of(251,0,profile,...table).buffer),profile);return command(1,[profile,...table],127)}
export function inputParts(p){if(p.length<10)return null;const parts=new Set();const hat=p[7]&15;const hats=[['dpad-up'],['dpad-up','dpad-right'],['dpad-right'],['dpad-down','dpad-right'],['dpad-down'],['dpad-down','dpad-left'],['dpad-left'],['dpad-up','dpad-left']];for(const k of hats[hat]??[])parts.add(k);for(const [byte,names]of [[7,['square','cross','circle','triangle']],[8,['l1','r1','l2','r2','create','options','stick-l','stick-r']],[9,['ps','touchpad','mute']]])names.forEach((n,i)=>{if(p[byte]&(1<<(i+(byte===7?4:0))))parts.add(n)});return {parts,axes:[...p.slice(0,4)],triggers:[p[4],p[5]]}}

export function decodeLatency(b){
 if(b.length<51||b[17]!==0x4c||![1,2,3].includes(b[18]))return null;
 if(b[18]>=2&&b.length<59)return null;
 const v=new DataView(b.buffer,b.byteOffset+19,32),a=Array.from({length:8},(_,i)=>v.getUint32(i*4,true));
 const [count,last,average,min,max,age,queue,usb]=a;
 if(count&&(min>max||last<min||last>max||average<min||average>max||last!==queue+usb))return null;
 const result={count,last,average,min,max,age,queue,usb,recent:count>0&&age<=3000000};
 if(b[18]>=2){const extra=new DataView(b.buffer,b.byteOffset+51,8);result.queueWait=extra.getUint32(0,true);result.processing=extra.getUint32(4,true);if(count&&result.queueWait+result.processing!==queue)return null}
 if(b[18]===3){if(b.length<63)return null;result.pendingWait=new DataView(b.buffer,b.byteOffset+59,4).getUint32(0,true);if(count&&result.pendingWait>result.processing)return null;result.processingOnly=result.processing-result.pendingWait}
 return result;
}
