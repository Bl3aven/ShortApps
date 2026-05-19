import { hostname, networkInterfaces } from 'node:os'

export const SERVER_PORT = Number(process.env.SHORTAPPS_PORT ?? 56321)
export const HTTPS_SERVER_PORT = Number(process.env.SHORTAPPS_HTTPS_PORT ?? 56322)
export const DEFAULT_NETWORK_EXPOSURE = Object.freeze({
  mode: 'all',
  selectedInterfaceIds: [],
  primaryInterfaceId: '',
})

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

export function getInterfaceId(name, address) {
  return `${name}:${address}`
}

export function getInterfaceKind(name = '') {
  const normalizedName = name.toLowerCase()

  if (normalizedName.includes('wi-fi') || normalizedName.includes('wifi') || normalizedName.includes('wireless')) {
    return 'Wi-Fi'
  }

  if (normalizedName.includes('bluetooth')) {
    return 'Bluetooth'
  }

  if (normalizedName.includes('virtual') || normalizedName.includes('vethernet') || normalizedName.includes('vmware') || normalizedName.includes('hyper-v')) {
    return 'Virtuel'
  }

  if (normalizedName.includes('ethernet')) {
    return 'Ethernet'
  }

  return 'Réseau'
}

function getOverrideAddress() {
  return process.env.SHORTAPPS_LOCAL_IP ?? process.env.VITE_SHORTAPPS_LOCAL_IP
}

function createOverrideInterface(address) {
  return {
    address,
    netmask: '255.255.255.0',
    family: 'IPv4',
    internal: false,
    cidr: `${address}/24`,
    mac: '',
    id: getInterfaceId('Adresse forcée', address),
    name: 'Adresse forcée',
    kind: 'Manuelle',
    override: true,
  }
}

export function getLanInterfaces() {
  const detectedInterfaces = Object.entries(networkInterfaces()).flatMap(([name, entries = []]) =>
    entries
      .filter(Boolean)
      .filter((entry) => entry.family === 'IPv4' && !entry.internal && isPrivateIpv4(entry.address))
      .map((entry) => ({
        ...entry,
        id: getInterfaceId(name, entry.address),
        name,
        kind: getInterfaceKind(name),
      })),
  )
  const overrideAddress = getOverrideAddress()

  if (
    overrideAddress &&
    isPrivateIpv4(overrideAddress) &&
    !detectedInterfaces.some((entry) => entry.address === overrideAddress)
  ) {
    return [createOverrideInterface(overrideAddress), ...detectedInterfaces]
  }

  return detectedInterfaces
}

export function getPreferredAddress() {
  const overrideAddress = getOverrideAddress()

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

export function normalizeNetworkExposure(exposure = {}) {
  const mode = exposure?.mode === 'selected' ? 'selected' : DEFAULT_NETWORK_EXPOSURE.mode
  const selectedInterfaceIds = Array.isArray(exposure?.selectedInterfaceIds)
    ? [...new Set(exposure.selectedInterfaceIds.filter(Boolean))]
    : []
  const primaryInterfaceId =
    typeof exposure?.primaryInterfaceId === 'string' ? exposure.primaryInterfaceId : ''

  return {
    mode,
    selectedInterfaceIds,
    primaryInterfaceId,
  }
}

export function getExposedInterfaces(exposureConfig, interfaces = getLanInterfaces()) {
  const exposure = normalizeNetworkExposure(exposureConfig)

  if (exposure.mode !== 'selected' || exposure.selectedInterfaceIds.length === 0) {
    return interfaces
  }

  const selectedInterfaces = interfaces.filter((entry) =>
    exposure.selectedInterfaceIds.includes(entry.id),
  )

  return selectedInterfaces.length > 0 ? selectedInterfaces : interfaces
}

export function getPrimaryInterface(exposureConfig, interfaces = getLanInterfaces()) {
  const exposure = normalizeNetworkExposure(exposureConfig)
  const exposedInterfaces = getExposedInterfaces(exposure, interfaces)

  return (
    exposedInterfaces.find((entry) => entry.id === exposure.primaryInterfaceId) ??
    exposedInterfaces.find((entry) => entry.override) ??
    exposedInterfaces.find((entry) => entry.address.startsWith('192.168.')) ??
    exposedInterfaces.find((entry) => entry.address.startsWith('10.')) ??
    exposedInterfaces[0] ??
    getPreferredAddress()
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

function createInterfacePayload(entry, {
  httpPort,
  httpsPort,
  httpsAvailable,
  exposure,
  primaryInterfaceId,
} = {}) {
  const protocol = httpsAvailable ? 'https' : 'http'
  const networkPort = httpsAvailable ? httpsPort : httpPort
  const exposed =
    exposure.mode === 'all' || exposure.selectedInterfaceIds.includes(entry.id)

  return {
    id: entry.id,
    name: entry.name ?? 'Réseau local',
    kind: entry.kind ?? getInterfaceKind(entry.name),
    address: entry.address,
    netmask: entry.netmask,
    cidr: entry.cidr,
    mac: entry.mac,
    exposed,
    primary: entry.id === primaryInterfaceId,
    localUrl: `${protocol}://${entry.address}:${networkPort}`,
    httpUrl: `http://${entry.address}:${httpPort}`,
    httpsUrl: `https://${entry.address}:${httpsPort}`,
  }
}

export function createStatusPayload({
  httpPort = SERVER_PORT,
  httpsPort = HTTPS_SERVER_PORT,
  httpsAvailable = true,
  httpsError = '',
  networkExposure = DEFAULT_NETWORK_EXPOSURE,
} = {}) {
  const interfaces = getLanInterfaces()
  const exposure = normalizeNetworkExposure(networkExposure)
  const hasSelectedInterface = interfaces.some((entry) =>
    exposure.selectedInterfaceIds.includes(entry.id),
  )
  const effectiveExposure =
    exposure.mode === 'selected' &&
    (exposure.selectedInterfaceIds.length === 0 || !hasSelectedInterface)
      ? { ...exposure, mode: 'all' }
      : exposure
  const exposedInterfaces = getExposedInterfaces(effectiveExposure, interfaces)
  const lan = getPrimaryInterface(effectiveExposure, interfaces)
  const primaryInterfaceId = lan.id ?? ''
  const protocol = httpsAvailable ? 'https' : 'http'
  const networkPort = httpsAvailable ? httpsPort : httpPort
  const decoratedInterfaces = interfaces.map((entry) =>
    createInterfacePayload(entry, {
      httpPort,
      httpsPort,
      httpsAvailable,
      exposure: effectiveExposure,
      primaryInterfaceId,
    }),
  )
  const decoratedExposedInterfaces = exposedInterfaces.map((entry) =>
    createInterfacePayload(entry, {
      httpPort,
      httpsPort,
      httpsAvailable,
      exposure: effectiveExposure,
      primaryInterfaceId,
    }),
  )

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
    listenHost: '0.0.0.0',
    networkExposure: {
      ...effectiveExposure,
      primaryInterfaceId,
    },
    interfaces: decoratedInterfaces,
    exposedInterfaces: decoratedExposedInterfaces,
    exposedUrls: decoratedExposedInterfaces.map((entry) => entry.localUrl),
  }
}
