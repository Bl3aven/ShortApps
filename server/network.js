import { hostname, networkInterfaces } from 'node:os'

export const SERVER_PORT = Number(process.env.SHORTAPPS_PORT ?? 56321)
export const HTTPS_SERVER_PORT = Number(process.env.SHORTAPPS_HTTPS_PORT ?? 56322)

export function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0)
}

export function isPrivateIpv4(ip) {
  if (!ip) return false
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true

  const [first, second] = ip.split('.').map(Number)
  return first === 172 && second >= 16 && second <= 31
}

export function getLanInterfaces() {
  return Object.values(networkInterfaces())
    .flat()
    .filter(Boolean)
    .filter((entry) => entry.family === 'IPv4' && !entry.internal && isPrivateIpv4(entry.address))
}

export function getPreferredAddress() {
  const overrideAddress = process.env.SHORTAPPS_LOCAL_IP ?? process.env.VITE_SHORTAPPS_LOCAL_IP

  if (overrideAddress) {
    return { address: overrideAddress, netmask: '255.255.255.0', override: true }
  }

  const interfaces = getLanInterfaces()
  return (
    interfaces.find((entry) => entry.address.startsWith('192.168.')) ??
    interfaces.find((entry) => entry.address.startsWith('10.')) ??
    interfaces[0] ?? { address: '127.0.0.1', netmask: '255.255.255.255' }
  )
}

export function getPcName() {
  return (
    process.env.SHORTAPPS_PC_NAME ??
    process.env.COMPUTERNAME ??
    hostname()
  ).toUpperCase()
}

export function normalizeRemoteAddress(remoteAddress = '') {
  if (remoteAddress === '::1') return '127.0.0.1'
  if (remoteAddress.startsWith('::ffff:')) return remoteAddress.slice(7)
  return remoteAddress
}

export function isSameSubnet(clientIp, lanInterface) {
  if (!lanInterface?.netmask || !isPrivateIpv4(clientIp)) return false
  const mask = ipv4ToInt(lanInterface.netmask)
  return (ipv4ToInt(clientIp) & mask) === (ipv4ToInt(lanInterface.address) & mask)
}

export function createStatusPayload({
  httpPort = SERVER_PORT,
  httpsPort = HTTPS_SERVER_PORT,
  httpsAvailable = true,
  httpsError = '',
} = {}) {
  const lan = getPreferredAddress()
  const protocol = httpsAvailable ? 'https' : 'http'
  const networkPort = httpsAvailable ? httpsPort : httpPort

  return {
    pcName: getPcName(),
    localIp: lan.address,
    localUrl: `${protocol}://${lan.address}:${networkPort}`,
    httpUrl: `http://${lan.address}:${httpPort}`,
    httpsUrl: `https://${lan.address}:${httpsPort}`,
    port: httpPort,
    httpsPort,
    httpsAvailable,
    httpsError,
    localOnly: true,
    override: Boolean(lan.override),
  }
}
