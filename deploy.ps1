# 固件更新后的自动部署脚本
#
#   .\deploy.ps1 -DryRun         # 只打印将要做什么，不做改动（默认）
#   .\deploy.ps1 -Deploy         # 真正执行：上传 + 清缓存
#   .\deploy.ps1 -Deploy -RestartLocal   # 同时重启本地 8765 测试服务
#
# 配置：同目录下 deploy.env.json（参考 deploy.env.example.json）
#   {
#     "remote":  "user@ps5.ds5678.top",   // scp/ssh 目标，留空则跳过远程
#     "path":    "/var/www/ds5",          // 服务器上的站点目录
#     "sshKey":  "C:\\Users\\me\\.ssh\\id_ed25519",   // 可留空
#     "cdnZone": "",                       // Cloudflare Zone ID，留空则不清 CDN
#     "cdnToken": ""                       // Cloudflare API Token（Cache Purge 权限）
#   }

param(
    [switch]$Deploy,
    [switch]$DryRun,
    [switch]$RestartLocal,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$web = $PSScriptRoot
$cfgPath = Join-Path $web 'deploy.env.json'
$cfg = @{ remote = ''; path = ''; sshKey = ''; cdnZone = ''; cdnToken = '' }
if (Test-Path $cfgPath) {
    $loaded = Get-Content $cfgPath -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($k in 'remote', 'path', 'sshKey', 'cdnZone', 'cdnToken') {
        if ($loaded.PSObject.Properties.Name -contains $k) { $cfg[$k] = [string]$loaded.$k }
    }
}

if (-not $Deploy) { $DryRun = $true }
function Step($text) { Write-Host "== $text" -ForegroundColor Cyan }
function Would($text) { Write-Host "   [dry-run] $text" -ForegroundColor DarkGray }
function Run($text, [scriptblock]$action) {
    if ($DryRun) { Would $text } else { Write-Host "   $text"; & $action }
}

# ---------- 1) 重建页面 ----------
if (-not $SkipBuild) {
    Step '重建 index.html'
    Push-Location $web
    try { Run 'python build.py'  { & python build.py | Select-Object -Last 1 } }
    finally { Pop-Location }
}

$payload = @('index.html', 'auth-preview.html', 'firmware')
$files = foreach ($p in $payload) {
    $full = Join-Path $web $p
    if (Test-Path $full) { $full }
}
Step ("待部署：" + ($files | ForEach-Object { Split-Path $_ -Leaf }) -join ', ')

# ---------- 2) 本地 8765 服务 ----------
$localPort = 8765
$conn = Get-NetTCPConnection -LocalPort $localPort -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Step "检测到本地服务正在运行（$localPort）"
    if ($RestartLocal) {
        foreach ($c in $conn) {
            $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -match 'python') {
                Run "停止本地服务 PID $($proc.Id)" { $proc | Stop-Process -Force }
            }
        }
        Start-Sleep -Milliseconds 500
        Run '重新启动 start-web.cmd' {
            Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$(Join-Path $web 'start-web.cmd')`"" -WindowStyle Minimized
        }
    } else {
        Write-Host '   本地服务从磁盘读文件，重启不是必需的；浏览器 Ctrl+F5 即可。加 -RestartLocal 可自动重启。' -ForegroundColor DarkGray
    }
} else {
    Write-Host "本地 $localPort 未在运行（跳过）" -ForegroundColor DarkGray
}

# ---------- 3) 远程上传 ----------
if ([string]::IsNullOrWhiteSpace($cfg.remote) -or [string]::IsNullOrWhiteSpace($cfg.path)) {
    Step '远程上传：未配置 remote / path，已跳过'
} else {
    Step "上传到 $($cfg.remote):$($cfg.path)"
    $scpArgs = @()
    if ($cfg.sshKey) { $scpArgs += @('-i', $cfg.sshKey) }
    # 先传固件目录（体积大，失败也不会让页面指向不存在的文件），再传页面
    Run "scp -r firmware -> $($cfg.path)/" {
        & scp @scpArgs -r (Join-Path $web 'firmware') "$($cfg.remote):$($cfg.path)/"
        if ($LASTEXITCODE -ne 0) { throw "scp firmware 失败（$LASTEXITCODE）" }
    }
    foreach ($f in @('index.html', 'auth-preview.html')) {
        $src = Join-Path $web $f
        if (-not (Test-Path $src)) { continue }
        $remoteExists = $true
        if ($f -eq 'auth-preview.html' -and -not (Test-Path $src)) { $remoteExists = $false }
        if ($remoteExists) {
            Run "scp $f" {
                & scp @scpArgs $src "$($cfg.remote):$($cfg.path)/$f"
                if ($LASTEXITCODE -ne 0) { throw "scp $f 失败（$LASTEXITCODE）" }
            }
        }
    }
}

# ---------- 4) CDN 缓存 ----------
if ([string]::IsNullOrWhiteSpace($cfg.cdnZone) -or [string]::IsNullOrWhiteSpace($cfg.cdnToken)) {
    Step 'CDN 清缓存：未配置 cdnZone / cdnToken，已跳过'
} else {
    Step "清 Cloudflare 缓存 zone=$($cfg.cdnZone)"
    $body = @{ purge_everything = $true } | ConvertTo-Json
    Run 'POST /zones/<id>/purge_cache' {
        $r = Invoke-RestMethod -Method Post `
            -Uri "https://api.cloudflare.com/client/v4/zones/$($cfg.cdnZone)/purge_cache" `
            -Headers @{ Authorization = "Bearer $($cfg.cdnToken)"; 'Content-Type' = 'application/json' } `
            -Body $body
        if (-not $r.success) { throw "清缓存失败：$($r.errors | ConvertTo-Json -Compress)" }
    }
}

# ---------- 5) 收尾提示 ----------
Step '完成'
if ($cfg.remote) {
    Write-Host "   站点：https://$(( $cfg.remote -split '@')[-1])/" -ForegroundColor Green
} else {
    Write-Host '   本地：http://127.0.0.1:8765/index.html （记得 Ctrl+F5）' -ForegroundColor Green
}
if ($DryRun) { Write-Host '   以上均为 dry-run，加 -Deploy 才会真正执行。' -ForegroundColor Yellow }
