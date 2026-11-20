# 发布到本地站点目录（linkretro 网站开发环境）
#
#   .\stage.ps1                      # 用默认路径 H:\网站源码\linkretro\tools\DS5Dongle
#   .\stage.ps1 -Target "D:\site\tools\DS5Dongle"
#   .\stage.ps1 -WithBuild           # 先跑 release.ps1 再拷贝
#
# 只拷贝运行期需要的东西：index.html + firmware/<板型>/
param(
    [string]$Target = 'H:\网站源码\linkretro\tools\DS5Dongle',
    [switch]$WithBuild
)

$ErrorActionPreference = 'Stop'
$web = $PSScriptRoot

if ($WithBuild) {
    & "$web\release.ps1"
    if ($LASTEXITCODE -ne 0) { throw 'release.ps1 失败' }
}

$index = Join-Path $web 'index.html'
if (-not (Test-Path $index)) { throw "找不到 index.html，请先运行 .\release.ps1" }

New-Item -ItemType Directory -Force -Path $Target | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Target 'firmware') | Out-Null
Copy-Item $index (Join-Path $Target 'index.html') -Force

$pattern = '^(index\.json|ds5dongle-.*\.bin|boot2_.*\.bin|partition\.bin|release\.json|package\.json|SHA256SUMS\.txt)$'
foreach ($b in 'v1', 'v12') {
    $src = Join-Path $web "firmware\$b"
    if (-not (Test-Path $src)) { continue }
    $dst = Join-Path $Target "firmware\$b"
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Get-ChildItem $src -File | Where-Object { $_.Name -match $pattern } | Copy-Item -Destination $dst -Force
}

$files = Get-ChildItem $Target -Recurse -File
"已发布到: $Target"
"文件数: $($files.Count)  合计 {0:N1} MB" -f (($files | Measure-Object Length -Sum).Sum / 1MB)
"index.html: {0:N0} B   SHA256 {1}" -f (Get-Item (Join-Path $Target 'index.html')).Length,
    (Get-FileHash (Join-Path $Target 'index.html') -Algorithm SHA256).Hash.Substring(0, 16)
