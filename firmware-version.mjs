export const latestFirmware={version:'LCT616-DS5 3.18H-oc8',board:'LCTech BL616',date:'2026-11-14',size:794988};
export const boardFirmwares={v1:{"id":"v1","version":"LCT616-DS5 3.18H-oc92-v1","board":"DS5Dongle V1 · 单灯","date":"2026-11-26","size":813408},v12:{"id":"v12","version":"LCT616-DS5 3.18H-oc92-v12","board":"DS5Dongle V1.2 · RGB","date":"2026-11-26","size":813908}};
export function catalogFor(version){
 const board=version?.match(/-(v1|v12)$/)?.[1];
 const cat=typeof BOARD_FIRMWARE_CATALOG!=='undefined'?BOARD_FIRMWARE_CATALOG:null;
 if(!board||!cat||!cat[board]?.versions?.length)return null;
 return cat[board].versions;
}
export function latestFor(version){return boardFirmwares[version?.match(/-(v1|v12)$/)?.[1]]??latestFirmware}
export function firmwareStatus(version){
 if(!version)return {kind:'unknown',text:'连接接收器后读取设备版本'};
 const variant=version.match(/^LCT616-DS5 3\.18H?-oc(\d+)-(v1|v12)$/);
 if(variant){const n=Number(variant[1]),latest=Number(latestFor(version).version.match(/-oc(\d+)-/)?.[1]);return n===latest?{kind:'current',text:'已是对应硬件的最新版本'}:n<latest?{kind:'update',text:'对应硬件有新版固件'}:{kind:'newer',text:'设备版本较新，不建议降级'}}
 const parse=v=>/^LCT616-DS5 (\d+)\.(\d+)(H?)-oc(\d+)$/.exec(v);
 const current=parse(version),latest=parse(latestFirmware.version);
 if(!current)return {kind:'unknown',text:'当前固件不属于可比较的本工程版本，请核对板型和版本'};
 if(current[3]!==latest[3])return {kind:'manual',text:'可切换到 oc8 High-Speed 固件，请核对板型与现有分区'};
 const a=[+current[1],+current[2],+current[4]],b=[+latest[1],+latest[2],+latest[4]];
 const i=a.findIndex((v,i)=>v!==b[i]);
 return i<0?{kind:'current',text:'已是本页面收录的最新版本'}:a[i]<b[i]?{kind:'update',text:'有本工程固件更新可用'}:{kind:'newer',text:'设备版本高于本页面收录版本，不建议降级'};
}
