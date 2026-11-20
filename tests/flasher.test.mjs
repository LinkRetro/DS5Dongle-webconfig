import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../flasher/'+name,import.meta.url),'utf8');
function context(){const ctx=vm.createContext({Uint8Array,DataView,ArrayBuffer,crypto:webcrypto,setTimeout,clearTimeout,console});for(const path of ['protocol.js','targets/common.js','targets/bl602.js','targets/bl616.js','targets/bl616cl.js','targets/index.js','loader.js','policy.js'])vm.runInContext(read(path),ctx);return ctx}
test('flash policy accepts bundled oc8 only; rejects wrong length, modified image and whole image',async()=>{
 const c=context(),data=new Uint8Array(readFileSync(new URL('../flasher/ds5dongle-lctech616-3.18H-oc8-hs.bin',import.meta.url)));const result=await c.DongleFlashPolicy.validate(data);assert.equal(result.address,0x10000);assert.equal(result.length,794988);await assert.rejects(c.DongleFlashPolicy.validate(data.slice(1)));data[256]^=1;await assert.rejects(c.DongleFlashPolicy.validate(data),/SHA-256/);
});
test('official workflow erases, writes and verifies only selected firmware range; no reset requested',async()=>{
 const c=context(),F=c.BflbFlasher.BflbFlasher,f=new F({},{}),events=[];
 f.handshake=async()=>{};f.getBootInfo=async()=>{f.target=c.BflbFlashTargets.CHIP_DEFS.bl616;f.version='a1'};f.setDeviceTimeout=async()=>{};f.configureBaudRate=async()=>{};f.configureFlash=async()=>({flashSize:4*1024*1024});
 f.eraseFlash=async(a,n)=>events.push(['erase',a,n]);f.writeFlash=async(d,a)=>events.push(['write',a,d.length]);f.verifyFlash=async(d,a)=>{events.push(['verify',a,d.length]);return 'verified'};f.resetToRun=async()=>{throw Error('unexpected reset')};
 await f.flash(new Uint8Array(794988),{chip:'bl616',address:0x10000,autoReset:false,runAfterFlash:false});assert.deepEqual(events,[['erase',65536,794988],['write',65536,794988],['verify',65536,794988]]);
});
test('page pins chip/address, validates before flash and includes required local assets',()=>{
 const app=read('app.js');assert.match(app,/flasher\.flash\(image/);assert.match(app,/address: 0x10000/);assert.match(app,/chip: "bl616"/);assert.match(app,/DongleFlashPolicy.validate\(image\)/);assert.match(app,/autoReset: false/);assert.match(app,/runAfterFlash: false/);assert(!app.includes('flasher.flashWhole(image'));
 for(const file of ['targets/bl616/flash_para.bin','protocol.js','loader.js','policy.js'])assert(readFileSync(new URL('../flasher/'+file,import.meta.url)).length>0);
});
test('both hardware releases have matching manifest hashes and are accepted with the correct model',async()=>{
 const c=context();for(const [variant,label]of [['v1','V1 single LED'],['v12','V1.2 RGB']]){const dir=new URL('../../../firmware/'+variant+'/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('release.json',dir),'utf8')),data=new Uint8Array(readFileSync(new URL(manifest.file,dir))),result=await c.DongleFlashPolicy.validate(data);assert.equal(result.sha256,manifest.sha256);assert.equal(result.length,manifest.size);assert(result.model.includes(label));assert(Buffer.from(data).includes(Buffer.from(manifest.version)))}
});
