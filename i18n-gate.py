#!/usr/bin/env python3
"""i18n 回归闸门：允许既有翻译缺口，但禁止缺口变大。

用法：
  python i18n-gate.py             # 与基线比较，变差则失败（发布链调用）
  python i18n-gate.py --update    # 把当前状态写成新基线（补完语言后执行）

判定规则：
  1. 任一语言的已翻译条数下降 → 失败
  2. 未注册字面量数量上升 → 失败
  3. 基线里没有的新语言 / 新消息总数变化只做提示

`check-i18n.py --build` 仍然是硬性门槛（键绑定 UI 必须 13 语言齐全），
本脚本额外盯住 phrase.* 这类长尾缺口，防止"翻译越修越少"。
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASELINE = ROOT / 'i18n-baseline.json'
CHECKER = ROOT / 'check-i18n.py'


def measure():
    import os
    env = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
    out = subprocess.run([sys.executable, '-X', 'utf8', str(CHECKER)],
                         capture_output=True, text=True, encoding='utf-8',
                         errors='replace', env=env)
    text = out.stdout or ''
    coverage = {}
    for m in re.finditer(r'^(\S+): (\d+)/(\d+) translated$', text, re.M):
        coverage[m.group(1)] = int(m.group(2))
    total = max((int(m.group(3)) for m in re.finditer(r'^(\S+): (\d+)/(\d+) translated$', text, re.M)), default=0)
    uncovered = max((int(m.group(1)) for m in re.finditer(r'Possible unregistered literals: (\d+)', text)), default=0)
    return {'total': total, 'coverage': coverage, 'uncovered': uncovered}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--update', action='store_true')
    args = ap.parse_args()

    now = measure()
    if args.update:
        BASELINE.write_text(json.dumps(now, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'基线已更新：{now["total"]} 条消息，未注册 {now["uncovered"]}')
        return 0

    if not BASELINE.exists():
        print('没有 i18n-baseline.json，先用 --update 建立基线')
        return 0

    base = json.loads(BASELINE.read_text(encoding='utf-8'))
    problems = []
    for locale, count in base['coverage'].items():
        current = now['coverage'].get(locale, 0)
        if current < count:
            problems.append(f'{locale}: 已翻译 {current} < 基线 {count}')
    if now['uncovered'] > base['uncovered']:
        problems.append(f'未注册字面量 {now["uncovered"]} > 基线 {base["uncovered"]}')
    if now['total'] < base['total']:
        problems.append(f'消息总数 {now["total"]} < 基线 {base["total"]}（可能误删条目）')

    improved = [f'{k}: {v} > {base["coverage"].get(k, 0)}' for k, v in now['coverage'].items()
                if v > base['coverage'].get(k, 0)]

    if problems:
        print('i18n 回归：')
        for p in problems:
            print('  FAIL ' + p)
        print('如果这是有意的（例如删除了文案），用 --update 重建基线。')
        return 1
    print(f'i18n 无回归：{now["total"]} 条消息，最低覆盖率 '
          f'{min(now["coverage"].values()) if now["coverage"] else 0}/{now["total"]}，未注册 {now["uncovered"]}')
    if improved:
        print('  变好：' + ', '.join(improved[:6]) + (' ...' if len(improved) > 6 else ''))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
