import { spawn } from 'node:child_process'
import { isSuspiciousExecutablePath } from './app-validator.js'

const SCAN_TIMEOUT_MS = 30000

const colorPairs = [
  ['#2563eb', '#0f172a'],
  ['#16a34a', '#064e3b'],
  ['#dc2626', '#7f1d1d'],
  ['#9333ea', '#312e81'],
  ['#0891b2', '#164e63'],
  ['#ea580c', '#7c2d12'],
  ['#4f46e5', '#1e1b4b'],
  ['#0f766e', '#134e4a'],
]

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function hashString(value) {
  return [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7)
}

function appMark(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toLowerCase()
}

function normalizeExecutablePath(path = '') {
  return path
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/,\d+$/, '')
}

function normalizeScannedApp(entry) {
  const name = String(entry.name ?? '').trim()
  const executable = normalizeExecutablePath(entry.executable ?? entry.path ?? '')

  if (!name || !executable) return null
  if (executable.toLowerCase().endsWith('.exe') && isSuspiciousExecutablePath(executable)) return null

  const idBase = slugify(`${name}-${executable}`)
  const colors = colorPairs[hashString(idBase) % colorPairs.length]

  return {
    id: `scan-${idBase}`.slice(0, 72),
    name,
    type: 'Application',
    source: entry.source ?? 'Détectée',
    category: entry.category ?? 'Détectées',
    path: executable,
    iconPath: normalizeExecutablePath(entry.iconPath ?? executable),
    iconDataUrl:
      typeof entry.iconDataUrl === 'string' && entry.iconDataUrl.startsWith('data:image/')
        ? entry.iconDataUrl
        : '',
    iconSource: entry.iconSource ?? '',
    workingDirectory: entry.workingDirectory ?? '',
    arguments: entry.arguments ?? '',
    mark: appMark(name),
    colors,
    visualType: 'icon',
    centralText: '',
    status: 'available',
  }
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
    )
    let stdout = ''
    let stderr = ''

    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('WINDOWS_SCAN_TIMEOUT'))
    }, SCAN_TIMEOUT_MS)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(stderr.trim() || `POWERSHELL_EXIT_${code}`))
        return
      }
      resolve(stdout)
    })
  })
}

const windowsScanScript = String.raw`
$ErrorActionPreference = "SilentlyContinue"
Add-Type -AssemblyName System.Drawing
$apps = New-Object System.Collections.Generic.List[object]
$iconCache = @{}

function Clean-ExePath($value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  $clean = [Environment]::ExpandEnvironmentVariables($value.Trim())
  if ($clean.StartsWith('"')) {
    $secondQuote = $clean.IndexOf('"', 1)
    if ($secondQuote -gt 1) { return $clean.Substring(1, $secondQuote - 1) }
  }
  $exeIndex = $clean.ToLowerInvariant().IndexOf(".exe")
  if ($exeIndex -gt -1) { return $clean.Substring(0, $exeIndex + 4).Trim('"') }
  $dllIndex = $clean.ToLowerInvariant().IndexOf(".dll")
  if ($dllIndex -gt -1) { return $clean.Substring(0, $dllIndex + 4).Trim('"') }
  $icoIndex = $clean.ToLowerInvariant().IndexOf(".ico")
  if ($icoIndex -gt -1) { return $clean.Substring(0, $icoIndex + 4).Trim('"') }
  return ($clean -replace ',\d+$', '').Trim('"')
}

function Test-BadExecutable($value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return $true }
  $name = [IO.Path]::GetFileNameWithoutExtension($value)
  return $name -match '(?i)^(unins|uninstall|setup|install|updater?|update|crash|report|helper|service|redist|vcredist|mainten|repair|bootstrap)'
}

function Resolve-IconDataUrl($iconLocation, $executable) {
  $candidate = Clean-ExePath $iconLocation
  if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) {
    $candidate = Clean-ExePath $executable
  }

  if (-not $candidate -or $candidate.StartsWith("shell:") -or -not (Test-Path -LiteralPath $candidate)) {
    return [pscustomobject]@{
      dataUrl = ""
      source = ""
    }
  }

  $cacheKey = $candidate.ToLowerInvariant()
  if ($iconCache.ContainsKey($cacheKey)) { return $iconCache[$cacheKey] }

  $result = [pscustomobject]@{
    dataUrl = ""
    source = $candidate
  }

  try {
    $icon = $null
    if ($candidate.ToLowerInvariant().EndsWith(".ico")) {
      $icon = New-Object System.Drawing.Icon($candidate)
    } else {
      $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($candidate)
    }

    if ($icon) {
      $bitmap = $icon.ToBitmap()
      $target = New-Object System.Drawing.Bitmap 96, 96
      $graphics = [System.Drawing.Graphics]::FromImage($target)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($bitmap, 0, 0, 96, 96)
      $stream = New-Object System.IO.MemoryStream
      $target.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $result.dataUrl = "data:image/png;base64," + [Convert]::ToBase64String($stream.ToArray())

      $stream.Dispose()
      $graphics.Dispose()
      $target.Dispose()
      $bitmap.Dispose()
      $icon.Dispose()
    }
  } catch {
    $result.dataUrl = ""
  }

  $iconCache[$cacheKey] = $result
  return $result
}

function Resolve-AppExecutable($displayName, $installLocation, $candidate) {
  $cleanCandidate = Clean-ExePath $candidate
  if ($cleanCandidate -and $cleanCandidate.EndsWith(".exe") -and (Test-Path $cleanCandidate) -and -not (Test-BadExecutable $cleanCandidate)) {
    return $cleanCandidate
  }

  if (-not $installLocation -or -not (Test-Path $installLocation)) {
    if ($cleanCandidate -and $cleanCandidate.EndsWith(".exe") -and -not (Test-BadExecutable $cleanCandidate)) { return $cleanCandidate }
    return ""
  }

  $tokenSource = ($displayName -replace '[^a-zA-Z0-9 ]', ' ').ToLowerInvariant()
  $tokens = $tokenSource.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries) |
    Where-Object { $_.Length -ge 3 } |
    Select-Object -First 4

  $executables = @(Get-ChildItem -Path $installLocation -Filter "*.exe" -File -ErrorAction SilentlyContinue)
  if ($executables.Count -eq 0) {
    $executables = @(Get-ChildItem -Path $installLocation -Filter "*.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 80)
  }

  $choice = $executables |
    Where-Object { -not (Test-BadExecutable $_.FullName) } |
    ForEach-Object {
      $base = $_.BaseName.ToLowerInvariant()
      $score = 0
      if ($tokens -contains $base) { $score += 80 }
      foreach ($token in $tokens) {
        if ($base -eq $token) { $score += 40 }
        elseif ($base.Contains($token)) { $score += 18 }
      }
      if ($_.DirectoryName -eq $installLocation.TrimEnd('\')) { $score += 20 }
      [pscustomobject]@{
        Path = $_.FullName
        Score = $score
        Length = $_.FullName.Length
      }
    } |
    Sort-Object @{Expression = "Score"; Descending = $true}, Length |
    Select-Object -First 1

  if ($choice) { return $choice.Path }
  return ""
}

$shortcutFolders = @(
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  [Environment]::GetFolderPath("Desktop"),
  [Environment]::GetFolderPath("CommonDesktopDirectory")
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$shell = New-Object -ComObject WScript.Shell
foreach ($folder in $shortcutFolders) {
  Get-ChildItem -Path $folder -Filter "*.lnk" -Recurse -File | ForEach-Object {
    $shortcut = $shell.CreateShortcut($_.FullName)
    $target = Clean-ExePath $shortcut.TargetPath
    if ($target -and ($target.EndsWith(".exe") -or $target.StartsWith("shell:"))) {
      $iconPayload = Resolve-IconDataUrl $shortcut.IconLocation $target
      $apps.Add([pscustomobject]@{
        name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
        executable = $target
        arguments = $shortcut.Arguments
        workingDirectory = $shortcut.WorkingDirectory
        iconPath = Clean-ExePath $shortcut.IconLocation
        iconDataUrl = $iconPayload.dataUrl
        iconSource = $iconPayload.source
        source = "Raccourci"
        category = "Raccourcis"
      })
    }
  }
}

$registryPaths = @(
  "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

foreach ($path in $registryPaths) {
  Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
    $candidate = Resolve-AppExecutable $_.DisplayName $_.InstallLocation $_.DisplayIcon
    if ($candidate -and ($candidate.EndsWith(".exe") -or $candidate.StartsWith("shell:"))) {
      $iconPayload = Resolve-IconDataUrl $_.DisplayIcon $candidate
      $apps.Add([pscustomobject]@{
        name = $_.DisplayName
        executable = $candidate
        arguments = ""
        workingDirectory = $_.InstallLocation
        iconPath = $candidate
        iconDataUrl = $iconPayload.dataUrl
        iconSource = $iconPayload.source
        source = "Registre"
        category = "Détectées"
      })
    }
  }
}

$apps |
  Where-Object { $_.name -and $_.executable } |
  Sort-Object name, executable -Unique |
  Select-Object -First 180 |
  ConvertTo-Json -Depth 4 -Compress
`

export async function scanInstalledApps() {
  if (process.platform !== 'win32') {
    return {
      dynamic: false,
      platform: process.platform,
      reason: 'WINDOWS_ONLY',
      apps: [],
      scannedAt: new Date().toISOString(),
    }
  }

  const output = await runPowerShell(windowsScanScript)
  const rawApps = output.trim() ? JSON.parse(output) : []
  const normalizedApps = (Array.isArray(rawApps) ? rawApps : [rawApps])
    .map(normalizeScannedApp)
    .filter(Boolean)

  const uniqueApps = Array.from(
    new Map(normalizedApps.map((app) => [`${app.name}|${app.path}`.toLowerCase(), app])).values(),
  )

  return {
    dynamic: true,
    platform: process.platform,
    reason: null,
    apps: uniqueApps,
    scannedAt: new Date().toISOString(),
  }
}
