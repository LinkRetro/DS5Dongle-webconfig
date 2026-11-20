/* OGX-Mini 风格的摇杆径向死区算法（Deadzone Warp）参考实现
 *
 * 参数与固件 config v8 一一对应：
 *   inner    0..30  内死区（%，半径）
 *   outer    0..30  外圈裁剪（%，半径上限 = 100-outer）
 *   anti     0..30  反死区（%，死区外的最小输出半径）
 *   curve    50..200 响应曲线（50=0.5 更细，100=线性，200=2.0 更硬）
 *   diag     0..100 对角补偿强度（0=关闭）
 *   uncap    bool   取消外圈裁剪
 *   restrict 0..30  轴向限制（%，先扣掉轴向无效行程）
 *
 * 输入 x / y 为 DualSense 原始值 0..255，中心 127.5。
 */

const DIAG_DIVISOR = 0.29289;   // 1 - sqrt(0.5)，与 OGX 一致
const DIAG_GAIN = 0.41421;      // sqrt(2) - 1：对角处单轴补偿到 1.0 所需倍数

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function axisRestrict(n, percent) {
  const r = percent / 100;
  if (!r) return n;
  const mag = Math.abs(n);
  const scaled = mag <= r ? 0 : (mag - r) / (1 - r);
  return n < 0 ? -scaled : scaled;
}

/**
 * 处理一只摇杆。
 * @returns {{x:number,y:number}} 0..255 的输出（中心 128）
 */
export function warpStick(x, y, p = {}) {
  if (isNeutral(p)) return {x, y};
  const inner = (p.inner ?? 0) / 100;
  const anti = (p.anti ?? 0) / 100;
  const curve = clamp((p.curve ?? 100) / 100, 0.5, 2);
  const diag = clamp((p.diag ?? 0) / 100, 0, 1);
  const restrict = clamp(p.restrict ?? 0, 0, 30);
  const uncap = !!p.uncap;

  const nx = clamp((x - 127.5) / 127.5, -1, 1);
  const ny = clamp((y - 127.5) / 127.5, -1, 1);

  const ax = axisRestrict(nx, restrict);
  const ay = axisRestrict(ny, restrict);
  const mag = Math.hypot(ax, ay);

  if (mag <= inner) return { x: 128, y: 128 };

  // 归一化到死区外的行程
  let t = (mag - inner) / (1 - inner);
  t = clamp(t, 0, 1);
  if (curve !== 1) t = Math.pow(t, 1 / curve);

  // 输出半径：anti 起步，满行程到 1.0；outer 只做上限裁剪（与 OGX 的 dz_outer 一致）
  const cap = clamp(1 - (p.outer ?? 0) / 100, 0.05, 1);
  let out = anti + t * (1 - anti);
  if (!uncap && out > cap) out = cap;

  // 对角补偿：角度越接近 45°，单轴补偿越大
  if (diag > 0 && mag > 1e-6) {
    const angle = Math.atan2(Math.abs(ay), Math.abs(ax)) * 180 / Math.PI; // 0..90
    const d = angle <= 45 ? angle : 90 - angle;                          // 0..45
    const c = 1 - Math.sqrt(1 - Math.pow((d / 45) * Math.SQRT1_2, 2));   // 0..0.29289
    out *= 1 + diag * DIAG_GAIN * (c / DIAG_DIVISOR);
  }

  // 反解回 XY
  const ux = mag > 1e-6 ? ax / mag : 0;
  const uy = mag > 1e-6 ? ay / mag : 0;
  const ox = clamp(ux * out, -1, 1);
  const oy = clamp(uy * out, -1, 1);

  return {
    x: Math.round(clamp(127.5 + ox * 127.5, 0, 255)),
    y: Math.round(clamp(127.5 + oy * 127.5, 0, 255)),
  };
}

/** 参数是否全部为中性（此时算法等价于直通） */
export function isNeutral(p = {}) {
  return !(p.inner || p.outer || p.anti || p.diag || p.restrict || p.uncap) && (p.curve ?? 100) === 100;
}
