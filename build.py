from pathlib import Path
import sys
import subprocess
# 默认不把固件 base64 内嵌进页面（3.6MB -> 约 0.45MB）；
# 需要完全离线的单文件页面时用：python build.py --embed
EMBED_FIRMWARE = '--embed' in sys.argv
import re
r=Path(__file__).resolve().parent
subprocess.run([sys.executable, '-X', 'utf8', str(r/'check-i18n.py'), '--build'], check=True)
up=r.parent/'DS5Dongle-OLED-Config-Web'
_a=r/'assets'
_std=_a/'dualsense.svg'
_edge=_a/'dualsense-edge.svg'
# 优先用本仓库自带的 SVG（开源仓库不包含上游参考项目时也能构建）
standard=(_std if _std.exists() else up/'src/assets/dualsense.svg').read_text(encoding='utf-8-sig')
# The Edge artwork is a complete drawing of its own (573x439 viewBox), so it is
# embedded as-is instead of being overlaid on the standard controller.
edge=(_edge if _edge.exists() else up/'src/assets/dualsense-edge.svg').read_text(encoding='utf-8-sig')
import json
def module_body(name):
    source = (r/name).read_text(encoding='utf-8-sig')
    return re.sub(r'^(?:import [^\n]*\n|export )', '', source, flags=re.M)

catalog = json.loads((r/'i18n-catalog.json').read_text(encoding='utf-8-sig'))
catalog_source = json.dumps(catalog).replace('<', '\\u003c')
import hashlib
_pb = hashlib.sha1((standard + edge + catalog_source).encode('utf-8')).hexdigest()[:8]
js='const PAGE_BUILD="'+_pb+'";const catalog='+catalog_source+';\n'+'\n'.join(module_body(name) for name in (
    'protocol.mjs','test-center.mjs','i18n.mjs','i18n_phrases.mjs'
))+'\nconst STANDARD_ART='+json.dumps(standard)+';\nconst EDGE_ART='+json.dumps(edge)+';\n'+module_body('app.mjs')
# Embed serial resources and UI so file:// does not fetch binary support files.
import hashlib
_pb=hashlib.sha1((str(standard)+str(edge)+str(js)).encode('utf-8')).hexdigest()[:8]
import base64


def syntax_check(text, label):
    """打包前用 node --check 校验语法，坏文件直接中止，避免打出白屏页面。"""
    tmp = Path(__file__).resolve().parent / f'.syntax_{label}.js'
    tmp.write_text(text, encoding='utf-8')
    import shutil
    node = shutil.which('node') or shutil.which('node.cmd') or shutil.which('node.exe')
    if not node:
        print('[build] 未找到 node，跳过语法校验', file=sys.stderr)
        return
    try:
        # node 在本机是 .cmd 包装脚本，必须经 shell 调用
        r = subprocess.run(f'"{node}" --check "{tmp}"', shell=True)
        if r.returncode != 0:
            print(f'[build] 语法校验失败（{label}），已中止打包', file=sys.stderr)
            raise SystemExit(1)
    except FileNotFoundError:
        print('[build] 未找到 node，跳过语法校验', file=sys.stderr)
    finally:
        try: tmp.unlink()
        except Exception: pass

f=r/'flasher'
flash_html=(f/'index.html').read_text(encoding='utf-8-sig')
flash_style=re.search(r'<style>([\s\S]*?)</style>',flash_html)[1]+' .workspace{display:block}.panel{margin-bottom:14px}.topbar{flex-wrap:wrap;padding:12px}main{padding:12px}.brand h1{font-size:16px}'
flash_header=re.search(r'<header[\s\S]*?</header>',flash_html)[0]
flash_main=flash_header+'<main>'+re.search(r'<main>([\s\S]*?)</main>',flash_html)[1]+'</main>'
flash_main=re.sub(r'<p><a href="../index.html">[\s\S]*?</p>','',flash_main,count=1)
flash_main=flash_main.replace('href="ds5dongle-lctech616-3.18H-oc8-hs.bin"','href="flasher/ds5dongle-lctech616-3.18H-oc8-hs.bin"')
_oc8_file = f/'ds5dongle-lctech616-3.18H-oc8-hs.bin'
# 旧的 oc8 固件是可选资源：仓库不携带固件镜像时也能构建
firmware = _oc8_file.read_bytes() if (EMBED_FIRMWARE and _oc8_file.exists()) else b''
# Version catalog: a dedicated firmware/ folder beside this script holds every
# released .bin plus one index.json per board.  Publishing a new release only
# means dropping the file in and re-running this build (or uploading the folder
# to the server).  Only the newest image per board is embedded, for file:// use;
# older versions are fetched from that folder when the page is served over HTTP.
catalog={};catalog_bytes={}
for _v in ('v1','v12'):
    _idx=r/'firmware'/_v/'index.json'
    if not _idx.exists():
        continue
    catalog[_v]=json.loads(_idx.read_text(encoding='utf-8-sig'))
    for _e in catalog[_v].get('versions',[]):
        _p=r/'firmware'/_v/_e['file']
        if _p.exists():
            catalog_bytes[_e['file']]=_p.read_bytes()
board_images={}
for _v,_c in catalog.items():
    _vs=_c.get('versions') or []
    if _vs and _vs[0].get('file') in catalog_bytes:
        if EMBED_FIRMWARE:
            board_images[_v]=base64.b64encode(catalog_bytes[_vs[0]['file']]).decode()

resources={'targets/bl616/flash_para.bin':base64.b64encode((f/'targets/bl616/flash_para.bin').read_bytes()).decode()}
# Rebuild the allowed-image hashes from actual variant release files.
import hashlib
policy_file=f/'policy.js'
policy_text=policy_file.read_text(encoding='utf-8')
_policy_json=r/'firmware'/'policy.json'
computed={}
if _oc8_file.exists():
    computed[hashlib.sha256(_oc8_file.read_bytes()).hexdigest()]={'model':'LCTech BL616 · oc8','size':_oc8_file.stat().st_size}
for variant,c in catalog.items():
    label='V1 single LED' if variant=='v1' else 'V1.2 RGB'
    for entry in c.get('versions',[]):
        raw=catalog_bytes.get(entry['file'])
        if raw is None:
            continue
        computed[hashlib.sha256(raw).hexdigest()]={'model':label+' · '+entry['tag'],'size':len(raw)}

# 有固件镜像时以计算结果为准并持久化；没有镜像（开源仓库）时回读 policy.json
if catalog_bytes:
    release_policy=computed
    _policy_json.write_text(json.dumps(release_policy,ensure_ascii=False,indent=1),encoding='utf-8')
elif _policy_json.exists():
    release_policy=json.loads(_policy_json.read_text(encoding='utf-8'))
    print('policy.json: 使用仓库内白名单（本目录没有固件镜像）')
else:
    release_policy=computed

# 直接重写 policy.js，避免正则匹配失败导致旧版本哈希残留
policy_text=('/* Local policy for the LCTech BL616 oc8 partition layout. */\n'
 "(function(root){\n"
 " 'use strict';\n"
 " const RELEASES="+json.dumps(release_policy,ensure_ascii=False)+";\n"
 " async function validate(data){\n"
 "  if(!(data instanceof Uint8Array)||!Object.values(RELEASES).some(r=>r.size===data.length))throw Error('Image length does not match any published DS5Dongle release');\n"
 "  if(!root.crypto?.subtle)throw Error('SHA-256 unavailable; open the page over localhost or HTTPS');\n"
 "  const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');\n"
 "  const release=RELEASES[hash];if(!release||release.size!==data.length)throw Error('Firmware SHA-256 does not match the release list; flashing blocked');\n"
 "  return {address:0x10000,length:data.length,sha256:hash,model:release.model};\n"
 " }\n"
 " root.DongleFlashPolicy=Object.freeze({validate});\n"
 "})(globalThis);\n")
policy_file.write_text(policy_text,encoding='utf-8')
flash_scripts=['protocol.js','targets/common.js','targets/bl602.js','targets/bl616.js','targets/bl616cl.js','targets/index.js','loader.js','policy.js','app.js']
js='\n'.join((f/p).read_text(encoding='utf-8-sig') for p in flash_scripts)+'\nconst FLASH_MARKUP='+json.dumps('<style>'+flash_style+'</style>'+flash_main)+';\nglobalThis.DONGLE_FLASH_RESOURCES='+json.dumps(resources)+';\nconst BOARD_FIRMWARE_CATALOG='+json.dumps(catalog,ensure_ascii=False)+';\nconst BOARD_FIRMWARE_IMAGES='+json.dumps(board_images)+';\nconst BUNDLED_FIRMWARE='+json.dumps(base64.b64encode(firmware).decode())+';\n'+(r/'firmware-version.mjs').read_text(encoding='utf-8').replace('export ','')+'\n'+js

assert '</script' not in js.lower()
_auth_candidates=[r/'security/authority.public.json', r.parent.parent/'security/authority.public.json']
authority_path=next((c for c in _auth_candidates if c.exists()), _auth_candidates[0])
authority=json.loads(authority_path.read_text(encoding='utf-8-sig')) if authority_path.exists() else None
js=(r/'restart.mjs').read_text(encoding='utf-8').replace('export ','')+'\n'+js
js='const PRODUCTION_AUTH=false;\nconst AUTH_AUTHORITY='+json.dumps(authority)+';\n'+(r/'auth.mjs').read_text(encoding='utf-8').replace('export ','')+'\n'+js
html=(r/'template.html').read_text(encoding='utf-8-sig').replace('/*STYLE*/',(r/'style.css').read_text(encoding='utf-8-sig')).replace('/*ART*/','').replace('/*SCRIPT*/',js)
syntax_check(js,'bundle')
(r/'index.html').write_text(html,encoding='utf-8')
(r/'auth-preview.html').write_text(html.replace('const PRODUCTION_AUTH=false;','const PRODUCTION_AUTH=true;').replace('<title>BL616 · DualSense 控制台</title>','<title>BL616 · 身份认证实验版（未量产）</title>'),encoding='utf-8')
licenses=['BL616 configuration UI: locally implemented; controller SVGs reused from MarcelineVPQ/DS5Dongle-OLED-Config-Web, commit babb41488a040c2bb88affccc644e075eaa15211.\n']
# 第三方许可证：优先使用仓库自带副本（开源仓库不含上游项目），缺失则跳过
_lic_map=[('LICENSE', r/'assets/licenses/DS5Dongle-OLED-Config-Web-LICENSE.txt', up/'LICENSE'),
          ('src/assets/AL2009MAN-LICENSE.txt', r/'assets/licenses/AL2009MAN-LICENSE.txt', up/'src/assets/AL2009MAN-LICENSE.txt'),
          ('src/assets/DAIDR-LICENSE.txt', r/'assets/licenses/DAIDR-LICENSE.txt', up/'src/assets/DAIDR-LICENSE.txt')]
for _label, _local, _upstream in _lic_map:
    _f = _local if _local.exists() else _upstream
    if _f.exists():
        licenses.append('\n--- '+_label+' ---\n'+_f.read_text(encoding='utf-8-sig'))
(r/'LICENSES.txt').write_text('\n'.join(licenses),encoding='utf-8')
print('Built standalone index.html',len(html.encode('utf-8')),'bytes')
