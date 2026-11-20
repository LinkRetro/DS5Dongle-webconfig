// 运行时多语言审计：以英文模式加载构建产物，逐页扫描仍然出现中文的文本节点
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const {window} = parseHTML(html);
Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
  configurable: true,
  get() { return [...this.options].find(o => o.hasAttribute('selected'))?.value ?? this.options[0]?.value ?? ''; },
  set(v) { for (const o of this.options) o.toggleAttribute('selected', String(o.value) === String(v)); },
});
window.HTMLInputElement.prototype.setCustomValidity = function (s) { this.validationMessage = s; };
window.HTMLInputElement.prototype.checkValidity = function () { return !this.validationMessage; };

const timers = [];
const ctx = {
  __DS5_LANG: process.env.DS5_LANG || 'en',
  atob, Blob, URL, isSecureContext: true,
  Date: class extends Date { static now() { return 1000; } },
  document: window.document,
  navigator: { getGamepads: () => [] },          // 不连设备，只扫静态与渲染文案
  localStorage: { getItem: k => (k === 'ds5.lang' ? (process.env.DS5_LANG || 'en') : null), setItem() {} },
  setTimeout(fn, ms) { const t = {fn, ms}; timers.push(t); return t; },
  clearTimeout(t) { if (t) t.cancelled = true; },
  setInterval(fn, ms) { timers.push({fn, ms, interval: true}); },
  clearInterval() {},
  confirm: () => true,
  TextDecoder, Uint8Array, DataView, TextEncoder, Event: window.Event, console,
};
vm.runInNewContext(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1], ctx);

const CJK = /[\u4e00-\u9fff]/;
const doc = window.document;
const flush = () => new Promise(r => setTimeout(r, 5));

function scan(label) {
  const found = new Map();
  const walker = doc.createTreeWalker(doc.body, 4 /* TEXT */);
  let n;
  while ((n = walker.nextNode())) {
    const t = (n.textContent || '').trim();
    if (!t || !CJK.test(t)) continue;
    const el = n.parentElement;
    if (el && el.closest('script,style')) continue;
    const key = t.replace(/\s+/g, ' ');
    if (!found.has(key)) found.set(key, el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` : '?');
  }
  return found;
}

const pages = ['feel', 'audio', 'test', 'touch', 'remap', 'device', 'flash', 'about'];
const report = new Map();
for (const p of pages) {
  const btn = doc.querySelector(`.nav [data-page="${p}"]`);
  if (btn?.onclick) btn.onclick();
  await flush();
  for (const [text, where] of scan(p)) {
    if (!report.has(text)) report.set(text, {pages: new Set(), where});
    report.get(text).pages.add(p);
  }
}

// 首页（hero）单独扫一次
const heroFound = scan('hero');
for (const [text, where] of heroFound) if (!report.has(text)) report.set(text, {pages: new Set(['hero']), where});

const rows = [...report.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`LANG=${ctx.__DS5_LANG} 仍显示中文的文本节点: ${rows.length}`);
for (const [text, meta] of rows) console.log(`  [${[...meta.pages].join(',')}] ${meta.where} :: ${text}`);
