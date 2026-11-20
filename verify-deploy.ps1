# 部署验证：检查某个 base URL 上的 DS5Dongle 页面是否完整可用
#
#   .\verify-deploy.ps1 -BaseUrl http://127.0.0.1:8766
#   .\verify-deploy.ps1 -BaseUrl https://www.linkretro.com/tools/DS5Dongle
#
# 检查项：
#   1. index.html 可访问、体积合理、包含关键标记（页面真的构建过）
#   2. firmware/<board>/index.json 可访问且是数组结构
#   3. 清单里声明的每个 .bin 都能下载，且大小与清单一致
#   4. 关键资源 content-type 正确（.bin 不应被当成 html）
param(
    [Parameter(Mandatory = $true)][string]$BaseUrl,
    [int]$ExpectHtmlMin = 200000,
    [int]$ExpectHtmlMax = 6000000
)

$ErrorActionPreference = 'Continue'
$base = $BaseUrl.TrimEnd('/')
$fail = 0
function Ok($m)   { Write-Host "  PASS  $m" -ForegroundColor Green }
function Bad($m)  { Write-Host "  FAIL  $m" -ForegroundColor Red; $script:fail++ }
function Info($m) { Write-Host "  ....  $m" -ForegroundColor DarkGray }

function Get-Url([string]$u) {
    $out = & curl.exe --noproxy "*" -s -m 20 -o NUL -w "%{http_code} %{size_download} %{content_type}" $u 2>$null
    $parts = ($out -split '\s+')
    [pscustomobject]@{ Code = $parts[0]; Size = [int64]$parts[1]; Type = ($parts[2..($parts.Count-1)] -join ' ') }
}

Write-Host "== 验证 $base" -ForegroundColor Cyan

# 1) 页面
$page = Get-Url "$base/index.html"
if ($page.Code -eq '200') {
    Ok "index.html HTTP 200 ($($page.Size) B)"
    if ($page.Size -ge $ExpectHtmlMin -and $page.Size -le $ExpectHtmlMax) { Ok "页面体积在合理范围" }
    else { Bad "页面体积异常：$($page.Size) B（期望 $ExpectHtmlMin–$ExpectHtmlMax）" }
    if ($page.Type -match 'text/html') { Ok "content-type: $($page.Type)" } else { Bad "content-type 不是 text/html：$($page.Type)" }

    $html = (& curl.exe --noproxy "*" -s -m 20 "$base/index.html") -join "`n"
    foreach ($marker in 'BOARD_FIRMWARE_CATALOG', 'DongleFlashPolicy', 'i18n') {
        if ($html -match $marker) { Ok "页面包含标记：$marker" } else { Bad "页面缺少标记：$marker（可能不是构建产物）" }
    }
    if ($html -match 'const BOARD_FIRMWARE_IMAGES=\{\}') { Ok "固件未内嵌（依赖 HTTP 取件，正如预期）" }
    else { Info "固件可能被内嵌（--embed 构建），体积会偏大" }
} else {
    Bad "index.html HTTP $($page.Code)"
}

# 2) 固件清单与文件
foreach ($board in 'v1', 'v12') {
    $idxUrl = "$base/firmware/$board/index.json"
    $idx = Get-Url $idxUrl
    if ($idx.Code -ne '200') { Bad "$board/index.json HTTP $($idx.Code)"; continue }
    Ok "$board/index.json HTTP 200 ($($idx.Size) B)"

    $raw = (& curl.exe --noproxy "*" -s -m 20 $idxUrl) -join "`n"
    try { $json = $raw | ConvertFrom-Json } catch { Bad "$board/index.json 不是合法 JSON"; continue }

    $versions = @($json.versions)
    if ($versions.Count -ge 1) { Ok "$board 清单包含 $($versions.Count) 个版本" } else { Bad "$board 清单为空" }

    foreach ($v in $versions) {
        $binUrl = "$base/firmware/$board/$($v.file)"
        $bin = Get-Url $binUrl
        if ($bin.Code -ne '200') { Bad "$board/$($v.file) HTTP $($bin.Code)"; continue }
        if ($bin.Size -eq $v.size) { Ok "$board/$($v.file) 大小一致（$($bin.Size) B）" }
        else { Bad "$board/$($v.file) 大小不符：实际 $($bin.Size) / 清单 $($v.size)" }
        if ($bin.Type -match 'text/html') { Bad "$board/$($v.file) 被当成 HTML 返回（路由/404 页面）" }
    }
}

Write-Host ''
if ($fail -eq 0) {
    Write-Host "结果：全部通过 ✓" -ForegroundColor Green
    exit 0
} else {
    Write-Host "结果：$fail 项失败 ✗" -ForegroundColor Red
    exit 1
}
