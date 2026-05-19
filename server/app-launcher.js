import { spawn } from 'node:child_process'
import { validateAppTarget } from './app-validator.js'

function psQuote(value = '') {
  return `'${String(value).replace(/'/g, "''")}'`
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

  const command = [
    `$ErrorActionPreference = 'Stop'`,
    `$filePath = ${psQuote(executable)}`,
    `$arguments = ${psQuote(app?.arguments ?? '')}`,
    `$workingDirectory = ${psQuote(app?.workingDirectory ?? '')}`,
    `if ($filePath -match '^(https?://|shell:)') { Start-Process -FilePath $filePath; exit 0 }`,
    `if (-not (Test-Path -LiteralPath $filePath)) { throw "EXECUTABLE_NOT_FOUND: $filePath" }`,
    `$startArgs = @{ FilePath = $filePath }`,
    `if ($arguments) { $startArgs.ArgumentList = $arguments }`,
    `if ($workingDirectory -and (Test-Path -LiteralPath $workingDirectory)) { $startArgs.WorkingDirectory = $workingDirectory }`,
    `Start-Process @startArgs`,
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

      resolve({
        launched: true,
        platform: process.platform,
        appId: app?.id,
        name: app?.name,
        validation,
      })
    })
  })
}
