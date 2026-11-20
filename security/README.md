# 身份认证实施状态：实验阶段，不能作为已加密量产版发布

## 已实现

- `tools/security/identity.mjs`：P-256 签发密钥/设备密钥生成、设备证书签发、发布清单签名。私钥以口令加密的 PKCS#8 PEM 保存，不写入网页。工具拒绝覆盖已有输出目录，不自动操作 USB、Flash 或 eFuse。
- `web/bl616-config/auth.mjs`：生产根公钥验证设备证书，再用 32 字节随机挑战验证设备私钥持有者，挑战绑定证书内容。原始 P-256 签名采用 64 字节 r||s，与 Web Crypto 一致。认证失败不访问配置报告。
- `auth-preview.html`：独立的认证验证入口，未配置根公钥/设备未支持协议时禁止配置，不回退到序列号匹配。普通 `index.html` 保持开发用途兼容旧 oc8。
- 模拟测试覆盖真实密码学验签、篡改、伪造、重放和未配置时拒绝。

**尚未实现**：BL616 设备端 FC 认证任务、受保护的设备密钥存储/签名后端、ROM/Boot2 安全启动链、芯片原生加密镜像生成、样板烧录与恢复验收。没有生成或烧录任何 eFuse 数据，没有修改/烧录当前 oc8，没有生成生产私钥。这里的发布清单签名不是 BootROM 镜像签名，也不是固件加密。

## 本地签发工具用法

使用当前 Node.js，在受控生产电脑设置环境变量 `DONGLE_KEY_PASSWORD`（至少 16 字符，使用随机强口令；不要把口令写进命令参数、仓库或聊天记录）。工具不会打印私钥或口令。

```powershell
node tools/security/identity.mjs init-authority security/private/identity-root
node tools/security/identity.mjs issue-device security/private/devices/DEVICE_SERIAL security/private/identity-root/private.encrypted.pem DEVICE_SERIAL
```

DEVICE_SERIAL 必须是 32 个小写十六进制字符，并在生产台账中唯一分配。每次签发生成不同的设备密钥，不给全部产品共用一个设备私钥。保持密钥备份并控制 Windows 目录 ACL（Node 的 mode 参数在 Windows 上不能代替 ACL）。根私钥只能用于签发，不进入设备。

把根输出的 **public.json** 复制为 `security/authority.public.json` 后，执行 `python web/bl616-config/build.py` 将公开信任锚编入实验页面。绝不复制 private.encrypted.pem 到 web 目录。不要把验证根公钥从未经认证的设备响应中获取。

发布签名请用**另一套独立密钥**（用 init-authority 生成到不同目录）和以下命令：

```powershell
node tools/security/identity.mjs sign-release security/private/releases/RELEASE security/private/release-root/private.encrypted.pem PATH_TO_IMAGE
```

该输出仅包含镜像型号、长度、SHA-256 的签名清单，未接入当前网页升级器，不能当作 BL616 原生加密固件或直接交给 BootROM。

## 设备认证协议 v1（待固件实现）

新增供应商 Feature Report `0xFC`，payload 127 字节，DS/DSE 配置描述符都必须显式声明。不要复用现有 F7/F8/FB 字段。

- SET `[0x10, offset_lo, offset_hi, zeros...]`：读取 UTF-8 证书容器 `{payload:base64,signature:base64}` 的片段。
- GET：`[status, length_lo, length_hi, data...]`。status=0 完成，1 忙，其他失败；片段 <=124 字节，最后一段 <124 字节（整倍数需要额外返回零长终止块）；总长度 <=2048。
- SET `[0x20, nonce[32], zeros...]`：开始挑战签名。GET 轮询返回相同帧，完成数据为 64 字节 r||s。
- 被签名内容：UTF-8 `DS5DONGLE-AUTH-V1` + 单个 0 字节 + nonce + SHA-256(证书 payload 解码后的**原始字节**)。不要重新序列化 JSON 再算摘要。
- 证书 payload 为 `{v:1,model:"BL616-V1.2",serial:32位小写hex,publicKey:base64未压缩P256点65字节}`，由根签名；证书不包含私钥。
- USB 回调只处理有界缓冲与投递任务。ECC 签名不得放入 USB 中断、蓝牙输入或 HID 热路径。限制并发/请求频率，USB 复位时清空挑战和结果。正常配置/音频仍须做性能回归。

## 真正加密前的阻断项

本地 SDK 的 `flash_secure_read_write_hw_key_ctr_128/README.md` 明确引用《BL616/BL618 Secure Boot Application Note》和 eFuse Function Allocation；当前项目未找到这两份完整的量产配置依据。该示例只演示数据区 AES，不能直接套用成 ROM/Boot2/应用的加密签名启动链，更不能把示例固定 AES key 烧入产品。

必须先取得并核对安全启动应用说明、当前芯片修订版的 key slot/锁定位/下载策略，以及升级恢复链。随后在备用板验证：加密启动成功、错误签名被拒绝、密钥不可读、受控升级成功、断电恢复可用、调试/下载限制满足要求。验证后再审查具体 eFuse 掩码并执行一次性锁定。当前没有可审查的 eFuse 烧录包，禁止用旧 build 中已有 efusedata.bin 代替。

## 边界

当前只完成主机侧基础，不具有量产防克隆效果。普通 index.html/原始开源固件仍可配置设备；仅网页认证无法阻止客户修改前端或用其他程序访问开放的配置协议。设备端访问控制需要独立设计与威胁建模，证明“持有正品私钥”和“授权某个配置会话”不是同一个问题。安全启动/密钥保护/设备端后端完成前不能宣称抗固件复制。现场读取错误、未签发、旧固件分别提示，不能一律写“克隆版本”。


## 按指定 SDK 例程补充核对

已完整检查 flash_secure_read_write 及硬件密钥变体。可据此推进硬件 AES / 数据区加密验证，不再把缺少独立应用说明视为所有加密实验的前置阻断。其固定 0x10000 擦写与当前固件地址冲突，不能原样运行；完整启动链和应用加密时的 eFuse 分配仍需核验。详细行为、驱动核对和修订顺序见 [SDK_FLASH_SECURE_REVIEW.md](SDK_FLASH_SECURE_REVIEW.md)。
