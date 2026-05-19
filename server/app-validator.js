import { stat } from 'node:fs/promises'

const webTargetPattern = /^(https?:\/\/|shell:)/i
const blockedExecutablePattern =
  /^(unins|uninstall|setup|install|updater?|update|crash|report|helper|service|redist|vcredist|mainten|repair|bootstrap)/i

export function isSuspiciousExecutablePath(path = '') {
  const executableName =
    String(path)
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.exe$/i, '') ?? ''

  return blockedExecutablePattern.test(executableName)
}

export async function validateAppTarget(app) {
  const target = String(app?.path ?? '').trim()

  if (!target) {
    return {
      appId: app?.id,
      name: app?.name,
      valid: false,
      target,
      reason: 'MISSING_TARGET',
    }
  }

  if (webTargetPattern.test(target)) {
    return {
      appId: app?.id,
      name: app?.name,
      valid: true,
      target,
      reason: 'WEB_OR_SHELL_TARGET',
    }
  }

  if (isSuspiciousExecutablePath(target)) {
    return {
      appId: app?.id,
      name: app?.name,
      valid: false,
      target,
      reason: 'SUSPICIOUS_EXECUTABLE',
    }
  }

  if (!target.toLowerCase().endsWith('.exe')) {
    return {
      appId: app?.id,
      name: app?.name,
      valid: false,
      target,
      reason: 'NOT_AN_EXECUTABLE',
    }
  }

  if (process.platform !== 'win32') {
    return {
      appId: app?.id,
      name: app?.name,
      valid: false,
      target,
      platform: process.platform,
      reason: 'WINDOWS_ONLY',
    }
  }

  try {
    const targetStat = await stat(target)

    if (!targetStat.isFile()) {
      return {
        appId: app?.id,
        name: app?.name,
        valid: false,
        target,
        reason: 'TARGET_NOT_FILE',
      }
    }

    return {
      appId: app?.id,
      name: app?.name,
      valid: true,
      target,
      reason: 'EXECUTABLE_FOUND',
    }
  } catch {
    return {
      appId: app?.id,
      name: app?.name,
      valid: false,
      target,
      reason: 'EXECUTABLE_NOT_FOUND',
    }
  }
}

export async function validateAppCatalog(apps = []) {
  const results = await Promise.all(apps.map((app) => validateAppTarget(app)))

  return {
    validated: true,
    platform: process.platform,
    apps: results,
    invalidCount: results.filter((result) => !result.valid).length,
    validatedAt: new Date().toISOString(),
  }
}
