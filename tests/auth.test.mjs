import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,webcrypto} from 'node:crypto';
import {verifyDeviceIdentity,authenticateHid} from '../auth.mjs';
import {certificateFor,deviceProof} from '../../../tools/security/identity.mjs';
function fixture(){const root=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),device=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),cert=certificateFor(root.privateKey,device.publicKey,'1234567890abcdef1234567890abcdef'),authority={spki:root.publicKey.export({type:'spki',format:'der'}).toString('base64')};return {root,device,cert,authority}}
test('device certificate plus fresh challenge authenticates; serial copy alone cannot',async()=>{
 const f=fixture(),nonce=randomBytes(32),proof=deviceProof(f.device.privateKey,f.cert,nonce);const result=await verifyDeviceIdentity(f.cert,nonce,proof,f.authority,webcrypto);assert.equal(result.serial,'1234567890abcdef1234567890abcdef');
 const attacker=generateKeyPairSync('ec',{namedCurve:'prime256v1'});await assert.rejects(verifyDeviceIdentity(f.cert,nonce,deviceProof(attacker.privateKey,f.cert,nonce),f.authority,webcrypto),/随机挑战/);
});
test('replayed proof, altered certificate and unrelated issuer are rejected',async()=>{
 const f=fixture(),nonce=randomBytes(32),proof=deviceProof(f.device.privateKey,f.cert,nonce);await assert.rejects(verifyDeviceIdentity(f.cert,randomBytes(32),proof,f.authority,webcrypto),/随机挑战/);
 const payload=JSON.parse(Buffer.from(f.cert.payload,'base64'));payload.serial='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';const changed={...f.cert,payload:Buffer.from(JSON.stringify(payload)).toString('base64')};await assert.rejects(verifyDeviceIdentity(changed,nonce,proof,f.authority,webcrypto),/证书签名/);
 await assert.rejects(verifyDeviceIdentity(f.cert,nonce,proof,fixture().authority,webcrypto),/证书签名/);
});
test('missing trust anchor and legacy firmware fail closed without issuing USB configuration writes',async()=>{
 const d={collections:[{featureReports:[]}],sendFeatureReport(){throw Error('must not write')}};
 await assert.rejects(authenticateHid(d,null),/生产信任公钥/);await assert.rejects(authenticateHid(d,fixture().authority),/未支持身份认证/);
});
