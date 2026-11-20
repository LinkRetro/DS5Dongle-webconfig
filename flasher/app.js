globalThis.mountDongleFlash = function (document) {
  "use strict";

  const { concatBytes, bytesToHex, formatErrorCode } = globalThis.BflbFlashProtocol;
  const { BflbFlasher, BAUD_RATE } = globalThis.BflbFlasher;

  const elements = {
    supportNotice: document.querySelector("#support-notice"),
    connectButton: document.querySelector("#connect-button"),
    disconnectButton: document.querySelector("#disconnect-button"),
    fileInput: document.querySelector("#bin-file"),
    dropZone: document.querySelector("#drop-zone"),
    fileName: document.querySelector("#file-name"),
    fileMeta: document.querySelector("#file-meta"),
    chipSelect: document.querySelector("#chip-select"),
    autoReset: document.querySelector("#auto-reset"),
    runAfterFlash: document.querySelector("#run-after-flash"),
    flashButton: document.querySelector("#flash-button"),
    cancelButton: document.querySelector("#cancel-button"),
    statusDot: document.querySelector("#status-dot"),
    statusText: document.querySelector("#status-text"),
    stageText: document.querySelector("#stage-text"),
    progressBar: document.querySelector("#progress-bar"),
    progressValue: document.querySelector("#progress-value"),
    log: document.querySelector("#log"),
    clearLogButton: document.querySelector("#clear-log"),
  };

  let port = null;
  let transport = null;
  let image = null;
  let flashing = false;
  let cancelled = false;
  let fileEpoch = 0;

  class SerialTransport {
    constructor(serialPort) {
      this.port = serialPort;
      this.reader = null;
      this.writer = null;
      this.buffer = new Uint8Array();
      this.waiters = new Set();
      this.readError = null;
      this.closed = false;
    }

    async open() {
      await this.port.open({
        baudRate: BAUD_RATE,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
        bufferSize: 32768,
      });
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      this.baudRate = BAUD_RATE;
      this.closed = false;
      this.readLoop = this.pump();
    }

    async pump() {
      try {
        while (!this.closed) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value && value.length) {
            this.buffer = concatBytes(this.buffer, value);
            this.wakeWaiters();
          }
        }
      } catch (error) {
        if (!this.closed) this.readError = error;
      } finally {
        this.wakeWaiters();
      }
    }

    wakeWaiters() {
      for (const resolve of this.waiters) resolve();
      this.waiters.clear();
    }

    async waitForData(timeoutMs) {
      if (this.readError) throw this.readError;
      return new Promise((resolve, reject) => {
        let timer;
        const wake = () => {
          clearTimeout(timer);
          this.waiters.delete(wake);
          resolve();
        };
        timer = setTimeout(() => {
          this.waiters.delete(wake);
          reject(new Error("等待设备响应超时"));
        }, timeoutMs);
        this.waiters.add(wake);
      });
    }

    async readExactly(length, timeoutMs = 3000) {
      const deadline = performance.now() + timeoutMs;
      while (this.buffer.length < length) {
        const remaining = deadline - performance.now();
        if (remaining <= 0) throw new Error("等待设备响应超时");
        await this.waitForData(remaining);
      }
      const result = this.buffer.slice(0, length);
      this.buffer = this.buffer.slice(length);
      return result;
    }

    async readUntil(sequence, timeoutMs = 3000) {
      const deadline = performance.now() + timeoutMs;
      while (true) {
        const index = findSequence(this.buffer, sequence);
        if (index >= 0) {
          const result = this.buffer.slice(0, index + sequence.length);
          this.buffer = this.buffer.slice(index + sequence.length);
          return result;
        }
        const remaining = deadline - performance.now();
        if (remaining <= 0) throw new Error("等待握手响应超时");
        await this.waitForData(remaining);
      }
    }

    async write(bytes) {
      await this.writer.write(bytes);
    }

    async setSignals(signals) {
      await this.port.setSignals(signals);
    }

    async releaseStreams() {
      let cleanupError = null;
      if (this.reader) {
        const reader = this.reader;
        try {
          await reader.cancel();
          if (this.readLoop) await this.readLoop;
        } catch (_) {
          // Still try to release the lock so writer cleanup is not skipped.
        }
        try {
          reader.releaseLock();
          this.reader = null;
        } catch (error) {
          cleanupError = error;
        }
      }
      if (this.writer) {
        try {
          this.writer.releaseLock();
          this.writer = null;
        } catch (error) {
          cleanupError ||= error;
        }
      }
      if (!this.reader) this.readLoop = null;
      if (cleanupError) throw cleanupError;
    }

    clearInput() {
      this.buffer = new Uint8Array();
    }

    async readAck(timeoutMs = 3000) {
      const ack = await this.readExactly(2, timeoutMs);
      const text = String.fromCharCode(ack[0], ack[1]);
      if (text === "OK" || text === "PD") return { status: text };
      if (text === "FL") {
        const errorBytes = await this.readExactly(2, timeoutMs);
        const code = errorBytes[0] | (errorBytes[1] << 8);
        throw new Error(`设备返回错误 ${formatErrorCode(code)}`);
      }
      throw new Error(`无效设备响应 0x${bytesToHex(ack)}`);
    }

    async readResponse(timeoutMs = 3000) {
      const ack = await this.readAck(timeoutMs);
      if (ack.status !== "OK") throw new Error(`意外设备响应 ${ack.status}`);
      const lengthBytes = await this.readExactly(2, timeoutMs);
      const length = lengthBytes[0] | (lengthBytes[1] << 8);
      return this.readExactly(length, timeoutMs);
    }

    async close() {
      this.closed = true;
      this.wakeWaiters();
      await this.releaseStreams();
      if (this.port.readable?.locked || this.port.writable?.locked) {
        throw new Error("串口数据流仍被锁定");
      }
      if (this.port.readable || this.port.writable) await this.port.close();
    }
  }

  function findSequence(haystack, needle) {
    outer: for (let index = 0; index <= haystack.length - needle.length; index += 1) {
      for (let inner = 0; inner < needle.length; inner += 1) {
        if (haystack[index + inner] !== needle[inner]) continue outer;
      }
      return index;
    }
    return -1;
  }

  function formatSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
    return `${(size / 1024 / 1024).toFixed(2)} MiB`;
  }

  function log(message, level = "info") {
    const row = document.createElement("div");
    row.className = `log-row log-${level}`;
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    row.textContent = `${time}  ${message}`;
    elements.log.append(row);
    elements.log.scrollTop = elements.log.scrollHeight;
  }

  function setStatus(kind, text) {
    elements.statusDot.dataset.status = kind;
    elements.statusText.textContent = text;
  }

  function setProgress(value, stage) {
    const normalized = Math.max(0, Math.min(100, value));
    elements.progressBar.value = normalized;
    elements.progressValue.textContent = `${Math.round(normalized)}%`;
    if (stage) elements.stageText.textContent = stage;
  }

  function updateControls() {
    const connected = Boolean(transport);
    const usable = connected && !transport.closed;
    elements.connectButton.disabled = !navigator.serial || !globalThis.isSecureContext || connected || flashing;
    elements.disconnectButton.disabled = !connected || flashing;
    elements.fileInput.disabled = flashing;
    elements.chipSelect.disabled = true;
    elements.flashButton.disabled = !usable || !image || flashing;
    elements.cancelButton.hidden = !flashing;
  }

  async function chooseFile(file) {
    if (!file || flashing) return;
    const selected = ++fileEpoch;
    image = null; updateControls();
    const data = new Uint8Array(await file.arrayBuffer());
    if (data.length < 256) throw new Error("文件太小，不是有效的 oc8 固件 .bin");
    if (String.fromCharCode(...data.slice(0, 4)) !== "BFNP") throw new Error("文件 0x0 处没有 Bouffalo Boot Header (BFNP)");
    const release = await globalThis.DongleFlashPolicy.validate(data);
    if (selected !== fileEpoch) return;
    image = data;
    elements.fileName.textContent = file.name;
    elements.fileMeta.textContent = `${release.model} · ${formatSize(file.size)} · 写入地址 0x00010000`;
    elements.dropZone.classList.add("has-file");
    setProgress(0, "文件已就绪");
    log(`已载入 ${file.name}，${file.size} 字节`);
    updateControls();
  }

  async function setImage(name, data, label, expectedHash, isCurrent = () => true) {
    if (flashing) return;
    if (!data || data.length < 256) throw new Error("固件文件太小");
    if (String.fromCharCode(...data.slice(0, 4)) !== "BFNP") throw new Error("固件 0x0 处没有 Bouffalo Boot Header (BFNP)");
    const release = await globalThis.DongleFlashPolicy.validate(data);
    if (expectedHash && release.sha256 !== expectedHash) throw new Error("固件与所选板型或版本不一致，已阻止烧录");
    if (!isCurrent() || flashing) return;
    image = data;
    if (elements.fileName) elements.fileName.textContent = label ?? name;
    if (elements.fileMeta) elements.fileMeta.textContent = `${release.model} · ${formatSize(data.length)} · 写入地址 0x00010000`;
    if (elements.dropZone) elements.dropZone.classList.add("has-file");
    setProgress(0, "固件已就绪");
    log(`已载入 ${label ?? name}`);
    updateControls();
  }

  async function start() {
    if (!transport) await connect();
    if (!transport || !image) return;
    await flash();
  }

  /* BootROM 下载模式的 USB VID/PID 是固定的，先按它过滤，避免把普通串口也列出来。
     若没有匹配项（例如本机枚举的 ID 不在列表里），退回完整列表并把原因写进日志。 */
  const BOOTROM_FILTERS = [
    { usbVendorId: 0xffff, usbProductId: 0xffff },   /* Bouffalo BootROM（常见） */
    { usbVendorId: 0x349b, usbProductId: 0x6160 },   /* Bouffalo VID，BL616 CDC/BootROM */
  ];

  async function requestBootRomPort() {
    try {
      return await navigator.serial.requestPort({ filters: BOOTROM_FILTERS });
    } catch (error) {
      if (error.name !== "NotFoundError") throw error;
      log("No BootROM port matched the filter; showing all serial ports instead", "error");
      return navigator.serial.requestPort();
    }
  }

  async function connect() {
    if (!navigator.serial) return;
    try {
      port = await requestBootRomPort();
      transport = new SerialTransport(port);
      await transport.open();
      setStatus("connected", `已连接 · ${transport.baudRate.toLocaleString()} baud`);
      log(`串口已连接，波特率 ${transport.baudRate}`);
    } catch (error) {
      transport = null;
      port = null;
      if (error.name !== "NotFoundError") {
        setStatus("error", "连接失败");
        log(error.message, "error");
      }
    }
    updateControls();
  }

  async function disconnect() {
    if (!transport) return;
    const current = transport;
    try {
      await current.close();
      transport = null;
      port = null;
      setStatus("idle", "未连接");
      log("串口已断开");
    } catch (error) {
      log(`关闭串口失败：${error.message}`, "error");
      setStatus("error", "断开失败，请重试");
    }
    updateControls();
  }

  const STAGE_NAMES = {
    handshake: "进入 BootROM",
    "boot-info": "读取芯片信息",
    "flash-config": "配置 Flash",
    erase: "擦除 Flash",
    verify: "校验写入结果",
    hash: "计算本地 SHA-256",
    done: "烧写完成",
  };

  function handleFlashProgress(value, stage, detail) {
    if (stage === "write" && detail) {
      setProgress(value, `写入 ${formatSize(detail.written)} / ${formatSize(detail.total)}`);
      return;
    }
    setProgress(value, STAGE_NAMES[stage] || stage);
  }

  async function flash() {
    if (!transport || !image || flashing) return;
    await globalThis.DongleFlashPolicy.validate(image);
    flashing = true;
    cancelled = false;
    updateControls();
    setStatus("working", "正在烧写");
    setProgress(1, "进入 BootROM");
    try {
      const flasher = new BflbFlasher(transport, {
        onLog: (message, level) => {
          log(message, level);
          if (message.startsWith("串口使用")) setStatus("working", "正在烧写 · 2,000,000 baud");
        },
        onProgress: handleFlashProgress,
        isCancelled: () => cancelled,
      });
      const result = await flasher.flash(image, {
        address: 0x10000,
        chip: "bl616",
        autoReset: false,
        runAfterFlash: false,
      });
      const seconds = (result.elapsedMs / 1000).toFixed(1);
      setStatus("success", `${result.chip.toUpperCase()} 烧写完成 · ${seconds} s`);
      log(`烧写和校验完成，用时 ${seconds} 秒。请先断开串口，松开 BOOT，正常重新插拔后返回配置页连接。`, "success");
    } catch (error) {
      const wasCancelled = error.name === "AbortError";
      setStatus(wasCancelled ? "idle" : "error", wasCancelled ? "已取消" : "烧写失败");
      elements.stageText.textContent = wasCancelled ? "操作已取消" : error.message;
      log(error.message, wasCancelled ? "warn" : "error");
    } finally {
      flashing = false;
      cancelled = false;
      updateControls();
    }
  }

  function initialize() {
    elements.chipSelect.value = "bl616";
    globalThis.addEventListener?.("beforeunload", event => { if (flashing) {event.preventDefault();event.returnValue="";} });
    if (!navigator.serial || !globalThis.isSecureContext) {
      elements.supportNotice.hidden = false;
      elements.connectButton.disabled = true;
      setStatus("error", "请通过本地启动脚本在 Chrome / Edge 打开");
    }

    elements.connectButton.addEventListener("click", connect);
    elements.disconnectButton.addEventListener("click", disconnect);
    elements.flashButton.addEventListener("click", () => flash().catch(error => log(error.message, "error")));
    elements.chipSelect.addEventListener("change", () => {
      if (image) elements.fileMeta.textContent = `${formatSize(image.length)} · ${elements.chipSelect.value ? elements.chipSelect.value.toUpperCase() : "自动检测"} · 写入地址 0x00010000`;
    });
    elements.cancelButton.addEventListener("click", () => {
      cancelled = true;
      elements.cancelButton.disabled = true;
      elements.stageText.textContent = "正在停止";
    });
    elements.clearLogButton.addEventListener("click", () => elements.log.replaceChildren());
    elements.fileInput.addEventListener("change", async () => {
      try {
        await chooseFile(elements.fileInput.files[0]);
      } catch (error) {
        log(error.message, "error");
      }
    });
    elements.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("dragging");
    });
    elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("dragging"));
    elements.dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("dragging");
      try {
        await chooseFile(event.dataTransfer.files[0]);
      } catch (error) {
        log(error.message, "error");
      }
    });
    navigator.serial?.addEventListener("disconnect", (event) => {
      if (event.target === port) {
        transport = null;
        port = null;
        flashing = false;
        setStatus("error", "设备已断开");
        log("串口设备已断开", "error");
        updateControls();
      }
    });
    updateControls();
  }

  initialize();
  return {isBusy: () => flashing, setImage, start};
};
