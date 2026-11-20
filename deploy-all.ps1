# 一键发布：构建 → 同步清单 → 部署到站点目录 → 推送 GitHub
#
#   .\deploy-all.ps1                        # 全流程（构建 + 站点 + GitHub）
#   .\deploy-all.ps1 -SkipBuild             # 只发布，不重新构建
#   .\deploy-all.ps1 -NoGitHub              # 只部署到站点目录
#   .\deploy-all.ps1 -NoStage               # 只推 GitHub
#   .\deploy-all.ps1 -ServerCommand "..."   # 额外的服务器部署命令（可选）
#
# 站点目录与 GitHub 仓库都会带上固件镜像（firmware/<板型>/*.bin），
# 因为页面是运行时通过 HTTP 取固件的。
param(
    [switch]$SkipBuild,
    [switch]$NoGitHub,
    [switch]$NoStage,
    [string]$SiteTarget = 'H:\网站源码\linkretro\tools\DS5Dongle',
    [string]$ServerCommand
)

$ErrorActionPreference = 'Stop'
$web = $PSScriptRoot
$root = Split-Path (Split-Path $web -Parent) -Parent

function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
$fail = 0

# ---------- 1) 构建 + 同步清单 + 测试 ----------
if (-not $SkipBuild) {
    Step '构建与测试'
    $pyExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $pyExe) { $pyExe = 'python' }
    Push-Location $web
    try {
        & $pyExe build.py 2>&1 | Select-Object -Last 1
        if ($LASTEXITCODE -ne 0) { throw '构建失败' }
        foreach ($f in Get-ChildItem (Join-Path $web 'tests') -Filter '*.test.mjs') {
            $null = & node $f.FullName 2>&1
            if ($LASTEXITCODE -ne 0) { Write-Host "  FAIL $($f.Name)" -ForegroundColor Red; $fail++ }
            else { Write-Host "  ok   $($f.Name)" -ForegroundColor DarkGray }
        }
        if ($fail -gt 0) { throw "$fail 个测试失败" }
    } finally { Pop-Location }
}

# ---------- 2) 部署到站点目录 ----------
if (-not $NoStage) {
    Step "部署到站点目录：$SiteTarget"
    New-Item -ItemType Directory -Force -Path $SiteTarget | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $SiteTarget 'firmware') | Out-Null
    Copy-Item (Join-Path $web 'index.html') (Join-Path $SiteTarget 'index.html') -Force
    $policySrc = Join-Path $web 'firmware\policy.json'
    if (Test-Path $policySrc) { Copy-Item $policySrc (Join-Path $SiteTarget 'firmware\policy.json') -Force }

    foreach ($b in 'v1', 'v12') {
        $s = Join-Path $web "firmware\$b"
        if (-not (Test-Path $s)) { continue }
        $d = Join-Path $SiteTarget "firmware\$b"
        New-Item -ItemType Directory -Force -Path $d | Out-Null
        # 先清掉旧固件，避免目录里堆积历史版本
        Get-ChildItem $d -Filter '*.bin' -ErrorAction SilentlyContinue | Remove-Item -Force
        Get-ChildItem $s -File | Where-Object { $_.Name -match '^(index\.json|ds5dongle-.*\.bin|boot2_.*\.bin|partition\.bin)$' } |
            Copy-Item -Destination $d -Force
    }

    $idx = Get-Item (Join-Path $SiteTarget 'index.html')
    Write-Host ("  index.html  {0:N0} B  {1}" -f $idx.Length, (Get-FileHash $idx.FullName -Algorithm SHA256).Hash.Substring(0, 12)) -ForegroundColor Green
    foreach ($b in 'v1', 'v12') {
        Get-ChildItem (Join-Path $SiteTarget "firmware\$b") -Filter 'ds5dongle-*.bin' -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host ("  {0}\{1}  {2:N0} B" -f $b, $_.Name, $_.Length) -ForegroundColor Green
        }
    }
}

# ---------- 3) 推送 GitHub ----------
if (-not $NoGitHub) {
    Step '推送到 GitHub（含固件）'
    & (Join-Path $web 'export-webconfig.ps1') 2>&1 | Select-Object -Last 5
    if ($LASTEXITCODE -ne 0) { throw 'GitHub 发布失败' }
}

# ---------- 4) 可选的服务器部署命令 ----------
if ($ServerCommand) {
    Step '执行服务器部署命令'
    Write-Host "  $ServerCommand" -ForegroundColor DarkGray
    & cmd.exe /c $ServerCommand
    if ($LASTEXITCODE -ne 0) { throw "服务器部署命令失败（$LASTEXITCODE）" }
}

# ---------- 汇总 ----------
Step '完成'
$page = Get-Item (Join-Path $web 'index.html')
"页面: {0:N0} B  {1}" -f $page.Length, (Get-FileHash $page.FullName -Algorithm SHA256).Hash.Substring(0, 16)
foreach ($b in 'v1', 'v12') {
    $bin = Join-Path $web "firmware\$b"
    Get-ChildItem $bin -Filter 'ds5dongle-*.bin' | ForEach-Object {
        "{0,-42} {1,8:N0} B  {2}" -f $_.Name, $_.Length, (Get-FileHash $_.FullName -Algorithm SHA256).Hash.Substring(0, 16)
    }
}
if (-not $NoStage) { "站点目录: $SiteTarget" }
if (-not $NoGitHub) { 'GitHub  : github.com/LinkRetro/DS5Dongle-webconfig' }
