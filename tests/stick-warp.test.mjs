import {test} from 'node:test';
import assert from 'node:assert/strict';
import {warpStick, isNeutral} from '../stick-warp.mjs';

const C = 128;              // 中心
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

test('warp: neutral parameters are a straight pass-through', () => {
  assert.ok(isNeutral({}));
  for (const [x, y] of [[0, 0], [0, 255], [255, 0], [255, 255], [200, 60], [64, 190]]) {
    assert.deepEqual(warpStick(x, y, {}), {x, y});
  }
});

test('warp: inner deadzone zeroes the centre but keeps full deflection', () => {
  const p = {inner: 10};
  assert.deepEqual(warpStick(128, 128, p), {x: 128, y: 128});
  assert.deepEqual(warpStick(130, 129, p), {x: 128, y: 128});   // 半径 < 10%
  const far = warpStick(255, 128, p);
  assert.ok(far.x >= 253, `满推仍需打满，实际 ${far.x}`);
});

test('warp: output magnitude is continuous across the deadzone edge', () => {
  const p = {inner: 10, outer: 0, anti: 0, curve: 100};
  const inside = warpStick(128 + 13, 128, p).x - 128;   // 仍在死区内
  const outside = warpStick(128 + 14, 128, p).x - 128;  // 刚越过死区
  assert.equal(inside, 0, '死区内应完全归零');
  assert.ok(outside >= 1 && outside <= 4, `死区边界输出应接近 0，实际 ${outside}`);
});

test('warp: anti-deadzone lifts the minimum output radius', () => {
  const p = {inner: 10, anti: 20, curve: 100};
  const out = warpStick(128 + Math.round(127.5 * 0.12), C, p).x - 128;   // 刚过死区
  assert.ok(out >= 20, `反死区应至少输出 20% 半径，实际 ${out} (${(out / 127.5 * 100).toFixed(1)}%)`);
});

test('warp: curve > 1 is more sensitive near the centre', () => {
  const linear = warpStick(128 + Math.round(127.5 * 0.5), C, {inner: 0, curve: 100}).x - 128;
  const soft = warpStick(128 + Math.round(127.5 * 0.5), C, {inner: 0, curve: 200}).x - 128;
  const hard = warpStick(128 + Math.round(127.5 * 0.5), C, {inner: 0, curve: 50}).x - 128;
  // curve 越大，中心附近越灵敏（同样位移输出更大），与 OGX 的 pow(t, 1/curve) 一致
  assert.ok(hard < linear && linear < soft, `curve 排序错误: hard=${hard} linear=${linear} soft=${soft}`);
});

test('warp: diagonal compensation raises the 45-degree output towards the axis output', () => {
  const axis = warpStick(255, C, {inner: 5, outer: 5}).x - 128;
  const diagOff = warpStick(218, 218, {inner: 5, outer: 5}).x - 128;          // 约 45°
  const diagOn = warpStick(218, 218, {inner: 5, outer: 5, diag: 100}).x - 128;
  assert.ok(diagOn > diagOff, '对角补偿应提高斜向输出');
  assert.ok(diagOn <= axis + 4, `补偿不应超过轴向输出: ${diagOn} vs ${axis}`);
});

test('warp: outer trim caps the radius unless uncap is set', () => {
  const capped = warpStick(255, C, {outer: 20}).x;
  const uncapped = warpStick(255, C, {outer: 20, uncap: true}).x;
  assert.ok(capped < 255, `外圈裁剪后不应打满，实际 ${capped}`);
  assert.ok(uncapped >= 253, `uncap 后应打满，实际 ${uncapped}`);
});

test('warp: axis restriction removes slack before the axis responds', () => {
  const p = {restrict: 10};
  assert.deepEqual(warpStick(128 + Math.round(127.5 * 0.08), C, p), {x: 128, y: 128});
  const out = warpStick(255, C, p).x;
  assert.ok(out >= 253, `限制后满推仍需打满，实际 ${out}`);
});

test('warp: every output stays inside the uint8 range for extreme parameters', () => {
  const combos = [];
  for (const inner of [0, 15, 30])
    for (const outer of [0, 15, 30])
      for (const anti of [0, 15, 30])
        for (const curve of [50, 100, 200])
          for (const diag of [0, 50, 100])
            combos.push({inner, outer, anti, curve, diag, restrict: 0});
  for (const p of combos) {
    for (const [x, y] of [[0, 0], [0, 255], [255, 0], [255, 255], [1, 128], [200, 40]]) {
      const r = warpStick(x, y, p);
      assert.ok(Number.isInteger(r.x) && r.x >= 0 && r.x <= 255, `x 越界 ${r.x} for ${JSON.stringify(p)}`);
      assert.ok(Number.isInteger(r.y) && r.y >= 0 && r.y <= 255, `y 越界 ${r.y} for ${JSON.stringify(p)}`);
    }
  }
});

test('warp: symmetry — mirrored input gives mirrored output', () => {
  const p = {inner: 8, outer: 6, anti: 5, curve: 130, diag: 70};
  for (const [x, y] of [[60, 90], [200, 40], [30, 220]]) {
    const a = warpStick(x, y, p);
    const b = warpStick(255 - x, 255 - y, p);
    assert.ok(near(a.x, 255 - b.x, 2) && near(a.y, 255 - b.y, 2),
      `镜像不一致 ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
});
