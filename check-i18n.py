import argparse
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HAN = re.compile(r'[\u3400-\u9fff]')


def unique_object(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError(f'Duplicate JSON key: {key}')
        result[key] = value
    return result


def main():
    parser = argparse.ArgumentParser(description='Check DS5Dongle translations')
    parser.add_argument('--locale', help='List missing message IDs for this locale')
    parser.add_argument('--strict', action='store_true', help='Fail on missing translations and possible unregistered copy')
    parser.add_argument('--build', action='store_true', help='Require complete translations for key-bound UI only')
    parser.add_argument('--uncovered', action='store_true', help='Fail only when unregistered literals exist')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'i18n-catalog.json').read_text(encoding='utf-8-sig'), object_pairs_hook=unique_object)
    locales, messages = catalog['locales'], catalog['messages']
    if args.locale and args.locale not in locales:
        parser.error(f'Unknown locale: {args.locale}')
    errors, uncovered, required = [], set(), set()
    sources = {entry.get('zh-CN', '').strip() for entry in messages.values()}
    for key, entry in messages.items():
        if not entry.get('zh-CN'):
            errors.append(f'{key}: missing zh-CN source')
        for locale, text in entry.items():
            if locale not in locales or not isinstance(text, str) or not text.strip():
                errors.append(f'{key}: invalid value for {locale}')
            elif set(re.findall(r'\{\w+\}', text)) != set(re.findall(r'\{\w+\}', entry.get('zh-CN', ''))):
                errors.append(f'{key}: placeholder mismatch in {locale}')
    files = [ROOT / name for name in ('template.html','app.mjs','protocol.mjs','restart.mjs','test-center.mjs','firmware-version.mjs')]
    files += sorted((ROOT / 'flasher').glob('*.js'))
    for file in files:
        source = file.read_text(encoding='utf-8-sig')
        required.update(re.findall(r"""data-i18n(?:-label)?=["']([\w.-]+)["']""", source))
        required.update(re.findall(r"""\b(?:msg|t)\(\s*["']([\w.-]+)["']""", source))
        if file.name == 'app.mjs':
            required.update(re.findall(r"""['"](nav_[a-z_]+)['"]""", source))
        if args.build:
            continue
        for line in source.splitlines():
            if file.suffix == '.html':
                literals = re.findall(r'>([^<>]+)<', line)
            else:
                literals = re.findall(r'''(?:"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`)''', line)
                literals = [''.join(groups) for groups in literals]
            for text in literals:
                text = text.strip()
                # 动态模板（含 ${...}）无法静态登记，交由运行时审计覆盖
                if HAN.search(text) and '${' not in text and text not in sources and '<' not in text:
                    uncovered.add((file.relative_to(ROOT).as_posix(), text))
    for key in sorted(required):
        if key not in messages:
            errors.append(f'Unknown key-bound message: {key}')
            continue
        absent = [locale for locale in locales if not messages[key].get(locale)]
        if absent:
            errors.append(f'{key}: missing translations for {", ".join(absent)}')
    if args.build:
        for error in errors:
            print('ERROR:', error)
        if not errors:
            print(f'i18n: {len(required)} key-bound messages checked in {len(locales)} locales')
        return bool(errors)
    missing = Counter()
    for locale in locales:
        absent = [key for key, entry in messages.items() if not entry.get(locale)]
        missing[locale] = len(absent)
        print(f'{locale}: {len(messages)-len(absent)}/{len(messages)} translated')
        if args.locale == locale:
            for key in absent:
                print(f'  {key}: {messages[key].get("zh-CN","")}')
    print(f'Possible unregistered literals: {len(uncovered)} (includes dynamic messages and non-UI strings)')
    if not args.locale:
        for location, text in sorted(uncovered):
            print(f'  {location}: {text}')
    for error in errors:
        print('ERROR:', error)
    if args.uncovered:
        return bool(errors or uncovered)
    return bool(errors or (args.strict and (sum(missing.values()) or uncovered)))


if __name__ == '__main__':
    raise SystemExit(main())
