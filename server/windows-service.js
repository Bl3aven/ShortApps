import { spawn } from 'node:child_process'

const TASK_NAME = 'ShortAppsBackground'
const TASK_PATH = '\\ShortApps\\'

function psQuote(value = '') {
  return `'${String(value).replace(/'/g, "''")}'`
}

function getExecutablePath() {
  return process.env.SHORTAPPS_DESKTOP_EXE || process.execPath
}

function createUnsupportedStatus() {
  return {
    supported: false,
    installed: false,
    running: false,
    mode: 'scheduled-task',
    taskName: TASK_NAME,
    message: 'WINDOWS_ONLY',
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

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `POWERSHELL_EXIT_${code}`))
        return
      }

      resolve(stdout.trim())
    })
  })
}

async function runStatusScript() {
  const script = `
$ErrorActionPreference = "SilentlyContinue"
$taskName = ${psQuote(TASK_NAME)}
$taskPath = ${psQuote(TASK_PATH)}
$task = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
if ($null -eq $task) {
  @{
    supported = $true
    installed = $false
    running = $false
    mode = "scheduled-task"
    taskName = $taskName
    state = "Absent"
    exePath = ${psQuote(getExecutablePath())}
  } | ConvertTo-Json -Compress
  exit 0
}

$info = Get-ScheduledTaskInfo -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
@{
  supported = $true
  installed = $true
  running = ([string]$task.State -eq "Running")
  mode = "scheduled-task"
  taskName = $taskName
  state = [string]$task.State
  lastRunTime = if ($info) { [string]$info.LastRunTime } else { "" }
  nextRunTime = if ($info) { [string]$info.NextRunTime } else { "" }
  lastTaskResult = if ($info) { [string]$info.LastTaskResult } else { "" }
  exePath = ${psQuote(getExecutablePath())}
} | ConvertTo-Json -Compress
`
  const rawStatus = await runPowerShell(script)
  return JSON.parse(rawStatus)
}

export async function getWindowsServiceStatus() {
  if (process.platform !== 'win32') return createUnsupportedStatus()

  try {
    return await runStatusScript()
  } catch (error) {
    return {
      ...createUnsupportedStatus(),
      supported: true,
      message: error.message,
    }
  }
}

export async function installWindowsService() {
  if (process.platform !== 'win32') return createUnsupportedStatus()

  const executablePath = getExecutablePath()
  const script = `
$ErrorActionPreference = "Stop"
$taskName = ${psQuote(TASK_NAME)}
$taskPath = ${psQuote(TASK_PATH)}
$exePath = ${psQuote(executablePath)}
if (-not (Test-Path -LiteralPath $exePath)) {
  throw "SHORTAPPS_EXE_NOT_FOUND: $exePath"
}

$action = New-ScheduledTaskAction -Execute $exePath -Argument "--service"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  + `-AllowStartIfOnBatteries `
  + `-DisallowStartIfOnBatteries:$false `
  + `-ExecutionTimeLimit (New-TimeSpan -Days 0) `
  + `-MultipleInstances IgnoreNew `
  + `-RestartCount 3 `
  + `-RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  + `-TaskName $taskName `
  + `-TaskPath $taskPath `
  + `-Action $action `
  + `-Trigger $trigger `
  + `-Settings $settings `
  + `-Description "ShortApps background local server and hub tunnel" `
  + `-Force | Out-Null

Start-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
`

  await runPowerShell(script)
  return getWindowsServiceStatus()
}

export async function uninstallWindowsService() {
  if (process.platform !== 'win32') return createUnsupportedStatus()

  const script = `
$ErrorActionPreference = "SilentlyContinue"
$taskName = ${psQuote(TASK_NAME)}
$taskPath = ${psQuote(TASK_PATH)}
Stop-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue
`

  await runPowerShell(script)
  return getWindowsServiceStatus()
}
