param(
  [string]$Path = "release\ShortApps-win32-x64\ShortApps.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Path)) {
  throw "Executable not found: $Path"
}

$signTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signTool) {
  throw "signtool.exe not found. Install the Windows SDK and run this script from a Windows shell."
}

$timestampUrl = if ($env:SHORTAPPS_SIGN_TIMESTAMP_URL) {
  $env:SHORTAPPS_SIGN_TIMESTAMP_URL
} else {
  "http://timestamp.digicert.com"
}

if ($env:SHORTAPPS_SIGN_PFX) {
  if (-not (Test-Path $env:SHORTAPPS_SIGN_PFX)) {
    throw "PFX not found: $env:SHORTAPPS_SIGN_PFX"
  }

  $arguments = @(
    "sign",
    "/fd", "SHA256",
    "/tr", $timestampUrl,
    "/td", "SHA256",
    "/f", $env:SHORTAPPS_SIGN_PFX
  )

  if ($env:SHORTAPPS_SIGN_PASSWORD) {
    $arguments += @("/p", $env:SHORTAPPS_SIGN_PASSWORD)
  }

  $arguments += $Path
  & $signTool.Source @arguments
  exit $LASTEXITCODE
}

if ($env:SHORTAPPS_SIGN_CERT_SHA1) {
  & $signTool.Source sign `
    /fd SHA256 `
    /tr $timestampUrl `
    /td SHA256 `
    /sha1 $env:SHORTAPPS_SIGN_CERT_SHA1 `
    $Path
  exit $LASTEXITCODE
}

throw "No signing identity configured. Set SHORTAPPS_SIGN_PFX or SHORTAPPS_SIGN_CERT_SHA1."
