import { spawn } from 'node:child_process'
import { validateAppTarget } from './app-validator.js'

function psQuote(value = '') {
  return `'${String(value).replace(/'/g, "''")}'`
}

function parseArgumentString(value = '') {
  const args = []
  const pattern = /"([^"]*)"|([^\s]+)/g
  let match

  while ((match = pattern.exec(value)) !== null) {
    args.push(match[1] ?? match[2])
  }

  return args
}

function runPowerShellStart(app, executable) {
  const command = [
    `$ErrorActionPreference = 'Stop'`,
    `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Foreground {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@`,
    `$filePath = ${psQuote(executable)}`,
    `$arguments = ${psQuote(app?.arguments ?? '')}`,
    `$workingDirectory = ${psQuote(app?.workingDirectory ?? '')}`,
    `if ($filePath -match '^(https?://|shell:)') { Start-Process -FilePath $filePath; exit 0 }`,
    `if (-not (Test-Path -LiteralPath $filePath)) { throw "EXECUTABLE_NOT_FOUND: $filePath" }`,
    `$startArgs = @{ FilePath = $filePath }`,
    `if ($arguments) { $startArgs.ArgumentList = $arguments }`,
    `if ($workingDirectory -and (Test-Path -LiteralPath $workingDirectory)) { $startArgs.WorkingDirectory = $workingDirectory }`,
    `$process = Start-Process @startArgs -PassThru`,
    `$processName = [System.IO.Path]::GetFileNameWithoutExtension($filePath)`,
    `for ($i = 0; $i -lt 28; $i++) {`,
    `  $candidates = @()`,
    `  if ($process) { $process.Refresh(); $candidates += $process }`,
    `  if ($processName) { $candidates += @(Get-Process -Name $processName -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending) }`,
    `  $target = $candidates | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1`,
    `  if ($target) {`,
    `    [Foreground]::ShowWindowAsync($target.MainWindowHandle, 9) | Out-Null`,
    `    [Foreground]::SetForegroundWindow($target.MainWindowHandle) | Out-Null`,
    `    break`,
    `  }`,
    `  Start-Sleep -Milliseconds 120`,
    `}`,
  ].join('\n')

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { windowsHide: true },
    )
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `APP_LAUNCH_EXIT_${code}`))
        return
      }

      resolve('powershell-start')
    })
  })
}

function launchExecutableDirect(app, executable) {
  return new Promise((resolve, reject) => {
    const workingDirectory = String(app?.workingDirectory ?? '').trim()
    const child = spawn(executable, parseArgumentString(app?.arguments ?? ''), {
      cwd: workingDirectory || undefined,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })

    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve('direct-exe')
    })
  })
}

export async function launchInstalledApp(app) {
  if (process.platform !== 'win32') {
    return {
      launched: false,
      platform: process.platform,
      reason: 'WINDOWS_ONLY',
    }
  }

  const executable = String(app?.path ?? '').trim()
  if (!executable) {
    return {
      launched: false,
      platform: process.platform,
      reason: 'MISSING_EXECUTABLE',
    }
  }

  const validation = await validateAppTarget(app)
  if (!validation.valid) {
    return {
      launched: false,
      platform: process.platform,
      reason: validation.reason,
      validation,
    }
  }

  const transport = executable.toLowerCase().endsWith('.exe')
    ? await runPowerShellStart(app, executable).catch(() => launchExecutableDirect(app, executable))
    : await runPowerShellStart(app, executable)

  return {
    launched: true,
    platform: process.platform,
    appId: app?.id,
    name: app?.name,
    validation,
    transport,
  }
}
