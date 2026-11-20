# 发布规则（必须遵守）
#   1. README / LICENSE / 提交信息 必须为英文，不出现中文
#   2. 源码注释可保留中文（内部开发效率优先，已确认保持现状）
#   3. 不包含任何固件镜像(.bin)与构建产物
#   4. 导出后自动提交并推送
#
# 用法：
#   .\export-webconfig.ps1              # 导出到 G:\BL616\DS5Dongle-webconfig 并推送
#   .\export-webconfig.ps1 -NoPush      # 只导出并提交，不推送
#   .\export-webconfig.ps1 -Target "D:\repo"
param(
    [string]$Target = 'G:\BL616\DS5Dongle-webconfig',
    [switch]$NoPush
)

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot

# 整个配置器目录都发布，只排除构建产物、依赖、固件镜像和本地私有配置
$excludeDirs  = @('node_modules', 'work', 'logs', '.git')
$excludeFiles = @('index.html', 'auth-preview.html', 'deploy.env.json')
$excludeGlobs = @('.syntax_*.js', '*.log')

New-Item -ItemType Directory -Force -Path $Target | Out-Null

Get-ChildItem -Path $Target -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force

function Copy-Tree([string]$from, [string]$to, [switch]$Root) {
    New-Item -ItemType Directory -Force -Path $to | Out-Null
    foreach ($item in Get-ChildItem -Path $from -Force) {
        if ($excludeDirs -contains $item.Name) { continue }
        # 仅排除根目录的构建产物；flasher/index.html 是源文件，必须保留
        if ($Root -and $excludeFiles -contains $item.Name) { continue }
        $skip = $false
        foreach ($g in $excludeGlobs) { if ($item.Name -like $g) { $skip = $true } }
        if ($skip) { continue }
        if ($item.PSIsContainer) {
            Copy-Tree $item.FullName (Join-Path $to $item.Name)
        } else {
            # 只跳过 firmware/ 下的固件镜像；flasher 的 flash_para.bin / eflash_loader 是必需资源
            if ($item.Extension -eq '.bin' -and $to -match '\\firmware(\\|$)') { continue }
            Copy-Item $item.FullName (Join-Path $to $item.Name) -Force
        }
    }
}
Copy-Tree $src $Target -Root
# 公钥文件：让仓库能独立复现线上页面
$sec = Join-Path (Split-Path (Split-Path $src -Parent) -Parent) 'security'
if (Test-Path $sec) { New-Item -ItemType Directory -Force -Path (Join-Path $Target 'security') | Out-Null; Copy-Item (Join-Path $sec '*') (Join-Path $Target 'security') -Force }

@'
node_modules/
/index.html
/auth-preview.html
deploy.env.json
.syntax_*.js
firmware/*/*.bin
firmware/*/boot2_*.bin
firmware/*/partition.bin
*.log
'@ | Set-Content (Join-Path $Target '.gitignore') -Encoding utf8

# 自洽性检查：导出目录必须能独立构建
Push-Location $Target
try {
    $pyExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $pyExe) { $pyExe = 'python' }
    & $pyExe build.py 2>&1 | Select-Object -Last 3
    if ($LASTEXITCODE -ne 0) { throw '导出的仓库无法独立构建（缺少文件？）' }
    Write-Host '独立构建: OK' -ForegroundColor Green
    Remove-Item (Join-Path $Target 'index.html') -Force -ErrorAction SilentlyContinue
} finally { Pop-Location }

Push-Location $Target
try {
    if (-not (Test-Path '.git')) {
        git init -q
        git config --local user.name 'LinkRetro'
        git config --local user.email 'social@linkretro.com'
        git config --local core.autocrlf false
        git remote add origin 'git@github-linkretro:LinkRetro/DS5Dongle-webconfig.git'
    }
    git add -A
    git commit -q -m "chore: sync web configurator ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host '没有变化需要提交' -ForegroundColor DarkGray }
    git branch -M main
    if (-not $NoPush) {
        git push -u origin main --force
        if ($LASTEXITCODE -ne 0) { throw 'push 失败' }
        git ls-remote --heads origin
    }
} finally { Pop-Location }

$files = Get-ChildItem $Target -Recurse -File | Where-Object { $_.FullName -notmatch '\\\.git\\' }
"导出目录: $Target"
"文件数: $($files.Count)  合计 {0:N1} MB" -f (($files | Measure-Object Length -Sum).Sum / 1MB)
