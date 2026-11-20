/*
 * 中→英 文案表（自动汇总生成，勿手工调整结构）
 *
 * PHRASES  ：精确匹配（整段文本与词条完全一致时替换）
 * PATTERNS ：正则匹配（动态文案，$1/$2 为捕获组）
 * 中文界面下整表跳过；未命中保持中文。
 */
export const PHRASES = `
打开接收器|Open dongle
扬声器增益|Speaker gain
扬声器音量|Speaker volume
耳机音量|Headset volume
接收器 HID|Dongle HID
键盘按键|Keyboard keys
鼠标按键|Mouse buttons
静音|Mute
麦克风|Microphone
麦克风相对电平|Mic relative level
陀螺仪 / 加速度|Gyro / Accel
需 oc4 或更新固件|Requires oc4 or newer firmware
验证设备身份|Verifying device identity
重新检测设备版本|Re-detect firmware version
重新读取会放弃未保存更改，继续吗？|Reloading discards unsaved changes. Continue?
重连手柄后显示；游戏仍可控制灯光。|Shown after the controller reconnects; the game can still control the lightbar.
（设备当前版本）|(current version)
，再插回电脑（此时本页与接收器断开，属正常）|, then plug it back in (the page losing the dongle is normal)
重启后生效。|Takes effect after restart.
重启后生效。500 Hz / 1 kHz 为 USB 端点轮询率；「实时」在 V1 上等于 1 ms，在 V1.2 上为 125 µs。实际可达上报率受蓝牙链路限制（约 1 kHz）。|Takes effect after restart. 500 Hz / 1 kHz are USB endpoint rates; "Realtime" is 1 ms on V1 and 125 µs on V1.2. The actual report rate is limited by Bluetooth (~1 kHz).
停止指令未送达，请断开手柄以复位：|Stop command not delivered — disconnect the controller to reset:
已发送停止测试指令|Stop command sent
已发送灯光复位：恢复已读取的连接色，玩家灯和麦克风指示灯关闭。|Lightbar reset sent: restores the connected color, player and mic LEDs off.
无法使用麦克风，请检查浏览器权限与安全上下文|Cannot access the microphone. Check browser permissions and secure context.
未知扳机|Unknown trigger
未知扳机效果|Unknown trigger effect
未知测试|Unknown test
正在播放 1 秒测试音 · 请确认所选输出设备|Playing 1s test tone · confirm the selected output device
正在读取麦克风电平 · 不录音、不回放，30 秒后停止|Reading mic level · nothing is recorded, stops after 30s
此浏览器无法选择输出设备，请在系统声音设置中选择|This browser cannot select an output device. Use system sound settings.
段落阻力起点需为 2–7|Section start must be 2–7
测试参数超出范围|Test parameters out of range
测试音已结束|Test tone finished
浏览器不支持音频测试|Audio tests are not supported in this browser
灯色无效|Invalid lightbar color
设备接口已关闭|Device interface closed
请先连接手柄，并等待顶部显示“手柄已连接”|Connect the controller and wait for "Controller connected"
麦克风测试已结束|Mic test finished
上次测试复位失败，请先断开手柄复位，再重新测试|Last reset failed. Disconnect the controller to reset, then retry.
报告数据过长|Report data too long
映射格式错误|Invalid mapping format
映射组回读不匹配|Mapping group read-back mismatch
映射表包含不支持的字段|Mapping table contains unsupported fields
未知配置项|Unknown config key
设备返回的数据不完整或格式不匹配|Device returned incomplete or mismatched data
BL616 · DualSense 控制台|BL616 · DualSense Console
你的 DualSense，由你定义。|Your DualSense, your rules.
连接接收器后，可点击手柄的灯条、扳机或触摸板打开相应设置。|After connecting, click the lightbar, triggers or touchpad to open their settings.
中心|Diagnostics
固件|Firmware
按键|Buttons
映射|Mapping
更新|Update
测试|Test
触摸板|Touchpad
音频|Audio
接收器|Dongle
关于|About
灯光|Light
触觉|Haptics
明暗主题|Theme
DS5Dongle 烧录|DS5Dongle Flasher
BL616 · 固件烧录|BL616 · Firmware Flasher
oc8 固件 .bin · 写入地址 0x00010000|oc8 firmware .bin · write address 0x00010000
← 返回配置页|← Back to config
下载本工程 oc8 固件|Download this project's oc8 firmware
仅适用于本工程 BL616 V1 / V1.2 和旧 LCTech 版本，且已经使用现有引导与分区布局的接收器。固定更新 0x10000 固件区，不用于空白板首刷。仅接受已核对 SHA-256 的 oc8 / oc12-v1 / oc12-v12 文件。下载模式不能识别 PCB 版本，请按实物选固件，禁止跨硬件误刷。|For this project's BL616 V1 / V1.2 and legacy LCTech dongles that already use the current boot/partition layout. Writes the firmware region at 0x10000 only — not for blank boards. Only SHA-256 verified oc8 / oc12-v1 / oc12-v12 files are accepted. Download mode cannot detect the PCB revision, so pick the file matching your hardware.
停止|Stop
关闭其他配置页及串口工具，按住 BOOT 插入 USB，松开后选择下载串口。点击烧录后请保持页面打开；停止或拔线可能留下不完整固件，需要重新进入 BOOT 再烧录。此页面没有正常运行模式下的 OTA 功能。|Close other config pages and serial tools. Hold BOOT while plugging USB, then release and pick the download port. Keep this page open while flashing; stopping or unplugging can leave partial firmware. This page has no OTA while the dongle runs normally.
在本页上方"固件更新"里选择固件版本。|Choose a firmware version in the Firmware tab above.
开始烧写|Start flashing
手动进入 BootROM|Enter BootROM manually
按住 BOOT 插入 USB，随后松开 BOOT。|Hold BOOT while plugging USB, then release BOOT.
按住开发板 BOOT 键。|Hold the BOOT button on the board.
断开|Disconnect
日志|Log
本版本固定 BL616，握手时核对芯片|This build targets BL616; the chip is verified during handshake
清空|Clear
点击"更新到此版本"，再选下载串口。|Click "Install this version", then pick the download port.
等待连接和固件|Waiting for connection and firmware
芯片|Chip
设备|Device
连接串口|Connect serial
选择或拖入 oc8 固件 .bin|Choose or drop an oc8 firmware .bin
串口使用|Serial in use
串口已断开|Serial disconnected
串口设备已断开|Serial device disconnected
固件已就绪|Firmware ready
固件文件太小|Firmware file too small
已取消|Cancelled
操作已取消|Operation cancelled
擦除 Flash|Erase flash
文件已就绪|File ready
未连接|Not connected
校验写入结果|Verifying written data
正在停止|Stopping
正在烧写|Flashing
烧写失败|Flash failed
烧写完成|Flash complete
自动检测|Auto detect
计算本地 SHA-256|Computing local SHA-256
设备已断开|Device disconnected
读取芯片信息|Reading chip info
进入 BootROM|Entering BootROM
连接失败|Connection failed
配置 Flash|Configuring flash
Flash 正在擦除|Erasing flash
文件为空|File is empty
当前环境不支持 SHA-256|SHA-256 is not available here
用户取消烧写|Flashing cancelled by user
串口数据流仍被锁定|Serial stream is still locked
断开失败，请重试|Disconnect failed, please retry
固件 0x0 处没有 Bouffalo Boot Header (BFNP)|No Bouffalo Boot Header (BFNP) at 0x0
文件 0x0 处没有 Bouffalo Boot Header (BFNP)|No Bouffalo Boot Header (BFNP) at 0x0 in this file
文件太小，不是有效的 oc8 固件 .bin|File too small to be a valid oc8 firmware .bin
文件太小，不是有效的 whole.bin|File too small to be a valid whole.bin
等待握手响应超时|Timed out waiting for handshake response
等待设备响应超时|Timed out waiting for device response
意外设备响应|Unexpected device response
无效设备响应 0x|Invalid device response 0x
请通过本地启动脚本在 Chrome / Edge 打开|Open via the local start script in Chrome / Edge
烧写和校验完成，用时|Flashing and verification complete in
秒。请先断开串口，松开 BOOT，正常重新插拔后返回配置页连接。|s. Disconnect serial, release BOOT, replug normally, then connect from the config page.
应用并保存|Apply & Save
撤销更改|Revert
重新读取|Reload
重启接收器|Restart Dongle
重新扫描固件|Rescan Firmware
刷新串口|Refresh ports
刷新音频设备|Refresh audio devices
打开日志目录|Open log folder
硬件版本|Hardware version
新板首刷（引导 + 分区 + 固件）|First flash (boot + partition + firmware)
仅更新固件（保留原引导/分区）|Firmware only (keep boot/partition)
固件目录|Firmware folder
浏览…|Browse…
手动烧录这一台|Flash this unit
启动连续烧录|Start batch flashing
■ 停止全部测试 / 复位|Stop all tests / Reset
停止全部测试 / 复位|Stop all tests / Reset
停止测试|Stop test
测试中心|Diagnostics
灯光与触觉|Lightbar & Haptics
固件更新|Firmware
触摸板与鼠标|Touchpad & Mouse
按键映射|Button Remapping
关于这个界面|About
连接接收器|Connect Dongle
断开连接|Disconnect
尚未连接接收器|Not connected
接收器已连接|Dongle connected
手柄状态未读取|Controller status unknown
手柄已连接|Controller connected
手柄已断开|Controller disconnected
手柄正在断开|Controller disconnecting
手柄握手中|Controller handshaking
手柄状态待更新|Controller status pending
手柄状态未知|Controller status unknown
正在建立蓝牙连接|Connecting over Bluetooth
正在搜索手柄|Searching for controller
等待手柄连接|Waiting for controller
没有未应用的更改|All changes saved
有未应用的更改|Unsaved changes
保存成功|Saved
已保存|Saved
已断开连接|Disconnected
设置已保存|Settings saved
已重新读取设备设置|Settings reloaded from device
已读取当前设置。修改后点击应用并保存。|Settings loaded. Click Apply & Save to write changes.
设置只在点击“应用并保存”后发送。|Changes are only sent when you click Apply & Save.
本次包含需重启生效的设置，保存后请重启接收器。|Some changes need a restart. Restart the dongle after saving.
设置已应用并请求保存，重启接收器后生效。|Settings applied and save requested. Restart the dongle to activate.
设备回读一致，已请求异步保存。请稍候再拔出；此固件不提供 Flash 写入结果查询。|Read-back verified, save requested. Do not unplug yet; this firmware cannot report flash write results.
配置回读不一致，未请求保存|Read-back mismatch — save was not requested
映射回读不一致，请重新读取后重试|Mapping read-back mismatch. Reload and try again.
已撤销本页未应用的更改，设备设置未修改|Discarded unsaved changes on this page. Device settings untouched.
已确认手柄断开并发送重启请求。等待设备重新出现后点击连接。|Controller disconnected and restart requested. Click Connect once the device is back.
正在烧录，请等待完成后切换分类|Flashing in progress — wait before switching tabs
仅接收器 HID 输入|Dongle HID only
浏览器手柄输入源|Browser gamepad source
系统默认输出|System default output
系统默认麦克风|System default microphone
左摇杆|Left stick
右摇杆|Right stick
扳机 L / R|Triggers L / R
手柄电量|Battery
陀螺仪 °/s|Gyro °/s
加速度 g|Accel g
信号|Signal
已配对|paired
回报率|Polling rate
亮度|Brightness
颜色|Color
呼吸|Breathing
关闭|Off
常亮|Solid
中等|Medium
暗淡|Dim
明亮|Bright
全部点亮|All on
使用电池|On battery
已充满|Charged
正在充电|Charging
电池状态未知|Battery status unknown
电量待更新|Battery pending
实时|Realtime
实时采样|Live sampling
实时灯光|Live lightbar
实时数据（未归零）|Live data (not zeroed)
已归零，显示相对值|Zeroed — showing relative values
归零校准|Zero calibration
复制原始数据|Copy raw data
加速度校准（平放）|Calibrate accel (flat)
清除加速度校准|Clear accel calibration
恢复默认参数|Restore defaults
平滑强度（0–95%）|Smoothing (0–95%)
加速度平滑（0–95%）|Accel smoothing (0–95%)
死区（原始单位）|Deadband (raw units)
自动零偏|Auto bias
开启|On
平放|Flat
普通震动|Rumble
自适应扳机|Adaptive triggers
音频与麦克风|Audio & microphone
麦克风指示灯|Mic LED
玩家指示灯|Player LEDs
灯条颜色|Lightbar color
声音输出|Audio output
麦克风输入|Microphone input
播放 1 秒测试音|Play 1s test tone
开始麦克风电平（30 秒）|Start mic level (30s)
震动 2 秒|Rumble 2s
扳机测试 2 秒|Trigger test 2s
灯光测试 5 秒|Light test 5s
左侧强度（0–255）|Left strength (0–255)
右侧强度（0–255）|Right strength (0–255)
强度（1–8）|Strength (1–8)
起点（0–9）|Start (0–9)
测试扳机|Trigger under test
效果|Effect
持续阻力|Constant resistance
段落阻力|Section resistance
扳机振动（30 Hz）|Trigger vibration (30 Hz)
L2 左扳机|L2 left trigger
R2 右扳机|R2 right trigger
USB 手柄模式|USB controller mode
自动识别|Auto detect
闲置断开时间|Idle disconnect
闲置射频省电|Idle power saving
PS 键唤醒主机|PS button wakes host
PS 扩展键盘快捷键|PS keyboard shortcuts
USB 序列号|USB serial number
USB 隐身|Hide USB until connected
手柄连接前隐藏 USB，重启后生效。|Hides USB until a controller connects. Takes effect after restart.
触觉增益|Haptic strength
扳机阻力减弱|Trigger resistance
接收器一分钟后熄灯|Turn off LED after 1 min
音频缓冲|Audio buffer
音频转触觉|Audio-to-haptics
强制|Force
自动（游戏优先）|Auto (game priority)
关闭扬声器编码|Disable speaker encoding
关闭麦克风透传|Disable mic passthrough
锁定音量|Lock volume
忽略电脑和游戏的音量调整。|Ignores volume changes from the PC or game.
触摸板模式|Touchpad mode
方向键|D-pad
左鼠标 / 右方向键|Left mouse / right D-pad
左方向键 / 右鼠标|Left D-pad / right mouse
分区映射|Zone mapping
分区|Zones
鼠标灵敏度|Mouse sensitivity
屏蔽原始触摸和点击|Block raw touch and click
屏蔽原始手柄按键|Block raw controller buttons
仅映射模式启用时生效。|Only applies in mapping modes.
组合键保持时间|Combo hold window
允许循环切换的模式|Cycles through enabled modes
使用当前编辑组|Use the group being edited
单位分钟，0 为关闭。|In minutes, 0 disables.
单位 100ms；0 为立即触发。|In 100 ms units, 0 fires instantly.
可能增加 USB 键盘接口，重启后生效。|Adds a USB keyboard interface. Takes effect after restart.
关闭可尝试改善主机挂起后的手柄重连。|May improve reconnection after host suspend.
0 为游戏原始强度。|0 keeps the game's original strength.
Create + 触摸板在勾选模式间切换。|Create + touchpad cycles the enabled modes.
保存由固件异步写入，请稍候再拔出。灯色在手柄重连后应用；USB 模式、键鼠接口和序列号等设置需重启生效。|Saved asynchronously by the firmware — do not unplug yet. Lightbar color applies after reconnect; USB mode, keyboard/mouse interface and serial number need a restart.
就绪 · 使用 Chrome 或 Edge 连接你的 BL616 接收器。|Ready · Connect your BL616 dongle using Chrome or Edge.
BL616 无线手柄控制台|Wireless controller console
BL616 · 配置版本 4|BL616 · config v4
把手柄调整成你喜欢的样子。|Make the controller feel like yours.
切换明暗主题|Toggle light/dark theme
设备状态|Device status
设备状态：|Device status:
设备状态：未连接|Device status: not connected
设备状态：读取中…|Device status: reading…
读取配置|Reading config
读取设备状态|Reading device status
读取按键映射|Reading button mapping
读取固件版本|Reading firmware version
读取固件信息|Reading firmware info
读取断开状态|Reading disconnect state
选择映射组|Select mapping group
切换映射组失败|Failed to switch mapping group
映射组|Mapping group
组 1|Group 1
组 2|Group 2
编辑组与当前使用组分别选择。|Pick the edited group separately from the active group.
映射到|Map to
来源按键|Source button
手柄按键|Controller buttons
目标|Target
精确值|Exact value
标志（0–3；位 1 为第二键码）|Flags (0–3; bit 1 = second keycode)
修饰键位掩码 / 第二键码|Modifier mask / second keycode
USB HID 键码|USB HID keycode
输出|Output
中键|Middle
左键|Left
右键|Right
左鼠标|Left mouse
右鼠标|Right mouse
方向左|D-pad left
方向右|D-pad right
方向上|D-pad up
方向下|D-pad down
左区触摸|Left zone touch
左区上|Left zone up
左区下|Left zone down
左区左|Left zone left
左区右|Left zone right
左区点击|Left zone click
右区触摸|Right zone touch
右区上|Right zone up
右区下|Right zone down
右区左|Right zone left
右区右|Right zone right
右区点击|Right zone click
触摸板点击|Touchpad click
□ 方块|Square
× 叉键|Cross
○ 圆圈|Circle
△ 三角|Triangle
1 · 中间|1 · middle
2 · 内侧|2 · inner
3 · 间隔|3 · spaced
4 · 外侧与内侧|4 · outer + inner
加速度 X|Accel X
加速度 Y|Accel Y
加速度 Z|Accel Z
陀螺仪 X|Gyro X
陀螺仪 Y|Gyro Y
陀螺仪 Z|Gyro Z
0% · 相对电平|0% · relative level
暂无新样本|No new sample yet
连接后读取|Read on connect
等待首个 HID 就绪样本|Waiting for first HID sample
由固件逐报告计时，不使用浏览器推算。|Timed per report by the firmware, not inferred by the browser.
正在处理…|Working…
读取失败|Read failed
无法获取固件文件|Cannot get firmware file
正在准备固件…|Preparing firmware…
烧录组件未就绪，请回到“固件更新”页重试|Flashing component not ready. Go back to Firmware and retry.
更新到此版本|Install this version
重写当前版本|Reinstall current version
更新接收器固件|Update dongle firmware
详细日志|Detailed log
设备版本 · 本工程最新固件 · 页面内升级|Device version · latest local build · in-page update
版本比较依据随页面发布的本工程清单，并非在线查询官方全部版本。|Versions come from the manifest shipped with this page, not an online lookup.
设备身份验证通过|Device identity verified
旧版 oc8 无法识别 V1/V1.2，请核对硬件|oc8 cannot identify V1/V1.2 — check your hardware
服务器上没有|Not on the server
本页不是安全上下文：请通过 https 或 localhost 访问，否则无法使用串口|This page is not a secure context. Use https or localhost, otherwise serial is unavailable.
当前浏览器不支持 Web Serial：请用桌面版 Chrome 或 Edge 打开本页|Web Serial is not available in this browser. Open this page in desktop Chrome or Edge.
此浏览器无法列出音频设备，请检查安全上下文|Cannot list audio devices. Check the secure context.
请使用支持 WebHID 的 Chrome / Edge|Use Chrome or Edge with WebHID support
浏览器音频设备与接收器 HID 分开选择。请在下方或系统声音设置中选择 DS5Dongle 的扬声器 / 麦克风；默认设备可能是电脑音箱。麦克风只显示相对电平，不录音、不回放。|Audio devices and the dongle HID are selected separately. Pick the DS5Dongle speaker/mic below or in Windows Sound. The mic meter is level-only — nothing is recorded or played back.
实时读取手柄六轴原始值。转动手柄时陀螺仪数值应随之变化，静止时加速度约等于 1g。若数值不随动作变化，请用「复制原始数据」回传，我们据实校正报告偏移。|Live raw six-axis data. Gyro values must change when you rotate the controller; at rest accel should read about 1g. If they never change, use Copy raw data so we can correct the report offsets.
独立测试 L2 或 R2；使用当前固件的扳机减弱设置。起点 0–9，段落阻力起点为 2–7、终点固定为 8。|Test L2 or R2 individually using the current trigger-resistance setting. Start 0–9; section resistance starts at 2–7 and ends at 8.
临时点亮 5 秒；复位到已读取的连接色，玩家灯和麦克风指示灯关闭。橙灯测试仅控制指示灯，不改变实际静音状态。|Lights up for 5 s, then restores the connected color and turns off player/mic LEDs. The orange test only drives the LED.
临时测试立即发送，不写入保存设置。|Temporary tests are sent immediately and are not saved.
左右独立调节。与高清音频触觉不同；当前固件设置可能影响体感。|Independent left/right rumble. This is not audio-based haptics; current firmware settings may affect the feel.
等待手柄输入；若浏览器屏蔽 HID 输入，可手动选择上方的手柄输入源。|Waiting for controller input. If the browser blocks HID, pick a gamepad source above.
连接接收器后，可点击手柄打开相应设置。|After connecting, click a part of the controller to open its settings.
蓝色高亮标出左侧手柄图的对应位置；触摸分区来源会标出触摸板。|Blue highlights the matching part on the controller image; touch zones highlight the touchpad.
选择来源后可编辑下方目标；蓝色高亮不会锁定编辑。|Pick a source to edit the target below. The blue highlight does not lock editing.
点击下面按钮，在浏览器弹出的串口列表里选接收器的下载口|Click the button below and pick the dongle's download port
按住 BOOT 键不放|Hold the BOOT button
拔掉接收器，|Unplug the dongle,
松开 BOOT：接收器进入下载模式|Release BOOT: the dongle enters download mode
串口列表里没有出现接收器？请按住 BOOT 键再插 USB，松手后会多出一个串口。|No dongle in the port list? Hold BOOT while plugging USB, then release.
固件已就绪。请按上面 3 步操作，然后点“选择串口并开始烧录”。|Firmware ready. Follow the 3 steps above, then click Select port and start flashing.
选择串口并开始烧录|Select port and start flashing
OLED 视觉语言 · BL616 专用协议|OLED visual language · BL616 protocol
已把当前姿态记为零点|Current pose saved as zero
已恢复默认：平滑 75%、死区 25、自动零偏开启|Defaults restored: smoothing 75%, deadband 25, auto bias on
已清除加速度校准，恢复原始读数|Accel calibration cleared — raw values restored
自动零偏已关闭，显示原始偏移|Auto bias off — showing raw offsets
还没有收到输入报告|No input report received yet
还没有收到输入报告：请先连接手柄并按下任意键|No input report yet. Connect the controller and press any button.
还没有收到输入报告：请先连接手柄并静止 2 秒|No input report yet. Connect the controller and hold it still for 2s.
请先连接接收器：复位指令需要通过接收器下发|Connect the dongle first — the reset command goes through it
请先连接接收器读取版本；进入 BOOT 后配置接口会消失。|Connect the dongle to read its version first. The config interface disappears in BOOT mode.
请先保存或重新读取，再切换映射组|Save or reload before switching mapping groups
请先修正无效的输入值|Fix the invalid input values first
请输入范围内的有效步进值|Enter a valid value within range
至少保留一种循环模式|Keep at least one cycling mode enabled
尚未连接接收器：请先点击右上角连接，读取成功后才能编辑映射。|Not connected. Click Connect first, then edit the mapping.
尚未连接，无法检测|Not connected — cannot detect
正在读取或保存映射，请稍候…|Reading or saving the mapping, please wait…
正在映射：|Currently mapping:
保存期间设备已断开|Device disconnected while saving
读取映射期间设备已断开|Device disconnected while reading the mapping
设备已断开，重启流程已取消|Device disconnected — restart cancelled
未选择包含配置报告的接收器接口|Selected interface has no config report
关闭设备接口|Closing device interface
查询手柄服务|Querying controller services
连接控制通道|Connecting control channel
连接输入通道|Connecting input channel
发送重启流程指令|Sending restart command
已停止全部测试，并复位手柄输出（震动归零 / 扳机松开 / 灯光恢复）|All tests stopped. Outputs reset (rumble off / triggers released / lightbar restored).
当前没有测试在运行，已发送一次复位（震动归零 / 扳机松开 / 灯光恢复）|No test was running. Reset sent (rumble off / triggers released / lightbar restored).
板载蓝灯快速闪烁是低电量提示，不代表连接失败。请给手柄充电。|Fast blue flashing means low battery, not a failed connection. Charge the controller.
手柄已开始充电。设备更新电池状态后，低电量闪灯提示会解除。|Controller is charging. The low-battery flash clears once the device reports the new state.
接收器已断开，未保存更改已清除。|Dongle disconnected — unsaved changes were discarded.
· 写入地址 0x([0-9A-Fa-f]+)$|· write address 0x$1
设备状态：仍与接收器连接（需按住 BOOT 拔插一次，才会出现下载串口）|Device status: still connected to the dongle (hold BOOT while replugging to get the download port)
eflash_loader.bin 头部无效|eflash_loader.bin: invalid header
eflash_loader.bin 段头部无效|eflash_loader.bin: invalid segment header
eflash_loader.bin 内容不完整|eflash_loader.bin: incomplete content
eflash_loader 段头部响应无效|eflash_loader: invalid segment header response
BootROM 握手失败。请按住 BOOT，按一下 RESET，再松开 BOOT 后重试|BootROM handshake failed. Hold BOOT, press RESET, release BOOT and retry.
Flash JEDEC ID 长度无效|Invalid flash JEDEC ID length
SHA-256 校验失败：|SHA-256 verification failed: 
镜像范围超过 Flash 容量 |Image exceeds flash capacity of 
无法通过 DTR/RTS 复位，请手动按 RESET：|Cannot reset via DTR/RTS — press RESET manually:
自动复位失败，请关闭自动复位并手动进入 BootROM：|Auto-reset failed. Disable auto-reset and enter BootROM manually:
命令 |Command 
 重试| retry
已加载 |Loaded 
不支持的 BootROM 芯片标识 0x|Unsupported BootROM chip ID 0x
不支持的芯片：|Unsupported chip: 
串口读取失败：|Serial read failed: 
无法读取目标资源 |Cannot load target resource 
正在烧写 · |Flashing · 
烧写和校验完成，用时 |Flash and verify complete in 
 秒。请先断开串口，松开 BOOT，正常重新插拔后返回配置页连接。| s. Disconnect serial, release BOOT, replug normally, then connect from the config page.
意外设备响应 |Unexpected device response 
关闭串口失败：|Failed to close serial: 
设备返回错误 |Device returned error 
信号 — · 已配对 — · USB —|Signal — · paired — · USB —
固件版本：|Firmware version: 
`

export const PATTERNS = `
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
^正在烧写 · (.+)$|Flash complete $.
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
