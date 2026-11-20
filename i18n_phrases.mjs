export const JAPANESE_PATTERNS = [
 [/^BR\/EDR 相对 RSSI (-?\d+) · 已配对 (\d+) · USB (HS|FS)$/, 'BR/EDR 相対 RSSI $1 · ペアリング済み $2 台 · USB $3'],
 [/^BR\/EDR 相对 RSSI (-?\d+) · 已配对 (\d+) · USB 未知（旧固件）$/, 'BR/EDR 相対 RSSI $1 · ペアリング済み $2 台 · USB 不明（旧ファームウェア）'],
 [/^已绑定 (\d+) 个手柄$/, 'ペアリング済みのコントローラー：$1 台'],
 [/^本页有 (\d+) 项未应用$/, 'このページに未保存の変更が $1 件あります'],
 [/^本页有 (\d+) 项未应用 · 其他页有 (\d+) 项$/, '未保存：このページ $1 件 · 他のページ $2 件'],
 [/^本页没有未应用的更改 · 其他页有 (\d+) 项$/, 'このページに未保存の変更はありません · 他のページに $1 件'],
];

export const KOREAN_PATTERNS = [
 [/^本页有 (\d+) 项未应用$/, '이 페이지에 저장하지 않은 변경 사항 $1개'],
 [/^本页有 (\d+) 项未应用 · 其他页有 (\d+) 项$/, '저장하지 않은 변경: 이 페이지 $1개 · 다른 페이지 $2개'],
 [/^本页没有未应用的更改 · 其他页有 (\d+) 项$/, '이 페이지에 변경 사항 없음 · 다른 페이지에 $1개'],
 [/^已绑定 (\d+) 个手柄$/, '페어링된 컨트롤러 $1대'],
];

export const PATTERNS = String.raw`
^本页有 (\d+) 项未应用$|$1 unsaved changes on this page
^本页有 (\d+) 项未应用 · 其他页有 (\d+) 项$|$1 unsaved here · $2 on other pages
^本页没有未应用的更改 · 其他页有 (\d+) 项$|No unsaved changes here · $1 on other pages
^固件配置版本 (\d+) 不兼容$|Firmware configuration version $1 is incompatible
^正在编辑组 (\d+) · 最近读取的生效组 (\d+)$|Editing group $1 · Last read active group $2
^服务器上没有 (.+)$|File not found on the server: $1
^已连接，但映射读取失败：(.*)$|Connected, but mappings could not be read: $1
^映射未确认保存：(.*)$|Mapping save not confirmed: $1
^请输入范围内的整数：(.*)$|Enter an integer in the range $1
^设备固件：尚未连接，无法检测$|Device firmware: not connected
^BR/EDR 相对 RSSI (-?\d+) · 已配对 (\d+) · USB 未知（旧固件）$|BR/EDR relative RSSI $1 · paired $2 · USB unknown (older firmware)
^BR/EDR 相对 RSSI (-?\d+) · 已配对 (\d+) · USB (HS|FS)$|BR/EDR relative RSSI $1 · paired $2 · USB $3
^正在映射：(.+) · 蓝色高亮为编辑来源，紫色为实时按下$|Mapping: $1 · blue marks the source; purple marks live input
^实时输入 · 接收器 HID（USB 输出，已应用映射）$|Live input · Dongle HID (mapped USB output)
^实时输入 · 手动选择的浏览器手柄（USB 输出，已应用映射）$|Live input · Browser-selected gamepad
^固件 / 排队 (.*)$|Firmware / queued $1
^处理 / 提交等待 (.*)$|Processing / commit wait $1
^处理 (.*) \+ 提交等待 (.*)$|Processing $1 + commit wait $2
^已选择：(.*)$|Selected: $1
^实时输入 · (.+)$|Live input · $1
^打开接收器$|Open dongle
^(.+)% · 相对电平$|$1% · relative level
^(.+) \+ 提交等待 (.*)$|$1 + commit wait $2
^\$\{.*相对电平$|relative level
^串口已连接，波特率 (\d+)$|Serial connected at $1 baud
^已连接 · ([\d,]+) baud$|Connected · $1 baud
^串口使用 ([\d,]+) baud$|Serial at $1 baud
^已载入 (.+)，(\d+) 字节$|Loaded $1, $2 bytes
^已载入 (.+)$|Loaded $1
^写入 (.+) / (.+)$|Writing $1 / $2
^烧写成功|Flash succeeded
^(.+) 烧写完成 · (\d+) s$|$1 flashing complete · $2 s
^BootROM 握手成功（第 (\d+) 次）$|BootROM handshake OK (attempt $1)
^Flash JEDEC ID 0x([0-9a-f]+)，容量 (\d+) 字节$|Flash JEDEC ID 0x$1, capacity $2 bytes
^已加载 (.+)$|Loaded $1
^检测到 (.+)$|Detected $1
^(\\d+)% · 相对电平$|$1% · relative level
^电量 (\\d+)% · 建议充电$|Battery $1% · please charge
^电量 (\\d+)% · 正在充电$|Battery $1% · charging
^有 (\\d+) 项未应用$|$1 unsaved changes
^已切换到映射组 (\\d+)$|Switched to mapping group $1
^已绑定 (\\d+) 个手柄$|$1 controller(s) paired
^信号 .*\\((-?\\d+) dBm\\).*已配对 (\\d+) 只.*USB (HS|FS)$|Signal $1 dBm · paired $2 · USB $3
^信号 .*· 已配对 .*USB .*$|Signal — · paired — · USB —
^设备固件：(.+)$|Firmware: $1
^正在映射：.*$|Currently mapping: selected source
^最近 2 秒峰值：.*$|Last 2s peak (see axes above)
^已校准：.*$|Accel calibrated — bias recorded
^发布：(.+) · High-Speed / 125µs · (\\d+) 字节$|Release: $1 · High-Speed / 125 µs · $2 bytes
^本工程最新：(.+) · (.+)$|Latest local build: $1 · $2
^已选择：(.+)$|Selected: $1
^(.+) \\((-?\\d+) dBm\\) *· *(.*)$|$1 ($2 dBm) · $3
^固件版本：(.+)$|Firmware version: $1
^设备状态：(.+)$|Device status: $1
^(.+)轴为重力方向.*$|Dominant gravity axis recorded
^(.+)超时，请关闭其他配置页并重新插拔接收器后重试。$|$1 timed out. Close other config pages, replug the dongle and retry.
^(.+) (\\d+)（名称未授权）$|$1 $2 (name not authorized)
^(\\d+)% · .+$|$1% · level
^测试指令已发送 ·.*$|Test command sent
^(.+) 超出有效范围$|$1 is out of range
^固件配置版本 (\\d+) 不兼容.*$|Firmware config version $1 is incompatible — update the page or firmware
^正在烧写 · (.+)$|Flashing · $1
^烧写和校验完成，用时 (\\d+) 秒.*$|Flash and verify complete in $1 s. Disconnect serial, release BOOT, replug normally, then connect from the config page.
^BootROM 握手第 (\\d+) 次未响应：(.+)$|BootROM handshake attempt $1 got no response: $2
^Flash JEDEC ID 响应长度无效：(\\d+)$|Invalid flash JEDEC ID length: $1
^Flash JEDEC ID 无效：.*$|Invalid flash JEDEC ID
^Flash pin (\\d+)，配置 0x([0-9a-f]+)$|Flash pin $1, config 0x$2
^无法识别 Flash 容量 ID 0x([0-9a-f]+)$|Unknown flash capacity ID 0x$1
^镜像范围超过 Flash 容量 (\\d+) 字节$|Image exceeds flash capacity of $1 bytes
^命令 ([0-9a-f]+) 重试$|Command $1 retry
^(.+) 烧写完成 · (\\d+) s$|$1 flash complete · $2 s
`
