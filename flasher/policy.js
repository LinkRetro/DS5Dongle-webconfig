/* Local policy for the LCTech BL616 oc8 partition layout. */
(function(root){
 'use strict';
 const RELEASES={"720c7816a7f66133591d9f4672a169a272437a2a4bc6996e3ee1a08b721599a6": {"model": "LCTech BL616 · oc8", "size": 794988}, "a9cbedf8cd982b311a8942db96f42cd76946230fd61376e6f45501b1a33dc6a2": {"model": "V1 single LED · 3.18H-oc16", "size": 801308}, "1bbd27630671661e7b25f53442b30f0355739b2786c80d8b676ee1527fa8cb04": {"model": "V1 single LED · 3.18H-oc15", "size": 801052}, "de82a799b4c259fead0a74fefff66aabeb22edc5a117fa172b80f8c5431e3b2b": {"model": "V1 single LED · 3.18H-oc14", "size": 797304}, "609d48b8fd2bf7900fd53bb90ae6b672730610804331bd20514de2cf87b353fb": {"model": "V1 single LED · 3.18H-oc13", "size": 796280}, "5b56dc4c2cf3a43a25a74712086267b79be412259739a0a59576d935f9583c0f": {"model": "V1 single LED · 3.18H-oc12", "size": 795840}, "674e0b6c1ddf84aa9521082447467ede7c5bb81529bb6c5af5eb2a5b7bcdad64": {"model": "V1.2 RGB · 3.18H-oc16", "size": 801556}, "920c8377bd883a38ca9889275694705f820c2998adf3a5bb9c28f614fe15d4bc": {"model": "V1.2 RGB · 3.18H-oc15", "size": 801556}, "1075e00ba2cd207ff8c953197744072f03fa767c01ffb420fae9d0ec07957012": {"model": "V1.2 RGB · 3.18H-oc14", "size": 797552}, "3b67001a37ef4dba0bb172e3512ccc3922c3e5e3a60df4770fa59cd4c1e60c34": {"model": "V1.2 RGB · 3.18H-oc13", "size": 796784}, "ef051c4797cf07c5b7b46061a2a7882dea2a1b4f6676d254878912978e2dbe62": {"model": "V1.2 RGB · 3.18H-oc12", "size": 796344}};
 async function validate(data){
  if(!(data instanceof Uint8Array)||!Object.values(RELEASES).some(r=>r.size===data.length))throw Error('Image length does not match any published DS5Dongle release');
  if(!root.crypto?.subtle)throw Error('SHA-256 unavailable; open the page over localhost or HTTPS');
  const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  const release=RELEASES[hash];if(!release||release.size!==data.length)throw Error('Firmware SHA-256 does not match the release list; flashing blocked');
  return {address:0x10000,length:data.length,sha256:hash,model:release.model};
 }
 root.DongleFlashPolicy=Object.freeze({validate});
})(globalThis);
