# 固件 -> 网页 同步脚本
#
#   .\sync-firmware.ps1              # 同步 web 固件目录 + 刷新清单
#   .\sync-firmware.ps1 -Build       # 同步后再重建 index.html
#
# 作用：
#   1. 把 ..\..\firmware\<板型>\ 里的 .bin 复制到本目录 firmware\<板型>\
#      （同名覆盖，旧版本保留，供网页回退）
#   2. 按版本号重新生成 firmware\<板型>\index.json
#      （version / tag / file / size / sha256 / date / notes）
#   3. 同步 firmware-version.mjs 里的 boardFirmwares，使页面顶部的
#      "本工程最新" 与实际文件一致
#
# 发版流程：
#   .\build_variants.ps1 -Variant all
#   cd web\bl616-config ; .\sync-firmware.ps1 -Build
#   然后上传 index.html 与 firmware\ 整个目录到服务器

param(
    [switch]$Build,
    [string]$FirmwareRoot
)

$ErrorActionPreference = 'Stop'
$web = $PSScriptRoot
$root = Split-Path (Split-Path $web -Parent) -Parent
if (-not $FirmwareRoot) { $FirmwareRoot = Join-Path $root 'firmware' }

$notes = @{
    9  = '早期版本，存在“已配对后不再主动扫描”问题'
    10 = '早期版本，存在板型宏与重连问题'
    11 = '过渡版本'
    12 = '当前推荐：修复板型识别、V1 回报率、更新后清配对'
    13 = '测试版：保存结果确认、鼠标映射和实际 USB 速率'
    14 = '测试版：新增左右摇杆内外死区'
    15 = '新增摇杆曲线、对角补偿、轴向限制（oc15 基线）'
    16 = '修复扬声器音量偏小；对角补偿默认关闭；BT RX 抢占音频编码；有声时输出 24ms→8ms'
    17 = '修复首次配对：无配对记录时不再扫描两次就放弃；等待/搜索状态不自动熄灯；按键日志改为 INFO'
    18 = '网页音量/增益调整即时推送到手柄，音频测试实时反映；首次配对重试修复'
    19 = '配对节奏对齐 BlueRetro：无配对时约 2 秒重扫一次；已配对未连接时 10 秒重试'
    20 = '配对双闪灯效（搜索中）；连接超时 8s→5s、L2CAP 3s→2s，失败更快重来'
    21 = '搜索状态改为呼吸灯（软件 PWM，2.4 秒一个呼吸）'
}

$labels = @{ v1 = 'DS5Dongle V1 · 单灯'; v12 = 'DS5Dongle V1.2 · RGB' }
$summary = @()

foreach ($board in 'v1', 'v12') {
    $src = Join-Path $FirmwareRoot $board
    $dst = Join-Path $web "firmware\$board"
    if (-not (Test-Path $src)) { Write-Warning "跳过 $board：找不到 $src"; continue }
    New-Item -ItemType Directory -Force -Path $dst | Out-Null

    # 1) 复制固件（同名覆盖；旧版本保留用于回退）
    Get-ChildItem $src -Filter "ds5dongle-$board-*.bin" -ErrorAction SilentlyContinue |
        Copy-Item -Destination $dst -Force
    foreach ($f in 'boot2_bl616_isp_release_v8.1.8.bin', 'partition.bin') {
        $p = Join-Path $src $f
        if (Test-Path $p) { Copy-Item $p -Destination $dst -Force }
    }

    # 2) 重建 index.json（按 oc 号数值倒序，避免 oc9 排在 oc12 前面）
    $items = @()
    Get-ChildItem $dst -Filter "ds5dongle-$board-*.bin" | ForEach-Object {
        $m = [regex]::Match($_.Name, '-(3\.18H-oc(\d+))-hs\.bin$')
        if (-not $m.Success) { return }
        $oc = [int]$m.Groups[2].Value
        $items += [pscustomobject]@{
            oc      = $oc
            version = "LCT616-DS5 $($m.Groups[1].Value)-$board"
            tag     = $m.Groups[1].Value
            file    = $_.Name
            size    = $_.Length
            sha256  = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            date    = $_.LastWriteTime.ToString('yyyy-MM-dd')
            notes   = $notes[$oc]
        }
    }
    if ($items.Count -eq 0) { Write-Warning "跳过 $board：没有匹配的固件文件"; continue }
    $items = $items | Sort-Object oc -Descending
    [pscustomobject]@{
        board    = $board
        latest   = $items[0].version
        # 注意：只有一个版本时 PowerShell 会把它解包成单个对象，必须强制成数组
        versions = @($items | Select-Object version, tag, file, size, sha256, date, notes)
    } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $dst 'index.json') -Encoding utf8

    $summary += [pscustomobject]@{
        Board    = $board
        Versions = $items.Count
        Latest   = $items[0].version
        Size     = $items[0].size
        Sha256   = $items[0].sha256.Substring(0, 12) + '…'
    }

    # 3) 同步 firmware-version.mjs 的 boardFirmwares
    $mjs = Join-Path $web 'firmware-version.mjs'
    if ($board -eq 'v12' -and (Test-Path $mjs)) {
        $state = @{}
        foreach ($b in 'v1', 'v12') {
            $idx = Get-Content (Join-Path $web "firmware\$b\index.json") -Raw | ConvertFrom-Json
            $top = $idx.versions[0]
            $state[$b] = [ordered]@{
                id      = $b
                version = $top.version
                board   = $labels[$b]
                date    = $top.date
                size    = $top.size
            }
        }
        $json = ($state.GetEnumerator() | Sort-Object Name | ForEach-Object {
            '{0}:{1}' -f $_.Key, ($_.Value | ConvertTo-Json -Compress)
        }) -join ','
        $text = Get-Content $mjs -Raw
        $new = [regex]::Replace($text, 'export const boardFirmwares=\{[\s\S]*?\};', "export const boardFirmwares={$json};", 1)
        if ($new -ne $text) { Set-Content $mjs -Value $new -Encoding utf8 -NoNewline; Write-Host 'firmware-version.mjs 已同步' }
    }
}

$summary | Format-Table -AutoSize | Out-String -Width 100 | Write-Host

# 4) 可选：重建页面
if ($Build) {
    $py = 'python'
    Push-Location $web
    # 默认瘦身构建（页面运行时从 firmware/ 取件）；需要离线单文件时用 -Embed
try { if ($Embed) { & $py build.py --embed } else { & $py build.py }; if($LASTEXITCODE -ne 0){throw '网页构建失败'} } finally { Pop-Location }
}

Write-Host '完成。记得把 index.html 和 firmware\ 整个目录上传到服务器。' -ForegroundColor Green
