import { spawn } from 'node:child_process'

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

function needsNumLock(vkCode) {
  return (vkCode >= 0x60 && vkCode <= 0x69) || vkCode === 0x6e
}

function runPowerShell(script) {
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

function buildKeyboardScript(vkCode, action) {
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

  await runPowerShell(buildKeyboardScript(vkCode, action))

  return {
    sent: true,
    platform: process.platform,
    key,
    action,
  }
}
