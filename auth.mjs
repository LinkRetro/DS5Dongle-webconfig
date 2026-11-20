// WebHID authentication protocol v1. This is a verifier, never a key store.
const authBytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const authJoin=(...parts)=>{const b=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){b.set(p,o);o+=p.length}return b};
export async function verifyDeviceIdentity(certificate,nonce,proof,authority,cryptoAPI=globalThis.crypto){
 if(nonce.length!==32||proof.length!==64)throw Error('认证响应长度无效');
 if(!authority?.spki)throw Error('尚未配置生产信任公钥');
 const raw=authBytes(certificate.payload),signature=authBytes(certificate.signature);
 if(raw.length>1024||signature.length!==64)throw Error('设备证书格式无效');
 const root=await cryptoAPI.subtle.importKey('spki',authBytes(authority.spki),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 if(!await cryptoAPI.subtle.verify({name:'ECDSA',hash:'SHA-256'},root,signature,raw))throw Error('设备证书签名不通过');
 const body=JSON.parse(new TextDecoder().decode(raw));
 if(body.v!==1||body.model!=='BL616-V1.2'||!/^[0-9a-f]{32}$/.test(body.serial))throw Error('设备证书型号或版本不支持');
 const key=await cryptoAPI.subtle.importKey('raw',authBytes(body.publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const digest=new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',raw));
 const message=authJoin(new TextEncoder().encode('DS5DONGLE-AUTH-V1\0'),nonce,digest);
 if(!await cryptoAPI.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,proof,message))throw Error('设备未通过随机挑战验证');
 return {serial:body.serial,model:body.model};
}
export async function authenticateHid(d,authority,{cryptoAPI=globalThis.crypto,timeout=5000}={}){
 if(!authority?.spki)throw Error('尚未配置生产信任公钥，禁止配置');
 if(!d.collections.some(c=>c.featureReports?.some(r=>r.reportId===0xfc)))throw Error('设备固件未支持身份认证，请使用生产签发流程升级；这不等同于克隆设备');
 const deadline=Date.now()+10000;
 const bounded=p=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('设备身份读取超时')),timeout);Promise.resolve(p).then(v=>{clearTimeout(t);resolve(v)},e=>{clearTimeout(t);reject(e)})});
 const command=async(op,data=[])=>{const b=new Uint8Array(127);b[0]=op;b.set(data,1);await bounded(d.sendFeatureReport(0xfc,b))};
 const response=async()=>{for(;;){if(Date.now()>deadline)throw Error('设备身份验证超时');const view=await bounded(d.receiveFeatureReport(0xfc));let b=new Uint8Array(view.buffer,view.byteOffset,view.byteLength);if(b[0]===0xfc)b=b.slice(1);if(b[0]===1){await new Promise(r=>setTimeout(r,50));continue}if(b[0]!==0||b.length<3)throw Error('设备认证状态无效');const n=b[1]|b[2]<<8;if(n>124||b.length<3+n)throw Error('设备认证分块无效');return b.slice(3,3+n)}};
 let parts=[],length=0;
 for(let offset=0;offset<=2048;){await command(0x10,[offset&255,offset>>8]);const b=await response();parts.push(b);length+=b.length;if(length>2048)throw Error('设备证书过长');if(b.length<124)break;offset+=b.length}
 const cert=JSON.parse(new TextDecoder().decode(authJoin(...parts)));
 const nonce=cryptoAPI.getRandomValues(new Uint8Array(32));await command(0x20,nonce);const proof=await response();
 return verifyDeviceIdentity(cert,nonce,proof,authority,cryptoAPI);
}
