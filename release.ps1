# 一条命令完成：编译固件 → 同步网页 → 重建页面 → 跑测试
#
#   .\release.ps1                # 全流程
#   .\release.ps1 -SkipFirmware  # 只同步网页 + 测试（改前端时用）
#   .\release.ps1 -Variant v1    # 只编某一版固件
param(
    [string]$Variant = 'all',
    [switch]$SkipFirmware
)

$ErrorActionPreference = 'Stop'
$web = $PSScriptRoot
$root = Split-Path (Split-Path $web -Parent) -Parent

function Step($t) { Write-Host "== $t" -ForegroundColor Cyan }

if (-not $SkipFirmware) {
    Step "编译固件（$Variant）"
    Push-Location $root
    try { & "$root\build_variants.ps1" -Variant $Variant } finally { Pop-Location }
}

Step '同步固件清单 + 重建页面'
Push-Location $web
try { & "$web\sync-firmware.ps1" -Build } finally { Pop-Location }

Step '语法/逻辑测试'
$fail = 0
foreach ($f in Get-ChildItem (Join-Path $web 'tests') -Filter '*.test.mjs') {
    $null = & node $f.FullName 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "  FAIL $($f.Name)" -ForegroundColor Red; $fail++ }
    else { Write-Host "  ok   $($f.Name)" -ForegroundColor DarkGray }
}
if ($fail -gt 0) { throw "$fail 个测试文件失败" }

Step 'i18n 回归检查'
Push-Location $web
try {
    $pyExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $pyExe) { $pyExe = 'python' }
    & $pyExe i18n-gate.py
    if ($LASTEXITCODE -ne 0) { throw 'i18n 回归：翻译缺口变大' }
} finally { Pop-Location }

Step '产物'
foreach ($b in 'v1', 'v12') {
    $bin = Join-Path $root "firmware\$b"
    Get-ChildItem $bin -Filter '*.bin' | Where-Object { $_.Name -match 'oc12' } | ForEach-Object {
        "{0,-42} {1,8} B  {2}" -f $_.Name, $_.Length, (Get-FileHash $_.FullName -Algorithm SHA256).Hash.Substring(0, 16)
    }
}
"index.html                               {0,8} B" -f (Get-Item (Join-Path $web 'index.html')).Length
Write-Host '完成。' -ForegroundColor Green
