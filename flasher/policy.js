/* Local policy for the LCTech BL616 oc8 partition layout. */
(function(root){
 'use strict';
 const RELEASES={"720c7816a7f66133591d9f4672a169a272437a2a4bc6996e3ee1a08b721599a6": {"model": "LCTech BL616 · oc8", "size": 794988}, "5b56dc4c2cf3a43a25a74712086267b79be412259739a0a59576d935f9583c0f": {"model": "V1 单灯 · 3.18H-oc12", "size": 795840}, "ef051c4797cf07c5b7b46061a2a7882dea2a1b4f6676d254878912978e2dbe62": {"model": "V1.2 RGB · 3.18H-oc12", "size": 796344}};
 async function validate(data){
  if(!(data instanceof Uint8Array)||!Object.values(RELEASES).some(r=>r.size===data.length))throw Error('文件长度不属于本工程已发布固件，禁止烧录');
  if(!root.crypto?.subtle)throw Error('SHA-256 不可用，请通过 localhost 或 HTTPS 打开');
  const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  const release=RELEASES[hash];if(!release||release.size!==data.length)throw Error('固件 SHA-256 与本工程发布清单不一致，已阻止烧录');
  return {address:0x10000,length:data.length,sha256:hash,model:release.model};
 }
 root.DongleFlashPolicy=Object.freeze({validate});
})(globalThis);
