# SDK flash_secure_read_write 核对与移植方案

## 核对依据

本地 SDK：`.build-deps/bouffalo_sdk-master`。

- `examples/peripherals/flash/flash_secure_read_write/main.c`、README.md、flash_prog_cfg.ini。
- `examples/peripherals/flash/flash_secure_read_write_hw_key_ctr_128/main.c`、README.md。
- `drivers/lhal/src/bflb_flash.c` 中 bflb_flash_aes_init，及 include/bflb_flash.h 的配置结构。

用户指定的基础例程已完整核对。它可以作为硬件 AES / XIP 解密的数据通路参考，因此不能笼统说“没有额外文档就完全无法开展加密验证”。但它不是启用 ROM 强制签名启动的完整量产例程。

## 基础例程实际行为

1. RAM 内生成 4096 字节递增测试数据，使用代码中的公开测试 key / IV，调用 Sec Eng AES-CTR-128 加解密并比对。
2. 全局关闭 Flash AES。
3. 擦除并写入 0x10000 起的 4096 字节密文，再用普通 Flash read 比对密文。
4. 配置 Flash AES region=0、enable=1、lock_enable=0、范围 [0x10000,0x11000)，key/IV 指向 RAM 中的测试值。
5. 开启 Flash AES，经 XIP 映射读取并验证明文；另验证 Sec Eng 分块解密可沿用 CTR 状态。

例程自己的下载配置把示例程序放在地址 0。我们的 Boot2/分区/应用布局不同，应用从 0x10000 开始。**不能在当前 Dongle 上原样运行此例程：会擦除固件头所在扇区。**

驱动核对：end_addr 为不包含上界，内部转换成 end_addr-1；config.key==NULL 时切换硬件密钥路径，非 NULL 时装载软件密钥。这只证明运行时的硬件能力，不自动证明该区域配置受 BootROM 验证、任何密钥槽已锁定，或调试/下载已关闭。

## 配套硬件密钥例程

该例程从活动分区表按 DATA 名称获取测试地址，而非固定 0x10000。明确声明应用本身未加密；以 Slot2、key_sel_0=2、key_sel_1=0 为 AES-128 示例，使用 bflb_aes_set_hwkey_source、bflb_aes_select_hwkey、bflb_aes_setkey(NULL,128)。

这些示例参数不能直接推断“应用也加密”时的槽分配。示例给出的公开 AES key、efusedata 图和掩码都不能直接当生产配置。CTRL 的 region lock_enable 不是 eFuse key 读写保护，更不是强制安全启动。

## 具体实施顺序修订

1. 第一层先验证纯 RAM AES，用每次测试临时产生的 key / IV，不写 Flash/eFuse，不改 LED/蓝牙输入路径。
2. 数据区实验必须读取并验证实际活动分区表；只允许专用测试分区，检查容量、擦除对齐、与固件/Boot2/分区表/配对/KEY/工厂区无重叠。DATA 分区也不能假定为空，需要先确定所有权并备份。不能直接使用 TOML 中某个地址代替实际板内分区。
3. 若要验证 XIP 解密，必须预先确定当前应用是否已启用 Flash AES，避免全局 disable 或占用 region0 破坏执行中的加密代码；不把示例全局 AES 开关直接并入主固件。
4. 设备身份敏感数据的保存可以参考硬件密钥数据加密通路。AES-CTR 本身没有完整性认证，不能只把设备私钥做一次 CTR 加密就称为安全存储；需要成熟的完整性保护、随机 nonce/IV 策略、密钥生命周期及签名后的 RAM 清理。密钥进入 CPU RAM 后的攻击边界也必须明确。
5. ROM/Boot2/应用镜像加密与签名是另一条启动链：需要核对芯片修订版、Boot2 的验签行为、镜像格式、受信公钥哈希、eFuse key slot 和锁定位、受控升级与失败恢复。基础例程不提供这些完整约束。
6. 最终烧录安全位前，在备用板验证正确镜像启动、错误签名拒绝、下载/调试读出限制、受控升级和断电恢复。保留普通开发板，不先锁唯一成品。

## 当前状态

本次只核对例程并修订方案，没有编译/烧录 SDK 破坏性 Flash 测试，没有新密钥、eFuse 或板子写入。V1 / V1.2 的 oc9 保持普通开发固件。证书签发与网页验签仍为已测试的主机侧基础，设备端受保护签名后端与加密启动未实现；不能宣称具备量产防克隆效果。
