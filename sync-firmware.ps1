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

$StableTag = '3.18H-oc74'   # 正式版（网页固件列表打星标）

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
    22 = '扬声器音量曲线：1–100 铺满手柄可听区间 0x3D–0x64，滑块行程线性化'
    23 = '修复断开后无法回连：保留射频扫描（PS 唤醒需要）；扫描中/已连接不再关射频；USB 不再自动软断开'
    24 = '配对链路加固：分页超时 5.12→10.24 秒、连接看门狗放宽到 12 秒；固件升级不再清空配对记录'
    25 = '音频：新增峰值限幅器（消除削波杂音）、Opus 复杂度 0→1；新增 PCM 溢出计数日志'
    26 = '耳机杂音定位：耳机流改为单声道编码（保留 0xD6 tag），并记录所用音频 tag'
    27 = '音频包改走带流控的发送队列，不再因 net_buf 池空整包丢弃（杂音/卡顿主因）'
    28 = '对齐开源 DS5Dongle：始终立体声编码、队列 10×672B、complexity 0、重采样 8→16 taps'
    29 = '修复无音频：单核无法实时编码立体声（实测 11-12ms/帧），退回单声道并恢复 8-tap 重采样'
    30 = '实验版：Opus 改为浮点 CELT（利用 FPU），测量单帧编码耗时是否为立体声腾出预算'
    31 = '浮点 CELT + 每 500 帧输出编码耗时统计（avg/max/overruns），用于判断能否开立体声'
    32 = '耳机立体声：插耳机时开立体声并把带宽限到 12 kHz 以控制编码耗时；无耳机仍单声道'
    33 = '耳机音量改为 0–100 百分比并映射到可听区间（0x3D–0x7F），滑块线性化'
    34 = 'P0 优化：累积 960 样本（2×480）去掉重采样/音高偏差；定点编码 A/B'
    35 = '回退 960/定点（实测定点慢 6%、精确 20ms 供给导致卡顿）：恢复 1024+重采样+浮点'
    36 = '音频包走发送优先级槽（不再排在 0x31 后面）；限幅器改为块内斜坡（消除块边界咔哒）；有声时手柄输出降到 16ms'
    37 = '音频改 0x36 单帧报文（10 ms 一帧，延迟减半），512 样本累积'
    38 = '抑制编码尖峰：BT RX 优先级回 5（不再每包抢占编码）；编码看门狗 15→25 ms'
    39 = '报文回退 0x39 双帧（0x36 单帧在解码侧出现爆音）；保留 RX 优先级/看门狗改动'
    40 = '音频遥测增加 PCM 缓冲水位 fill（为弹性缓冲判断漂移方向，行为不变）'
    41 = '配对：长按 BOOT 清配对时把相关手柄加入持久黑名单，PS 键自动重连会被拒绝，必须 PS+Create 重配'
    42 = '修正 SDK 地址 API 误用：配对完成时用 BR 地址（此前 bt_conn_get_dst 返回 LE 联合体，导致地址错位一位）'
    43 = '修复 PS+Create 无法重配：黑名单不再掐断连接/通道，只在配对成功时解封'
    44 = 'inquiry 名称过滤（只认 DualSense，防邻居手柄抢连）+ 握手失败跳过表；BOOT 连按 5 次清空黑名单'
    45 = 'inquiry 选型统一（结束扫描路径也按名称识别）；无名称手柄不再自动选中；扫描日志打印设备名'
    46 = '新增兼容性诊断接口（0xFA）：手柄型号/地址/EIR 名称/握手结果/配对与扫描计数/音频健康度，供网页导出'
    47 = '诊断信息补充硬件上下文：板型（v1 / v1.2）与 USB 枚举速率；网页支持下载诊断文本'
    48 = '修复诊断卡片取不到数据：HID 描述符补声明 0xFA 报告，并按声明长度返回 63 字节'
    49 = '修复 0xFA 描述符截断（数组长度未同步 +8，导致 End Collection 被丢弃、HID 无法枚举）'
    50 = '诊断面板移到接收器页；地址/名称在仅重连场景下也能显示（地址回落 + EIR 名称持久化）'
    51 = '诊断面板改为可折叠；地址优先取当前连接（修正字节错位）；描述符长度加编译期断言'
    52 = '诊断补充最后一轮扫描 RSSI；未连接时不再显示虚假型号（便于排查连不上的情况）'
    53 = '修复按键映射到鼠标键无效：不再要求先开触摸板鼠标模式'
    54 = '按键映射组由 2 套扩展到 8 套；Create+方向键上下 循环切换分组'
    55 = '陀螺仪当鼠标：可选常开或按住 L2 激活，支持灵敏度/死区/轴向反转（网页新增设置）'
    56 = 'DualSense Edge 探测版：连接 Edge 后按 Fn/背键，串口会打印尚未解析字节的位图（用于确认按键位后再正式映射）'
    57 = '修复陀螺仪当鼠标左右几乎不动（水平改取 Y 轴偏航）；新增轴向反转/交换选项'
    58 = '陀螺仪当鼠标移到触摸板与鼠标页；左右/上下灵敏度可分别调节（配置版本 10）'
    59 = '修复开陀螺仪当鼠标后音频卡顿：鼠标上报限流到 200Hz（位移累加，不丢精度）'
    60 = '音频任务优先级提到与 USB 同级；陀螺仪采样降到 200Hz，进一步让出 CPU 给音频编码'
    61 = '连不上时自愈：连续 3 次 L2CAP 握手失败自动清除失效配对，提示用 PS+Create 重新配对'
    62 = '音频遥测增加发包耗时 tx（诊断偶发卡顿是编码慢还是发包慢）'
    63 = 'Edge 探测加强：按 Fn/背键时打印 0x20-0x3F 原始字节（用于定位按键位，正式映射下一版）'
    64 = '弱链路自适应：远距离时降低手柄上报频率、暂停音频转触觉；音频发送失败不再阻塞；遥测增加 drop/rssi'
    65 = '网页显示链路质量（按音频丢帧率计算）；RSSI 为 0 时如实显示为未知'
    66 = '音质修复：限幅器释放加快（消除音乐抽吸感）；扬声器改为 12 kHz 宽带编码'
    67 = '耳机孔中高频呲呲声修复：限幅器改为逐样本软包络 + 2.5 dB 余量，消除槽率调制与削波'
    68 = '新增耳机输出立体声/单声道切换：单声道 160 kbps，中高频更干净（配置版本 11）'
    69 = '音频优先级队列改为 2 深；音频排队时跳过一次手柄上报，修复持续破音/断续（drop 归零）'
    70 = '信号条修复：没有播放音频时也显示链路状态；网页诊断轮询不再依赖当前标签页，刷新更快'
    71 = '手柄静音键现在有作用：按下同时静音麦克风与手柄/耳机音频，再按恢复（PC 上原本无人响应这个键）'
    72 = '静音键行为可选（麦克风+音频 / 仅麦克风 / 仅音频），按下时点亮手柄橙色静音灯（配置版本 12）'
    73 = '无手柄时自动隐藏接收器：配对过后断开 5 秒即从电脑移除，Windows 声音自动回到音箱，不必拔接收器（配置版本 13）'
    74 = '更聪明的释放方式：默认只隐藏音频接口（HID 保留，网页仍可连），3 秒未枚举会自动回滚；可选隐藏整个接收器'
    75 = '实验：新增 Xbox 360 (XInput) 输出模式，兼容只认 XInput 的老游戏与模拟器（无音频/触觉/自适应扳机）'
    76 = '修复 XInput 模式枚举失败：全速（other-speed）描述符也要切到 Xbox 布局；启动日志打印当前输出模式'
    77 = 'XInput 模式逃生开关：开机 3 秒内按住 BOOT 1.5 秒，或手柄 PS+Options 长按 3 秒，即可切回 DualSense 并重启'
    78 = '修复 oc77 启动崩溃：调度器启动前误用 vTaskDelay 导致 Store/AMO access fault（BOOT 逃生窗口）'
    79 = 'XInput 模式保留最小 HID 配置接口：切到 Xbox 模式后网页仍能连接并切回；构建新增启动路径静态检查'
    80 = 'XInput 模式再加一个完整 DualSense HID 手柄接口，确保 Chrome/网页一定能看到设备并切回'
    81 = '修复 XInput 模式网页看不到设备：复合设备的设备级类改为 0x00，Windows 才会加载 usbccgp 并枚举 HID 接口'
    82 = 'XInput 改用 045E:02FD：避开 xusb22 对 028E 的设备级独占，保证复合枚举与网页连接；Xbox 驱动走接口类匹配'
    83 = 'XInput 恢复单接口 045E:028E（与原装 360 手柄一致），产品名也显示为 Xbox 360 Controller；切回 DualSense 请用 PS+Options 长按 3 秒'
    84 = 'XInput 补上 17 字节 XID 描述符（xusb22 识别 XInput 的关键），端点改为原装的 0x81/0x01，震动报文偏移修正'
    85 = 'XInput 输入诊断版：打印前 5 帧与每千帧发送结果（返回值、按钮、摇杆），用于定位 joy.cpl 无输入'
    86 = 'XInput 诊断二：转发心跳与 busy 卡死计数，区分蓝牙输入中断还是端点发送完成回调丢失'
    87 = 'XInput 发送超时自愈：IN 端点 20ms 未完成就重发，修复第 2 帧后输入全被丢弃（joy.cpl 无输入）'
    88 = 'XInput 改为标准常驻发送模型：端点始终挂着一帧、完成即重挂，形成连续 1ms 流，避免主机 STALL 后停轮询'
    89 = 'XInput 端点拆分 0x81/0x02（BL616 共用端点号 1 时 IN 传输无法完成），并增加发送完成计数'
    90 = 'XInput 传输自检：A 键 2Hz 自动闪烁，用于区分“主机没收到”与“映射不对”'
    91 = 'XInput 无手柄也持续上报中性帧（周期 kick），自检不再依赖蓝牙输入；修正 oc90 自检未运行的问题'
    92 = '移除 A 键自检图案（测试已完成，留着会导致 A 键永久按下）；保留真实按键映射与边沿日志'
    93 = 'XInput 发送改为双缓冲乒乓 + STALL 自愈：发送中的报文不再被改写，管道卡住 20ms 自动 clear_stall 重试'
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
            stable  = ($m.Groups[1].Value -eq $StableTag)
        }
    }
    if ($items.Count -eq 0) { Write-Warning "跳过 $board：没有匹配的固件文件"; continue }
    $items = $items | Sort-Object oc -Descending
    [pscustomobject]@{
        board    = $board
        latest   = $items[0].version
        # 注意：只有一个版本时 PowerShell 会把它解包成单个对象，必须强制成数组
        versions = @($items | Select-Object version, tag, file, size, sha256, date, notes, stable)
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
