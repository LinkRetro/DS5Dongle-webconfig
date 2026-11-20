# 发布规则
#   1. README / LICENSE / 提交信息 必须为英文，不出现中文
#   2. 源码注释可保留中文
#   3. 导出的仓库默认包含固件镜像（页面通过 HTTP 从 firmware/ 取件）
#   4. 导出后自动提交并推送
#
# 用法：
#   .\export-webconfig.ps1                 # 导出（含固件）并推送
#   .\export-webconfig.ps1 -NoFirmware     # 不包含固件镜像
#   .\export-webconfig.ps1 -NoPush         # 只导出并提交
#   .\export-webconfig.ps1 -Target "D:\repo"
param(
    [string]$Target = 'G:\BL616\DS5Dongle-webconfig',
    [switch]$NoPush,
    [switch]$NoFirmware
)

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot

$excludeDirs  = @('node_modules', 'work', 'logs', '.git')
$excludeFiles = @('index.html', 'auth-preview.html', 'deploy.env.json')
$excludeGlobs = @('.syntax_*.js', '*.log')

New-Item -ItemType Directory -Force -Path $Target | Out-Null
Get-ChildItem -Path $Target -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force

function Copy-Tree([string]$from, [string]$to, [switch]$Root) {
    New-Item -ItemType Directory -Force -Path $to | Out-Null
    foreach ($item in Get-ChildItem -Path $from -Force) {
        if ($excludeDirs -contains $item.Name) { continue }
        if ($Root -and $excludeFiles -contains $item.Name) { continue }
        $skip = $false
        foreach ($g in $excludeGlobs) { if ($item.Name -like $g) { $skip = $true } }
        if ($skip) { continue }
        if ($item.PSIsContainer) {
            Copy-Tree $item.FullName (Join-Path $to $item.Name)
        } else {
            if ($item.Extension -eq '.bin' -and $NoFirmware -and $to -match '\\firmware(\\|$)') { continue }
            Copy-Item $item.FullName (Join-Path $to $item.Name) -Force
        }
    }
}
Copy-Tree $src $Target -Root

# 3rd-party license copies (kept when the repo has no upstream project)
$sec = Join-Path (Split-Path (Split-Path $src -Parent) -Parent) 'security'
if (Test-Path $sec) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Target 'security') | Out-Null
    Copy-Item (Join-Path $sec '*') (Join-Path $Target 'security') -Force
}

$ignore = @'
node_modules/
/index.html
/auth-preview.html
deploy.env.json
.syntax_*.js
*.log
'@
if ($NoFirmware) { $ignore += "firmware/*/*.bin`nfirmware/*/boot2_*.bin`nfirmware/*/partition.bin`n" }
$ignore | Set-Content (Join-Path $Target '.gitignore') -Encoding utf8

Push-Location $Target
try {
    $pyExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $pyExe) { $pyExe = 'python' }
    & $pyExe build.py 2>&1 | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0) { throw '导出的仓库无法独立构建（缺少文件？）' }
    Remove-Item (Join-Path $Target 'index.html') -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path '.git')) {
        git init -q
        git config --local user.name 'LinkRetro'
        git config --local user.email 'social@linkretro.com'
        git config --local core.autocrlf false
        git remote add origin 'git@github-linkretro:LinkRetro/DS5Dongle-webconfig.git'
    }
    git add -A
    git commit -q -m "chore: sync web configurator ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host 'no changes to commit' -ForegroundColor DarkGray }
    git branch -M main
    if (-not $NoPush) {
        git push -u origin main --force | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'push failed' }
        $head = git rev-parse HEAD
        Write-Host "GitHub: main @ $($head.Substring(0,12))" -ForegroundColor Green
    }
} finally { Pop-Location }

$files = Get-ChildItem $Target -Recurse -File | Where-Object { $_.FullName -notmatch '\\\.git\\' }
$firmware = $files | Where-Object { $_.FullName -match '\\firmware\\.+\.bin$' }
"导出: $Target"
"文件数: $($files.Count)  合计 {0:N1} MB" -f (($files | Measure-Object Length -Sum).Sum / 1MB)
"固件镜像: $($firmware.Count) 个 ({0:N1} MB)" -f (($firmware | Measure-Object Length -Sum).Sum / 1MB)
