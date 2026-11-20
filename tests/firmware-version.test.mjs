import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firmwareStatus,latestFor} from '../firmware-version.mjs';
test('hardware variants compare only their own release stream',()=>{assert.equal(latestFor('LCT616-DS5 3.18H-oc12-v12').id,'v12');assert.equal(latestFor('LCT616-DS5 3.18H-oc12-v1').id,'v1');assert.equal(firmwareStatus('LCT616-DS5 3.18H-oc13-v12').kind,'update');assert.equal(firmwareStatus('LCT616-DS5 3.18H-oc14-v12').kind,'current');assert.equal(firmwareStatus('LCT616-DS5 3.18H-oc15-v1').kind,'newer')});
test('firmware comparison uses numeric versions and avoids unsafe downgrade/unknown board promises',()=>{
 assert.equal(firmwareStatus('LCT616-DS5 3.18H-oc7').kind,'update');assert.equal(firmwareStatus('LCT616-DS5 3.18H-oc8').kind,'current');assert.equal(firmwareStatus('LCT616-DS5 3.18H-oc10').kind,'newer');assert.equal(firmwareStatus('LCT616-DS5 3.18-oc5').kind,'manual');assert.equal(firmwareStatus('BL618-DS5 3.22').kind,'unknown');assert.equal(firmwareStatus(null).kind,'unknown');
});
