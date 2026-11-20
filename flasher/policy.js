/* Local policy for the existing LCTech BL616 oc8 partition layout. */
(function(root){
 'use strict';
 const RELEASES={"720c7816a7f66133591d9f4672a169a272437a2a4bc6996e3ee1a08b721599a6": {"model": "LCTech BL616 · oc8", "size": 794988}, "77d4eb8394bb8f7c3024da1dfb53767cb30a84464c8a53777e167a5cf379464f": {"model": "V1 单灯 · 3.18H-oc12", "size": 795832}, "b2764da1175525668e8ea2cc8ea588803927b6014b8933da49be81c0271a2efe": {"model": "V1 单灯 · 3.18H-oc11", "size": 798384}, "0618c9c1f54b43f0e01eadcf8ec341f5cf9693c24cef7c375d8bfef4b864a214": {"model": "V1 单灯 · 3.18H-oc10", "size": 798640}, "fbbba9d997bb28d9fbc2fad50a1ae9e56f0a55e5666c8b8e08c25bf9e97d7425": {"model": "V1 单灯 · 3.18H-oc9", "size": 794988}, "94b7673b03351599bf286b177d36be405a971cc02225bb8a5802a5a501f1b133": {"model": "V1.2 RGB · 3.18H-oc12", "size": 796336}, "e30d67c16b5be0c9547579e1ff71f2f70b1426f0421af7292559443056abfc4c": {"model": "V1.2 RGB · 3.18H-oc11", "size": 798880}, "74654b5e32f60453954f0a44a42bef4fdda07430c242a092aff3a24d9d422311": {"model": "V1.2 RGB · 3.18H-oc10", "size": 799136}, "8609eb7b964a3ce7f10b3ac8ac2c5fc5732a7bd3d00b01e83687162ea4e0985c": {"model": "V1.2 RGB · 3.18H-oc9", "size": 795488}};
 async function validate(data){
  if(!(data instanceof Uint8Array)||!Object.values(RELEASES).some(r=>r.size===data.length))throw Error('文件长度不属于本工程已发布固件，禁止烧录');
  if(!root.crypto?.subtle)throw Error('SHA-256 不可用，请通过 localhost 或 HTTPS 打开');
  const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  const release=RELEASES[hash];if(!release||release.size!==data.length)throw Error('固件 SHA-256 与本工程发布清单不一致，已阻止烧录');
  return {address:0x10000,length:data.length,sha256:hash,model:release.model};
 }
 root.DongleFlashPolicy=Object.freeze({validate});
})(globalThis);
