import { spawn } from 'node:child_process'

const COMMAND_TIMEOUT_MS = 2500

const keyMap = {
  '0': 0x60,
  '1': 0x61,
  '2': 0x62,
  '3': 0x63,
  '4': 0x64,
  '5': 0x65,
  '6': 0x66,
  '7': 0x67,
  '8': 0x68,
  '9': 0x69,
  '.': 0x6e,
  '/': 0x6f,
  '*': 0x6a,
  '-': 0x6d,
  '+': 0x6b,
  Enter: 0x0d,
}

const keyUpFlag = 0x0002
const numLockKey = 0x90
let keyboardWorker = null

function needsNumLock(vkCode) {
  return (vkCode >= 0x60 && vkCode <= 0x69) || vkCode === 0x6e
}

const keyboardWorkerScript = `
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Keyboard {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")]
  public static extern short GetKeyState(int nVirtKey);
}
"@
$keyUpFlag = ${keyUpFlag}
$numLockKey = ${numLockKey}

function Write-WorkerResult([bool]$ok, [string]$errorMessage) {
  if ($ok) {
    [Console]::Out.WriteLine('{"ok":true}')
    [Console]::Out.Flush()
    return
  }

  $jsonError = $errorMessage | ConvertTo-Json -Compress
  [Console]::Out.WriteLine("{""ok"":false,""error"":$jsonError}")
  [Console]::Out.Flush()
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
  try {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $payload = $line | ConvertFrom-Json
    $vkCode = [byte]$payload.vkCode
    $action = [string]$payload.action

    if ([bool]$payload.needsNumLock -and (([Keyboard]::GetKeyState($numLockKey) -band 1) -eq 0)) {
      [Keyboard]::keybd_event([byte]$numLockKey, 0, 0, [UIntPtr]::Zero)
      [Keyboard]::keybd_event([byte]$numLockKey, 0, $keyUpFlag, [UIntPtr]::Zero)
    }

    if ($action -eq "press") {
      [Keyboard]::keybd_event($vkCode, 0, 0, [UIntPtr]::Zero)
      [Keyboard]::keybd_event($vkCode, 0, $keyUpFlag, [UIntPtr]::Zero)
    } elseif ($action -eq "down") {
      [Keyboard]::keybd_event($vkCode, 0, 0, [UIntPtr]::Zero)
    } elseif ($action -eq "up") {
      [Keyboard]::keybd_event($vkCode, 0, $keyUpFlag, [UIntPtr]::Zero)
    } else {
      throw "INVALID_ACTION"
    }

    Write-WorkerResult $true ""
  } catch {
    Write-WorkerResult $false $_.Exception.Message
  }
}
`

function rejectPending(worker, error) {
  worker.pending.splice(0).forEach((request) => {
    clearTimeout(request.timeout)
    request.reject(error)
  })
}

function handleWorkerLine(worker, line) {
  const request = worker.pending.shift()
  if (!request) return

  clearTimeout(request.timeout)

  try {
    const payload = JSON.parse(line)
    if (payload.ok) {
      request.resolve()
      return
    }

    request.reject(new Error(payload.error || 'KEYBOARD_WORKER_FAILED'))
  } catch {
    request.reject(new Error('KEYBOARD_WORKER_INVALID_RESPONSE'))
  }
}

function createKeyboardWorker() {
  const worker = {
    child: null,
    pending: [],
    stdoutBuffer: '',
    stderrBuffer: '',
  }

  worker.child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', keyboardWorkerScript],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  )

  worker.child.stdout.on('data', (chunk) => {
    worker.stdoutBuffer += chunk.toString('utf8')
    const lines = worker.stdoutBuffer.split(/\r?\n/)
    worker.stdoutBuffer = lines.pop() ?? ''
    lines.filter(Boolean).forEach((line) => handleWorkerLine(worker, line))
  })

  worker.child.stderr.on('data', (chunk) => {
    worker.stderrBuffer += chunk.toString('utf8')
  })

  worker.child.on('error', (error) => {
    keyboardWorker = null
    rejectPending(worker, error)
  })

  worker.child.on('close', (code) => {
    keyboardWorker = null
    rejectPending(
      worker,
      new Error(worker.stderrBuffer.trim() || `KEYBOARD_WORKER_EXIT_${code}`),
    )
  })

  return worker
}

function sendToKeyboardWorker(command) {
  if (!keyboardWorker || keyboardWorker.child.killed || !keyboardWorker.child.stdin.writable) {
    keyboardWorker = createKeyboardWorker()
  }

  const worker = keyboardWorker

  return new Promise((resolve, reject) => {
    const request = {
      resolve,
      reject,
      timeout: windowlessTimeout(() => {
        const requestIndex = worker.pending.indexOf(request)
        if (requestIndex >= 0) worker.pending.splice(requestIndex, 1)
        keyboardWorker = null
        worker.child.kill()
        reject(new Error('KEYBOARD_WORKER_TIMEOUT'))
      }, COMMAND_TIMEOUT_MS),
    }

    worker.pending.push(request)

    worker.child.stdin.write(`${JSON.stringify(command)}\n`, (error) => {
      if (!error) return

      const requestIndex = worker.pending.indexOf(request)
      if (requestIndex >= 0) worker.pending.splice(requestIndex, 1)
      clearTimeout(request.timeout)
      reject(error)
    })
  })
}

function windowlessTimeout(callback, timeoutMs) {
  return setTimeout(callback, timeoutMs)
}

export function warmKeyboardWorker() {
  if (process.platform !== 'win32') {
    return {
      warmed: false,
      platform: process.platform,
      reason: 'WINDOWS_ONLY',
    }
  }

  if (!keyboardWorker || keyboardWorker.child.killed || !keyboardWorker.child.stdin.writable) {
    keyboardWorker = createKeyboardWorker()
  }

  return {
    warmed: true,
    platform: process.platform,
  }
}

function runPowerShellFallback(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
    )

    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `POWERSHELL_EXIT_${code}`))
        return
      }

      resolve()
    })
  })
}

function buildFallbackKeyboardScript(vkCode, action) {
  const numLockGuard = needsNumLock(vkCode)
    ? `
if (([Keyboard]::GetKeyState(${numLockKey}) -band 1) -eq 0) {
  [Keyboard]::keybd_event(${numLockKey}, 0, 0, [UIntPtr]::Zero)
  [Keyboard]::keybd_event(${numLockKey}, 0, ${keyUpFlag}, [UIntPtr]::Zero)
}
`
    : ''
  const events =
    action === 'press'
      ? [
          `[Keyboard]::keybd_event(${vkCode}, 0, 0, [UIntPtr]::Zero)`,
          `[Keyboard]::keybd_event(${vkCode}, 0, ${keyUpFlag}, [UIntPtr]::Zero)`,
        ]
      : [`[Keyboard]::keybd_event(${vkCode}, 0, ${action === 'up' ? keyUpFlag : 0}, [UIntPtr]::Zero)`]

  return `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Keyboard {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")]
  public static extern short GetKeyState(int nVirtKey);
}
"@
${numLockGuard}
${events.join('\n')}
`
}

export async function sendKeyboardInput({ key, action = 'press' }) {
  if (process.platform !== 'win32') {
    return {
      sent: false,
      platform: process.platform,
      reason: 'WINDOWS_ONLY',
    }
  }

  if (!['down', 'up', 'press'].includes(action)) {
    return {
      sent: false,
      platform: process.platform,
      reason: 'INVALID_ACTION',
    }
  }

  const vkCode = keyMap[key]
  if (!vkCode) {
    return {
      sent: false,
      platform: process.platform,
      reason: 'UNSUPPORTED_KEY',
    }
  }

  let transport = 'persistent-worker'

  try {
    await sendToKeyboardWorker({
      vkCode,
      action,
      needsNumLock: needsNumLock(vkCode),
    })
  } catch {
    transport = 'powershell-fallback'
    await runPowerShellFallback(buildFallbackKeyboardScript(vkCode, action))
  }

  return {
    sent: true,
    platform: process.platform,
    key,
    action,
    transport,
  }
}
