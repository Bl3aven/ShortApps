import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPcName } from './network.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const passphrase = 'shortapps-local-https'

function getCertificateDirectory() {
  return join(process.env.SHORTAPPS_DATA_DIR ?? join(projectRoot, 'data'), 'certificates')
}

function psQuote(value = '') {
  return `'${String(value).replace(/'/g, "''")}'`
}

function runCommand(command, args, { input, timeoutMs = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`${command.toUpperCase()}_TIMEOUT`))
    }, timeoutMs)

    if (input) {
      child.stdin.end(input)
    }

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
        reject(new Error(stderr.trim() || `${command.toUpperCase()}_EXIT_${code}`))
        return
      }

      resolve()
    })
  })
}

async function generateWindowsCertificate({ address, pfxPath }) {
  const pcName = getPcName()
  const script = `
$ErrorActionPreference = 'Stop'
$pfxPath = ${psQuote(pfxPath)}
$password = ConvertTo-SecureString -String ${psQuote(passphrase)} -Force -AsPlainText
$pcName = ${psQuote(pcName)}
$ipAddress = ${psQuote(address)}
$dnsNames = @('localhost', $pcName, "$pcName.local")
$san = "2.5.29.17={text}dns=localhost&dns=$pcName&dns=$pcName.local&ipaddress=$ipAddress&ipaddress=127.0.0.1"
$certParams = @{
  DnsName = $dnsNames
  CertStoreLocation = 'Cert:\\CurrentUser\\My'
  KeyAlgorithm = 'RSA'
  KeyLength = 2048
  HashAlgorithm = 'SHA256'
  NotAfter = (Get-Date).AddYears(3)
  KeyExportPolicy = 'Exportable'
  FriendlyName = 'ShortApps Local HTTPS'
  TextExtension = @($san)
}
$cert = New-SelfSignedCertificate @certParams
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null
Remove-Item -Path ("Cert:\\CurrentUser\\My\\" + $cert.Thumbprint) -ErrorAction SilentlyContinue
`

  await runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script])
}

async function generateOpenSslCertificate({ address, keyPath, certPath }) {
  await runCommand('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-days',
    '1095',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-subj',
    `/CN=ShortApps Local ${randomBytes(3).toString('hex')}`,
    '-addext',
    `subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${address}`,
  ])
}

export async function ensureHttpsCertificate(address) {
  const certificateDirectory = getCertificateDirectory()
  const metadataPath = join(certificateDirectory, 'metadata.json')
  const pfxPath = join(certificateDirectory, 'shortapps-local.pfx')
  const keyPath = join(certificateDirectory, 'shortapps-local.key')
  const certPath = join(certificateDirectory, 'shortapps-local.crt')

  await mkdir(certificateDirectory, { recursive: true })

  try {
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
    if (
      metadata.address === address &&
      ((metadata.type === 'pfx' && existsSync(pfxPath)) ||
        (metadata.type === 'pem' && existsSync(keyPath) && existsSync(certPath)))
    ) {
      if (metadata.type === 'pfx') {
        return {
          options: { pfx: await readFile(pfxPath), passphrase },
          type: 'pfx',
          certificatePath: pfxPath,
        }
      }

      return {
        options: { key: await readFile(keyPath), cert: await readFile(certPath) },
        type: 'pem',
        certificatePath: certPath,
      }
    }
  } catch {
    // Missing or outdated certificate metadata is handled by regenerating below.
  }

  await rm(pfxPath, { force: true })
  await rm(keyPath, { force: true })
  await rm(certPath, { force: true })

  if (process.platform === 'win32') {
    await generateWindowsCertificate({ address, pfxPath })
    await writeFile(
      metadataPath,
      JSON.stringify({ address, type: 'pfx', generatedAt: new Date().toISOString() }, null, 2),
    )

    return {
      options: { pfx: await readFile(pfxPath), passphrase },
      type: 'pfx',
      certificatePath: pfxPath,
    }
  }

  await generateOpenSslCertificate({ address, keyPath, certPath })
  await writeFile(
    metadataPath,
    JSON.stringify({ address, type: 'pem', generatedAt: new Date().toISOString() }, null, 2),
  )

  return {
    options: { key: await readFile(keyPath), cert: await readFile(certPath) },
    type: 'pem',
    certificatePath: certPath,
  }
}
