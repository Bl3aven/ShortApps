import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow,
  Check,
  CopyPlus,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Info,
  Layers,
  LayoutDashboard,
  Link,
  Lock,
  Monitor,
  Network,
  Plus,
  RefreshCcw,
  RefreshCw,
  RotateCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Smartphone,
  Text,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'

const DEFAULT_PC_NAME = 'ShortApps PC'
const APP_VERSION = '1.8.1'
const HTTPS_SERVER_PORT = 56322
const PcNameContext = createContext(DEFAULT_PC_NAME)
const DEFAULT_NETWORK_EXPOSURE = {
  mode: 'all',
  selectedInterfaceIds: [],
  primaryInterfaceId: '',
}
const DEFAULT_HUB_SETTINGS = {
  enabled: false,
  url: 'https://shortapps.tournayre.ovh',
  machineId: '',
  secret: '',
}
const NUMPAD_ROWS = [
  [
    { key: '/', label: '/' },
    { key: '*', label: '*' },
    { key: '-', label: '-' },
    { key: '+', label: '+' },
  ],
  [
    { key: '7', label: '7' },
    { key: '8', label: '8' },
    { key: '9', label: '9' },
  ],
  [
    { key: '4', label: '4' },
    { key: '5', label: '5' },
    { key: '6', label: '6' },
  ],
  [
    { key: '1', label: '1' },
    { key: '2', label: '2' },
    { key: '3', label: '3' },
  ],
  [
    { key: '.', label: '.' },
    { key: '0', label: '0' },
    { key: 'Enter', label: 'Entrer', wide: true },
  ],
]

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'applications', label: 'Applications', icon: AppWindow },
  { id: 'wallpapers', label: "Fonds d'écran", icon: ImageIcon },
  { id: 'pages', label: 'Pages', icon: Layers },
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

const APP_CATALOG = [
  {
    id: 'edge',
    name: 'Edge',
    type: 'Application',
    source: 'Détectée',
    category: 'Raccourcis',
    path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    mark: 'e',
    colors: ['#18b6d9', '#2563eb'],
    visualType: 'icon',
    centralText: '',
    status: 'added',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    type: 'Web app',
    source: 'Raccourci',
    category: 'Média',
    path: 'https://youtube.com',
    mark: 'yt',
    colors: ['#ff1f1f', '#d90429'],
    visualType: 'icon',
    centralText: '',
    status: 'available',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    type: 'Application',
    source: 'Détectée',
    category: 'Média',
    path: 'C:\\Users\\Mathys\\AppData\\Roaming\\Spotify\\Spotify.exe',
    mark: 'sp',
    colors: ['#22c55e', '#00a84f'],
    visualType: 'icon',
    centralText: '',
    status: 'added',
  },
  {
    id: 'steam',
    name: 'Steam',
    type: 'Application',
    source: 'Détectée',
    category: 'Jeux',
    path: 'C:\\Program Files (x86)\\Steam\\steam.exe',
    mark: 'st',
    colors: ['#0f2e58', '#1e5799'],
    visualType: 'icon',
    centralText: '',
    status: 'added',
  },
  {
    id: 'discord',
    name: 'Discord',
    type: 'Application',
    source: 'Détectée',
    category: 'Raccourcis',
    path: 'C:\\Users\\Mathys\\AppData\\Local\\Discord\\Update.exe',
    mark: 'dc',
    colors: ['#6d7cff', '#5865f2'],
    visualType: 'icon',
    centralText: '',
    status: 'added',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    type: 'Application',
    source: 'Store',
    category: 'Raccourcis',
    path: 'shell:AppsFolder\\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App',
    mark: 'wa',
    colors: ['#25d366', '#10b981'],
    visualType: 'icon',
    centralText: '',
    status: 'added',
  },
  {
    id: 'photos',
    name: 'Photos',
    type: 'Application',
    source: 'Store',
    category: 'Raccourcis',
    path: 'shell:AppsFolder\\Microsoft.Windows.Photos_8wekyb3d8bbwe!App',
    mark: 'ph',
    colors: ['#f97316', '#ec4899'],
    visualType: 'icon',
    centralText: '',
    status: 'added',
  },
  {
    id: 'notion',
    name: 'Notion',
    type: 'Application',
    source: 'Raccourci',
    category: 'Outils',
    path: 'C:\\Users\\Mathys\\AppData\\Local\\Programs\\Notion\\Notion.exe',
    mark: 'N',
    colors: ['#f8fafc', '#d9dee7'],
    visualType: 'text',
    centralText: 'N',
    status: 'added',
  },
  {
    id: 'chrome',
    name: 'Chrome',
    type: 'Application',
    source: 'Détectée',
    category: 'Raccourcis',
    path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    mark: 'ch',
    colors: ['#facc15', '#22c55e'],
    visualType: 'icon',
    centralText: '',
    status: 'available',
  },
  {
    id: 'vlc',
    name: 'VLC',
    type: 'Application',
    source: 'Détectée',
    category: 'Média',
    path: 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
    mark: 'vlc',
    colors: ['#ff9f1c', '#f97316'],
    visualType: 'icon',
    centralText: '',
    status: 'available',
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    type: 'Application',
    source: 'Détectée',
    category: 'Outils',
    path: 'C:\\Users\\Mathys\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    mark: 'vs',
    colors: ['#38bdf8', '#2563eb'],
    visualType: 'icon',
    centralText: '',
    status: 'available',
  },
  {
    id: 'obs',
    name: 'OBS Studio',
    type: 'Application',
    source: 'Détectée',
    category: 'Outils',
    path: 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
    mark: 'obs',
    colors: ['#27272a', '#111827'],
    visualType: 'icon',
    centralText: '',
    status: 'available',
  },
  {
    id: 'youtube-music',
    name: 'YouTube Music',
    type: 'Web app',
    source: 'Raccourci',
    category: 'Média',
    path: 'https://music.youtube.com',
    mark: 'ym',
    colors: ['#ff0033', '#b91c1c'],
    visualType: 'icon',
    centralText: '',
    status: 'available',
  },
  {
    id: 'xbox',
    name: 'Xbox',
    type: 'Application',
    source: 'Store',
    category: 'Jeux',
    path: 'shell:AppsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App',
    mark: 'xb',
    colors: ['#22c55e', '#15803d'],
    visualType: 'icon',
    centralText: '',
    status: 'available',
  },
  {
    id: 'epic',
    name: 'Epic Games',
    type: 'Application',
    source: 'Détectée',
    category: 'Jeux',
    path: 'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe',
    mark: 'ep',
    colors: ['#18181b', '#52525b'],
    visualType: 'icon',
    centralText: '',
    status: 'available',
  },
]

const INITIAL_PAGES = [
  {
    id: 'home',
    name: 'Accueil',
    order: 1,
    default: true,
    hidden: false,
    slots: ['edge', 'spotify', 'steam', 'discord', 'whatsapp', 'photos', 'notion', 'youtube-music'],
  },
  {
    id: 'games',
    name: 'Jeux',
    order: 2,
    default: false,
    hidden: false,
    slots: ['steam', 'xbox', 'epic', 'discord', null, null, null, null],
  },
  {
    id: 'tools',
    name: 'Outils',
    order: 3,
    default: false,
    hidden: false,
    slots: ['notion', 'vscode', 'whatsapp', null, null, null, null, null],
  },
  {
    id: 'media',
    name: 'Média',
    order: 4,
    default: false,
    hidden: false,
    slots: ['youtube-music', 'spotify', 'vlc', 'photos', null, null, null, null],
  },
]

const WALLPAPERS = [
  {
    id: 'horizon',
    name: 'Horizon Bleu.png',
    size: '1920 x 1080',
    tag: 'Actuel',
    category: 'Paysages',
    css:
      'radial-gradient(circle at 72% 45%, rgba(255, 186, 159, .95) 0 1px, transparent 18%), linear-gradient(150deg, transparent 46%, rgba(255, 190, 173, .9) 48%, transparent 51%), linear-gradient(180deg, #071b3f 0%, #0f2e58 45%, #071126 100%)',
  },
  {
    id: 'violet',
    name: 'Onde Violette.png',
    size: '1920 x 1080',
    tag: 'Nouveau',
    category: 'Abstraits',
    css: 'radial-gradient(circle at 30% 25%, #7046ff 0, transparent 26%), linear-gradient(145deg, #16092f 0%, #522c8f 44%, #151a3f 100%)',
  },
  {
    id: 'alpine',
    name: 'Lac Alpin.png',
    size: '2560 x 1440',
    tag: '',
    category: 'Paysages',
    css: 'linear-gradient(160deg, rgba(249, 168, 112, .85), transparent 45%), linear-gradient(180deg, #5f8fb4 0%, #1d3b55 55%, #0e1f2f 100%)',
  },
  {
    id: 'matrix',
    name: 'Signal Nuit.png',
    size: '1920 x 1080',
    tag: 'Nouveau',
    category: 'Sombres',
    css: 'radial-gradient(circle at 75% 35%, rgba(14, 165, 233, .8), transparent 22%), repeating-linear-gradient(18deg, rgba(34, 211, 238, .16) 0 2px, transparent 2px 18px), linear-gradient(135deg, #020617, #0f172a 65%, #111827)',
  },
  {
    id: 'lake',
    name: 'Lac Minuit.png',
    size: '1920 x 1080',
    tag: '',
    category: 'Sombres',
    css: 'radial-gradient(circle at 55% 20%, rgba(186, 230, 253, .8), transparent 5%), linear-gradient(180deg, #0a1f44 0%, #112b4e 48%, #07111f 100%)',
  },
  {
    id: 'aurora',
    name: 'Aurore Verte.png',
    size: '2560 x 1440',
    tag: '',
    category: 'Abstraits',
    css: 'linear-gradient(130deg, #052e2b 0%, #0d9488 47%, #062a5c 100%)',
  },
  {
    id: 'mist',
    name: 'Brume Matin.png',
    size: '1920 x 1080',
    tag: '',
    category: 'Paysages',
    css: 'linear-gradient(150deg, #e7c4a5 0%, #7ea6be 50%, #17324f 100%)',
  },
  {
    id: 'galaxy',
    name: 'Voie Lactée.png',
    size: '2560 x 1440',
    tag: '',
    category: 'Sombres',
    css: 'radial-gradient(circle at 52% 38%, rgba(226, 232, 240, .95), transparent 5%), radial-gradient(circle at 58% 48%, rgba(125, 211, 252, .45), transparent 19%), linear-gradient(160deg, #020617, #14213d 55%, #0f172a)',
  },
  {
    id: 'custom',
    name: 'Flux Personnalisé.png',
    size: '1920 x 1080',
    tag: 'Personnalisé',
    category: 'Personnalisés',
    css: 'radial-gradient(circle at 35% 60%, rgba(236, 72, 153, .8), transparent 18%), radial-gradient(circle at 70% 38%, rgba(59, 130, 246, .9), transparent 24%), linear-gradient(135deg, #111827 0%, #312e81 100%)',
  },
]

const getLocalServer = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const configuredIp = import.meta.env.VITE_SHORTAPPS_LOCAL_IP
  const ip =
    configuredIp ||
    (hostname && hostname !== '0.0.0.0'
      ? hostname
      : 'localhost')

  return {
    ip,
    url: `https://${ip}:${HTTPS_SERVER_PORT}`,
    port: 56321,
    httpsPort: HTTPS_SERVER_PORT,
    interfaces: [],
    exposedInterfaces: [],
    exposedUrls: [],
    networkExposure: DEFAULT_NETWORK_EXPOSURE,
    httpsAvailable: true,
  }
}

const normalizePublicAccessUrl = (value = '') => {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''

  try {
    const url = new URL(trimmedValue)
    if (url.protocol !== 'https:') return ''

    const normalizedPath = url.pathname.replace(/\/+$/, '')
    return `${url.origin}${normalizedPath === '' ? '' : normalizedPath}`
  } catch {
    return ''
  }
}

const createMachineId = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

const normalizeHubSettings = (settings = {}) => ({
  enabled: Boolean(settings.enabled),
  url: typeof settings.url === 'string' ? settings.url : DEFAULT_HUB_SETTINGS.url,
  machineId: createMachineId(settings.machineId),
  secret: typeof settings.secret === 'string' ? settings.secret : '',
})

const normalizeNetworkExposure = (exposure = {}) => ({
  mode: exposure.mode === 'selected' ? 'selected' : 'all',
  selectedInterfaceIds: Array.isArray(exposure.selectedInterfaceIds)
    ? [...new Set(exposure.selectedInterfaceIds.filter(Boolean))]
    : [],
  primaryInterfaceId:
    typeof exposure.primaryInterfaceId === 'string' ? exposure.primaryInterfaceId : '',
})

const areNetworkExposuresEqual = (left, right) =>
  JSON.stringify(normalizeNetworkExposure(left)) === JSON.stringify(normalizeNetworkExposure(right))

const normalizeServerStatus = (status) => ({
  ip: status.localIp,
  url: status.localUrl,
  httpUrl: status.httpUrl,
  httpsUrl: status.httpsUrl,
  port: status.port,
  httpsPort: status.httpsPort,
  httpsAvailable: status.httpsAvailable,
  httpsError: status.httpsError,
  interfaces: Array.isArray(status.interfaces) ? status.interfaces : [],
  exposedInterfaces: Array.isArray(status.exposedInterfaces) ? status.exposedInterfaces : [],
  exposedUrls: Array.isArray(status.exposedUrls) ? status.exposedUrls : [],
  networkExposure: normalizeNetworkExposure(status.networkExposure),
  hub: status.hub ?? { enabled: false, connected: false, state: 'disabled' },
})

const triggerHaptic = (duration = 12) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([duration])
    return true
  }

  return false
}

const getStoredAuthToken = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('shortapps.authToken') ?? ''
}

const createAuthHeaders = () => {
  const authToken = getStoredAuthToken()
  return authToken ? { 'x-shortapps-auth': authToken } : {}
}

const mergeScannedApps = (currentCatalog, scannedApps) => {
  const nextCatalog = [...currentCatalog]

  scannedApps.forEach((scannedApp) => {
    const existingIndex = nextCatalog.findIndex((app) => {
      const sameName = app.name.toLowerCase() === scannedApp.name.toLowerCase()
      const samePath = app.path && scannedApp.path && app.path.toLowerCase() === scannedApp.path.toLowerCase()
      return sameName || samePath
    })

    if (existingIndex >= 0) {
      nextCatalog[existingIndex] = {
        ...scannedApp,
        ...nextCatalog[existingIndex],
        source: scannedApp.source,
        category: scannedApp.category,
        path: scannedApp.path,
        iconPath: scannedApp.iconPath,
        iconDataUrl: scannedApp.iconDataUrl || nextCatalog[existingIndex].iconDataUrl || '',
        iconSource: scannedApp.iconSource || nextCatalog[existingIndex].iconSource || '',
        workingDirectory: scannedApp.workingDirectory,
        arguments: scannedApp.arguments,
      }
      return
    }

    nextCatalog.push(scannedApp)
  })

  return nextCatalog
}

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue

    try {
      const storedValue = window.localStorage.getItem(key)
      return storedValue ? JSON.parse(storedValue) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // The desktop shell can swap this for JSON/SQLite persistence later.
    }
  }, [key, value])

  return [value, setValue]
}

function App() {
  const isMobileWebApp =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/mobile')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [catalog, setCatalog] = usePersistentState('shortapps.catalog', APP_CATALOG)
  const [pcName, setPcName] = useState(DEFAULT_PC_NAME)
  const [pages, setPages] = usePersistentState('shortapps.pages', INITIAL_PAGES)
  const [selectedPageId, setSelectedPageId] = useState('home')
  const [selectedAppId, setSelectedAppId] = useState('steam')
  const [selectedWallpaperId, setSelectedWallpaperId] = usePersistentState(
    'shortapps.selectedWallpaperId',
    'horizon',
  )
  const [wallpaperSettings, setWallpaperSettings] = usePersistentState('shortapps.wallpaperSettings', {
    blur: 30,
    darken: 25,
    fit: 'Remplir',
  })
  const [phoneMode, setPhoneMode] = useState('landscape')
  const [appSearch, setAppSearch] = useState('')
  const [wallpaperSearch, setWallpaperSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [appFilter, setAppFilter] = useState('Toutes')
  const [wallpaperFilter, setWallpaperFilter] = useState('Tous')
  const [publicAccessUrl, setPublicAccessUrl] = usePersistentState('shortapps.publicAccessUrl', '')
  const [hubSettings, setHubSettings] = usePersistentState('shortapps.hubSettings', DEFAULT_HUB_SETTINGS)
  const [scanState, setScanState] = useState('idle')
  const [validationState, setValidationState] = useState('idle')
  const [configReady, setConfigReady] = useState(false)
  const initialValidationDone = useRef(false)

  const [localServer, setLocalServer] = useState(() => getLocalServer())
  const [networkExposure, setNetworkExposure] = useState(DEFAULT_NETWORK_EXPOSURE)
  const [serverStatus, setServerStatus] = useState('checking')
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? pages[0]
  const selectedApp = catalog.find((app) => app.id === selectedAppId) ?? catalog[0]
  const selectedWallpaper =
    WALLPAPERS.find((wallpaper) => wallpaper.id === selectedWallpaperId) ?? WALLPAPERS[0]
  const publicMobileBaseUrl = normalizePublicAccessUrl(publicAccessUrl)
  const normalizedHubSettings = normalizeHubSettings(hubSettings)
  const hubMobileBaseUrl =
    normalizedHubSettings.enabled && normalizePublicAccessUrl(normalizedHubSettings.url)
      ? normalizePublicAccessUrl(normalizedHubSettings.url)
      : ''
  const mobileUrl = useMemo(() => {
    if (hubMobileBaseUrl) {
      const query = normalizedHubSettings.machineId
        ? `?machine=${encodeURIComponent(normalizedHubSettings.machineId)}`
        : ''
      return `${hubMobileBaseUrl}/mobile${query}`
    }

    const mobileBaseUrl = publicMobileBaseUrl || localServer.url

    return `${mobileBaseUrl}/mobile`
  }, [hubMobileBaseUrl, localServer.url, normalizedHubSettings.machineId, publicMobileBaseUrl])

  const updateNetworkExposure = useCallback((nextExposure) => {
    setNetworkExposure((currentExposure) => {
      const normalizedNext =
        typeof nextExposure === 'function'
          ? normalizeNetworkExposure(nextExposure(currentExposure))
          : normalizeNetworkExposure(nextExposure)

      return areNetworkExposuresEqual(currentExposure, normalizedNext)
        ? currentExposure
        : normalizedNext
    })
  }, [])

  const refreshServerStatus = useCallback(() => {
    return fetch('/api/status')
      .then((response) => {
        if (!response.ok) throw new Error('STATUS_UNAVAILABLE')
        return response.json()
      })
      .then((status) => {
        if (!status) return
        const normalizedStatus = normalizeServerStatus(status)
        setLocalServer(normalizedStatus)
        updateNetworkExposure(normalizedStatus.networkExposure)
        if (status.pcName) setPcName(status.pcName)
        setServerStatus('online')
      })
      .catch(() => {
        setServerStatus('offline')
      })
  }, [updateNetworkExposure])

  const appsById = useMemo(() => {
    return catalog.reduce((acc, app) => {
      acc[app.id] = app
      return acc
    }, {})
  }, [catalog])

  useEffect(() => {
    let cancelled = false
    const configUrl = isMobileWebApp
      ? `/api/config${window.location.search}`
      : '/api/config'

    fetch(configUrl, {
      headers: isMobileWebApp ? createAuthHeaders() : {},
    })
      .then((response) => {
        if (!response.ok) return null
        return response.json()
      })
      .then((payload) => {
        if (cancelled) return
        const config = payload?.config

        if (config) {
          if (Array.isArray(config.catalog)) setCatalog(config.catalog)
          if (Array.isArray(config.pages)) setPages(config.pages)
          if (config.selectedWallpaperId) setSelectedWallpaperId(config.selectedWallpaperId)
          if (config.wallpaperSettings) setWallpaperSettings(config.wallpaperSettings)
          if (config.networkExposure) updateNetworkExposure(config.networkExposure)
          if (typeof config.publicAccessUrl === 'string') setPublicAccessUrl(config.publicAccessUrl)
          if (config.hub) setHubSettings(normalizeHubSettings(config.hub))
        }

        setConfigReady(true)
      })
      .catch(() => {
        if (!cancelled) setConfigReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [
    isMobileWebApp,
    setCatalog,
    setPublicAccessUrl,
    setHubSettings,
    setPages,
    setSelectedWallpaperId,
    setWallpaperSettings,
    updateNetworkExposure,
  ])

  useEffect(() => {
    refreshServerStatus().then(() => {})
  }, [refreshServerStatus])

  useEffect(() => {
    if (isMobileWebApp) return undefined

    const statusTimer = window.setInterval(() => {
      refreshServerStatus()
    }, 2500)

    return () => window.clearInterval(statusTimer)
  }, [isMobileWebApp, refreshServerStatus])

  useEffect(() => {
    if (!configReady || isMobileWebApp) return

    setHubSettings((currentSettings) => {
      const normalizedSettings = normalizeHubSettings(currentSettings)
      if (normalizedSettings.machineId) return currentSettings

      return {
        ...normalizedSettings,
        machineId: createMachineId(pcName),
      }
    })
  }, [configReady, isMobileWebApp, pcName, setHubSettings])

  useEffect(() => {
    if (!configReady) return undefined

    const saveTimer = window.setTimeout(() => {
      fetch('/api/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          config: {
            catalog,
            pages,
            selectedWallpaperId,
            wallpaperSettings,
            networkExposure,
            publicAccessUrl,
            hub: normalizeHubSettings(hubSettings),
          },
        }),
      }).catch(() => {})
    }, 250)

    return () => window.clearTimeout(saveTimer)
  }, [
    catalog,
    configReady,
    hubSettings,
    networkExposure,
    pages,
    publicAccessUrl,
    selectedWallpaperId,
    wallpaperSettings,
  ])

  useEffect(() => {
    if (!configReady || isMobileWebApp) return undefined

    const refreshTimer = window.setTimeout(() => {
      refreshServerStatus()
    }, 450)

    return () => window.clearTimeout(refreshTimer)
  }, [configReady, isMobileWebApp, networkExposure, refreshServerStatus])

  const runAppValidation = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setValidationState('checking')

    try {
      const response = await fetch('/api/apps/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apps: catalog }),
      })
      if (!response.ok) throw new Error('APP_VALIDATE_FAILED')

      const result = await response.json()
      const validationById = new Map(
        (result.apps ?? []).map((validation) => [validation.appId, validation]),
      )

      setCatalog((currentCatalog) =>
        currentCatalog.map((app) => {
          const validation = validationById.get(app.id)
          return validation ? { ...app, validation } : app
        }),
      )

      if (!silent) {
        setValidationState(result.invalidCount > 0 ? 'warning' : 'done')
        window.setTimeout(() => setValidationState('idle'), 2600)
      }
    } catch {
      if (!silent) {
        setValidationState('failed')
        window.setTimeout(() => setValidationState('idle'), 2600)
      }
    }
  }, [catalog, setCatalog])

  const runAppScan = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setScanState('scanning')

    try {
      const response = await fetch('/api/apps/scan')
      if (!response.ok) throw new Error('APP_SCAN_FAILED')

      const result = await response.json()
      if (Array.isArray(result.apps) && result.apps.length > 0) {
        setCatalog((currentCatalog) => mergeScannedApps(currentCatalog, result.apps))
      }

      if (!silent) {
        setScanState(result.dynamic ? 'done' : 'unsupported')
        window.setTimeout(() => setScanState('idle'), 2200)
      }
    } catch {
      if (!silent) {
        setScanState('failed')
        window.setTimeout(() => setScanState('idle'), 2200)
      }
    }
  }, [setCatalog])

  useEffect(() => {
    if (isMobileWebApp) return undefined

    const scanTimer = window.setTimeout(() => {
      runAppScan({ silent: true })
    }, 0)

    return () => window.clearTimeout(scanTimer)
  }, [isMobileWebApp, runAppScan])

  useEffect(() => {
    if (isMobileWebApp || !configReady || initialValidationDone.current) return undefined
    initialValidationDone.current = true

    const validationTimer = window.setTimeout(() => {
      runAppValidation({ silent: true })
    }, 900)

    return () => window.clearTimeout(validationTimer)
  }, [configReady, isMobileWebApp, runAppValidation])

  const pageApps = selectedPage.slots.map((appId) => (appId ? appsById[appId] : null))
  const mobilePages = pages
    .filter((page) => !page.hidden)
    .sort((a, b) => a.order - b.order)
    .map((page) => ({
      ...page,
      apps: page.slots.map((appId) => (appId ? appsById[appId] : null)),
    }))

  const filteredApps = catalog.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(appSearch.toLowerCase())
    const matchesFilter =
      appFilter === 'Toutes' ||
      (appFilter === 'Détectées' && app.source === 'Détectée') ||
      (appFilter === 'Raccourcis' && app.category === 'Raccourcis') ||
      (appFilter === 'Jeux' && app.category === 'Jeux')
    return matchesSearch && matchesFilter
  })

  const filteredWallpapers = WALLPAPERS.filter((wallpaper) => {
    const matchesSearch = wallpaper.name.toLowerCase().includes(wallpaperSearch.toLowerCase())
    const matchesFilter = wallpaperFilter === 'Tous' || wallpaper.category === wallpaperFilter
    return matchesSearch && matchesFilter
  })

  const filteredPages = pages.filter((page) =>
    page.name.toLowerCase().includes(pageSearch.toLowerCase()),
  )

  const updateSelectedApp = (patch) => {
    setCatalog((currentCatalog) =>
      currentCatalog.map((app) => (app.id === selectedApp.id ? { ...app, ...patch } : app)),
    )
  }

  const updateSelectedPage = (patch) => {
    setPages((currentPages) =>
      currentPages.map((page) => (page.id === selectedPage.id ? { ...page, ...patch } : page)),
    )
  }

  const setDefaultPage = (pageId) => {
    setPages((currentPages) =>
      currentPages.map((page) => ({ ...page, default: page.id === pageId })),
    )
  }

  const addAppToDashboard = (appId) => {
    setPages((currentPages) =>
      currentPages.map((page) => {
        if (page.id !== selectedPage.id) return page
        if (page.slots.includes(appId)) return page
        const emptyIndex = page.slots.findIndex((slot) => !slot)
        if (emptyIndex === -1) return page
        const nextSlots = [...page.slots]
        nextSlots[emptyIndex] = appId
        return { ...page, slots: nextSlots }
      }),
    )
    setCatalog((currentCatalog) =>
      currentCatalog.map((app) => (app.id === appId ? { ...app, status: 'added' } : app)),
    )
    setSelectedAppId(appId)
  }

  const removeAppFromSlot = (slotIndex) => {
    setPages((currentPages) =>
      currentPages.map((page) => {
        if (page.id !== selectedPage.id) return page
        const nextSlots = [...page.slots]
        nextSlots[slotIndex] = null
        return { ...page, slots: nextSlots }
      }),
    )
  }

  const handleDragStart = (event, payload) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/shortapps', JSON.stringify(payload))
  }

  const handleDropOnSlot = (event, pageId, slotIndex) => {
    event.preventDefault()
    const rawPayload = event.dataTransfer.getData('application/shortapps')
    if (!rawPayload) return

    const payload = JSON.parse(rawPayload)
    const appId = payload.appId
    setSelectedAppId(appId)

    setPages((currentPages) => {
      if (payload.fromPageId === pageId) {
        return currentPages.map((page) => {
          if (page.id !== pageId) return page
          const nextSlots = [...page.slots]
          const fromIndex = payload.fromIndex
          const movingAppId = nextSlots[fromIndex]
          nextSlots[fromIndex] = nextSlots[slotIndex]
          nextSlots[slotIndex] = movingAppId
          return { ...page, slots: nextSlots }
        })
      }

      return currentPages.map((page) => {
        if (page.id === payload.fromPageId) {
          const nextSlots = [...page.slots]
          nextSlots[payload.fromIndex] = null
          return { ...page, slots: nextSlots }
        }

        if (page.id === pageId) {
          const nextSlots = page.slots.map((slot) => (slot === appId ? null : slot))
          nextSlots[slotIndex] = appId
          return { ...page, slots: nextSlots }
        }

        return page
      })
    })

    setCatalog((currentCatalog) =>
      currentCatalog.map((app) => (app.id === appId ? { ...app, status: 'added' } : app)),
    )
  }

  const createNewPage = () => {
    const nextOrder = pages.length + 1
    const page = {
      id: `page-${Date.now()}`,
      name: `Page ${nextOrder}`,
      order: nextOrder,
      default: false,
      hidden: false,
      slots: Array.from({ length: 8 }, () => null),
    }
    setPages((currentPages) => [...currentPages, page])
    setSelectedPageId(page.id)
  }

  const duplicatePage = () => {
    const copy = {
      ...selectedPage,
      id: `page-${Date.now()}`,
      name: `${selectedPage.name} copie`,
      order: pages.length + 1,
      default: false,
    }
    setPages((currentPages) => [...currentPages, copy])
    setSelectedPageId(copy.id)
  }

  const deletePage = () => {
    if (pages.length === 1) return
    const remainingPages = pages.filter((page) => page.id !== selectedPage.id)
    if (selectedPage.default && remainingPages[0]) remainingPages[0] = { ...remainingPages[0], default: true }
    setPages(remainingPages)
    setSelectedPageId(remainingPages[0].id)
  }

  const renderContent = () => {
    if (activeTab === 'applications') {
      return (
        <ApplicationsView
          apps={filteredApps}
          allApps={catalog}
          appSearch={appSearch}
          setAppSearch={setAppSearch}
          appFilter={appFilter}
          setAppFilter={setAppFilter}
          selectedApp={selectedApp}
          setSelectedAppId={setSelectedAppId}
          updateSelectedApp={updateSelectedApp}
          addAppToDashboard={addAppToDashboard}
          selectedPage={selectedPage}
          appsById={appsById}
          handleDragStart={handleDragStart}
          handleDropOnSlot={handleDropOnSlot}
          removeAppFromSlot={removeAppFromSlot}
          simulateScan={runAppScan}
          scanState={scanState}
          runAppValidation={runAppValidation}
          validationState={validationState}
        />
      )
    }

    if (activeTab === 'wallpapers') {
      return (
        <WallpapersView
          wallpapers={filteredWallpapers}
          wallpaperSearch={wallpaperSearch}
          setWallpaperSearch={setWallpaperSearch}
          wallpaperFilter={wallpaperFilter}
          setWallpaperFilter={setWallpaperFilter}
          selectedWallpaper={selectedWallpaper}
          selectedWallpaperId={selectedWallpaperId}
          setSelectedWallpaperId={setSelectedWallpaperId}
          wallpaperSettings={wallpaperSettings}
          setWallpaperSettings={setWallpaperSettings}
          pageApps={pageApps}
          pages={pages}
        />
      )
    }

    if (activeTab === 'pages') {
      return (
        <PagesView
          pages={filteredPages}
          allPages={pages}
          pageSearch={pageSearch}
          setPageSearch={setPageSearch}
          selectedPage={selectedPage}
          setSelectedPageId={setSelectedPageId}
          updateSelectedPage={updateSelectedPage}
          setDefaultPage={setDefaultPage}
          createNewPage={createNewPage}
          duplicatePage={duplicatePage}
          deletePage={deletePage}
          appsById={appsById}
          selectedWallpaper={selectedWallpaper}
          wallpaperSettings={wallpaperSettings}
          handleDragStart={handleDragStart}
          handleDropOnSlot={handleDropOnSlot}
        />
      )
    }

    if (activeTab === 'settings') {
      return (
        <SettingsView
          localServer={localServer}
          selectedWallpaper={selectedWallpaper}
          wallpaperSettings={wallpaperSettings}
          pageApps={pageApps}
          pages={pages}
          serverStatus={serverStatus}
          mobileUrl={mobileUrl}
          publicAccessUrl={publicAccessUrl}
          setPublicAccessUrl={setPublicAccessUrl}
          hubSettings={hubSettings}
          setHubSettings={setHubSettings}
          networkExposure={networkExposure}
          setNetworkExposure={updateNetworkExposure}
          refreshServerStatus={refreshServerStatus}
        />
      )
    }

    return (
      <DashboardView
        selectedPage={selectedPage}
        pages={pages}
        pageApps={pageApps}
        selectedWallpaper={selectedWallpaper}
        selectedWallpaperId={selectedWallpaperId}
        setSelectedWallpaperId={setSelectedWallpaperId}
        wallpapers={WALLPAPERS.slice(0, 4)}
        wallpaperSettings={wallpaperSettings}
        selectedAppId={selectedAppId}
        setSelectedAppId={setSelectedAppId}
        setSelectedPageId={setSelectedPageId}
        setActiveTab={setActiveTab}
        phoneMode={phoneMode}
        setPhoneMode={setPhoneMode}
        handleDragStart={handleDragStart}
        handleDropOnSlot={handleDropOnSlot}
      />
    )
  }

  if (isMobileWebApp) {
    return (
      <PcNameContext.Provider value={pcName}>
        <MobileWebApp
          pages={mobilePages}
          wallpaper={selectedWallpaper}
          settings={wallpaperSettings}
        />
      </PcNameContext.Provider>
    )
  }

  return (
    <PcNameContext.Provider value={pcName}>
      <div className="app-background">
        <section className="desktop-window" aria-label="ShortApps">
          <TitleBar />
          <div className="window-layout">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} serverStatus={serverStatus} />
            <main className="workspace">{renderContent()}</main>
          </div>
        </section>

        <aside className="floating-phone" aria-label="Aperçu téléphone">
          <PhonePreview
            mode="landscape"
            page={selectedPage}
            pages={pages}
            apps={pageApps}
            wallpaper={selectedWallpaper}
            settings={wallpaperSettings}
            large
          />
        </aside>
      </div>
    </PcNameContext.Provider>
  )
}

function TitleBar() {
  return (
    <header className="title-bar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true" />
        <strong>ShortApps</strong>
      </div>
      <div className="window-controls" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </header>
  )
}

function Sidebar({ activeTab, setActiveTab, serverStatus }) {
  const pcName = useContext(PcNameContext)
  const isOnline = serverStatus !== 'offline'

  return (
    <aside className="sidebar">
      <nav className="nav-list" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-button ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={20} strokeWidth={1.9} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="connection-card">
        <div className="status-line">
          <span className={`online-dot ${isOnline ? '' : 'offline'}`} />
          <span>{isOnline ? 'Serveur en ligne' : 'Serveur hors ligne'}</span>
        </div>
        <strong>{pcName}</strong>
      </div>
    </aside>
  )
}

function DashboardView({
  selectedPage,
  pages,
  pageApps,
  selectedWallpaper,
  selectedWallpaperId,
  setSelectedWallpaperId,
  wallpapers,
  wallpaperSettings,
  selectedAppId,
  setSelectedAppId,
  setSelectedPageId,
  setActiveTab,
  phoneMode,
  setPhoneMode,
  handleDragStart,
  handleDropOnSlot,
}) {
  return (
    <div className="dashboard-layout">
      <section className="panel dashboard-config">
        <SectionHeading
          title="Configurer le tableau de bord"
          subtitle="Choisissez les applications qui apparaîtront sur votre téléphone."
        />

        <PanelToolbar title="Applications">
          <button className="soft-button" type="button" onClick={() => setActiveTab('applications')}>
            <Plus size={16} />
            Ajouter
          </button>
        </PanelToolbar>

        <DashboardGrid
          page={selectedPage}
          apps={pageApps}
          selectedAppId={selectedAppId}
          setSelectedAppId={setSelectedAppId}
          handleDragStart={handleDragStart}
          handleDropOnSlot={handleDropOnSlot}
        />

        <div className="thin-separator" />

        <PanelToolbar title="Pages du tableau de bord">
          <button className="soft-button" type="button" onClick={() => setActiveTab('pages')}>
            <Eye size={16} />
            Aperçu
          </button>
        </PanelToolbar>

        <div className="page-chips">
          {pages.map((page) => (
            <button
              key={page.id}
              className={`page-chip ${page.id === selectedPage.id ? 'active' : ''}`}
              type="button"
              onClick={() => setSelectedPageId(page.id)}
            >
              {page.order}
            </button>
          ))}
          <button className="page-chip" type="button" onClick={() => setActiveTab('pages')}>
            <Plus size={16} />
          </button>
        </div>

        <div className="thin-separator" />

        <PanelToolbar title="Fonds d'écran">
          <button className="soft-button" type="button" onClick={() => setActiveTab('wallpapers')}>
            <ImageIcon size={16} />
            Parcourir
          </button>
        </PanelToolbar>

        <div className="wallpaper-strip">
          {wallpapers.map((wallpaper) => (
            <button
              key={wallpaper.id}
              type="button"
              className={`wallpaper-mini ${
                wallpaper.id === selectedWallpaperId ? 'active' : ''
              }`}
              style={{ background: wallpaper.css }}
              onClick={() => setSelectedWallpaperId(wallpaper.id)}
              aria-label={wallpaper.name}
            >
              {wallpaper.id === selectedWallpaperId && <Check size={16} />}
            </button>
          ))}
        </div>
      </section>

      <section className="panel live-preview-panel">
        <div className="preview-topline">
          <div>
            <h2>Aperçu du téléphone</h2>
            <p>En direct</p>
          </div>
          <Badge tone="green">En ligne</Badge>
        </div>

        <div className="segmented centered">
          <button
            type="button"
            className={phoneMode === 'landscape' ? 'active' : ''}
            onClick={() => setPhoneMode('landscape')}
          >
            <Monitor size={16} />
            Paysage
          </button>
          <button
            type="button"
            className={phoneMode === 'portrait' ? 'active' : ''}
            onClick={() => setPhoneMode('portrait')}
          >
            <Smartphone size={16} />
            Portrait
          </button>
        </div>

        <div className="preview-stack">
          <div>
            <h3>Aperçu paysage principal</h3>
            <PhonePreview
              mode="landscape"
              page={selectedPage}
              pages={pages}
              apps={pageApps}
              wallpaper={selectedWallpaper}
              settings={wallpaperSettings}
            />
          </div>

          <div className="portrait-row">
            <div>
              <h3>Aperçu portrait secondaire</h3>
              <PhonePreview
                mode="portrait"
                page={selectedPage}
                pages={pages}
                apps={pageApps.filter(Boolean).slice(0, 6)}
                wallpaper={selectedWallpaper}
                settings={wallpaperSettings}
              />
            </div>
            <div className="note-box">
              <Info size={18} />
              <span>Le mode paysage reste le mode principal.</span>
            </div>
          </div>
        </div>

        <footer className="preview-footer">
          <span>
            <Smartphone size={16} />
            Actualisé à l'instant
          </span>
        </footer>
      </section>
    </div>
  )
}

function ApplicationsView({
  apps,
  appSearch,
  setAppSearch,
  appFilter,
  setAppFilter,
  selectedApp,
  setSelectedAppId,
  updateSelectedApp,
  addAppToDashboard,
  selectedPage,
  appsById,
  handleDragStart,
  handleDropOnSlot,
  removeAppFromSlot,
  simulateScan,
  scanState,
  runAppValidation,
  validationState,
}) {
  const dashboardApps = selectedPage.slots.map((appId) => (appId ? appsById[appId] : null))

  return (
    <div className="applications-layout">
      <section className="panel app-manager">
        <SectionHeading
          title="Gérer les applications"
          subtitle="Scannez, sélectionnez et organisez les applications disponibles sur votre téléphone."
        />

        <SearchBar
          value={appSearch}
          onChange={setAppSearch}
          placeholder="Rechercher une application"
        />

        <div className="filter-toolbar">
          <SegmentList
            values={['Toutes', 'Détectées', 'Raccourcis', 'Jeux']}
            active={appFilter}
            onChange={setAppFilter}
          />
          <div className="toolbar-actions">
            <button className="soft-button" type="button" onClick={() => simulateScan()}>
              {scanState === 'scanning' ? <RotateCw className="spin" size={16} /> : <RefreshCw size={16} />}
              {scanState === 'done'
                ? 'Scanné'
                : scanState === 'unsupported'
                  ? 'Windows requis'
                  : scanState === 'failed'
                    ? 'Échec'
                    : 'Scanner'}
            </button>
            <button className="soft-button" type="button" onClick={() => runAppValidation()}>
              {validationState === 'checking' ? <RotateCw className="spin" size={16} /> : <ShieldCheck size={16} />}
              {validationState === 'done'
                ? 'Valide'
                : validationState === 'warning'
                  ? 'À corriger'
                  : validationState === 'failed'
                    ? 'Échec'
                    : 'Vérifier'}
            </button>
          </div>
        </div>

        <PanelToolbar title="Applications détectées" />
        <div className="detected-grid">
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              draggable
              className={`detected-app ${selectedApp.id === app.id ? 'active' : ''} ${
                app.validation?.valid === false ? 'invalid' : ''
              }`}
              onClick={() => setSelectedAppId(app.id)}
              onDragStart={(event) => handleDragStart(event, { appId: app.id })}
            >
              <AppIcon app={app} small />
              <span className="detected-name">{app.name}</span>
              {app.validation?.valid === false ? (
                <Badge tone="red">Invalide</Badge>
              ) : app.status === 'added' ? (
                <Badge tone="green">Ajouté</Badge>
              ) : (
                <span
                  className="mini-add"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    addAppToDashboard(app.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addAppToDashboard(app.id)
                  }}
                >
                  <Plus size={16} />
                </span>
              )}
              <GripVertical className="drag-handle" size={17} />
            </button>
          ))}
        </div>

        <section className="drop-zone-section">
          <PanelToolbar title="Glissez les applications dans le dashboard" />
          <DashboardGrid
            page={selectedPage}
            apps={dashboardApps}
            selectedAppId={selectedApp.id}
            setSelectedAppId={setSelectedAppId}
            handleDragStart={handleDragStart}
            handleDropOnSlot={handleDropOnSlot}
            onRemoveSlot={removeAppFromSlot}
            compact
          />
        </section>
      </section>

      <section className="panel editor-panel">
        <AppEditor selectedApp={selectedApp} updateSelectedApp={updateSelectedApp} />
      </section>
    </div>
  )
}

function AppEditor({ selectedApp, updateSelectedApp }) {
  const setVisualType = (visualType) => {
    updateSelectedApp({
      visualType,
      centralText: visualType === 'text' ? selectedApp.centralText || selectedApp.name[0] : '',
    })
  }

  const validationValid = selectedApp.validation?.valid !== false

  return (
    <>
      <h2>Application sélectionnée</h2>
      <div className="selected-entity-card">
        <AppIcon app={selectedApp} />
        <div>
          <strong>{selectedApp.name}</strong>
          <p>
            {selectedApp.type} • {selectedApp.source}
          </p>
        </div>
        <Badge tone={validationValid ? 'green' : 'red'}>
          {validationValid ? 'Valide' : 'À corriger'}
        </Badge>
      </div>

      {!validationValid && (
        <div className="inline-info validation-warning">
          <Info size={17} />
          <span>Chemin non launchable : {selectedApp.validation.reason}</span>
        </div>
      )}

      <Field label="Nom affiché">
        <input
          value={selectedApp.name}
          onChange={(event) => updateSelectedApp({ name: event.target.value })}
        />
      </Field>

      <Field label="Exécutable cible">
        <input
          value={selectedApp.path}
          onChange={(event) => updateSelectedApp({ path: event.target.value })}
        />
      </Field>

      <Field label="Type visuel">
        <div className="segmented full">
          <button
            type="button"
            className={selectedApp.visualType === 'icon' ? 'active' : ''}
            onClick={() => setVisualType('icon')}
          >
            <ImageIcon size={16} />
            Icône
          </button>
          <button
            type="button"
            className={selectedApp.visualType === 'text' ? 'active' : ''}
            onClick={() => setVisualType('text')}
          >
            <Text size={16} />
            Texte
          </button>
        </div>
      </Field>

      {selectedApp.visualType === 'icon' ? (
        <Field label="Aperçu de l'icône">
          <div className="icon-editor-row">
            <AppIcon app={selectedApp} />
          </div>
        </Field>
      ) : (
        <Field label="Texte central">
          <input
            value={selectedApp.centralText}
            maxLength={8}
            onChange={(event) => updateSelectedApp({ centralText: event.target.value || 'App' })}
          />
        </Field>
      )}

      <div className="inline-info">
        <Info size={17} />
        <span>Les modifications sont appliquées en direct au dashboard.</span>
      </div>
    </>
  )
}

function WallpapersView({
  wallpapers,
  wallpaperSearch,
  setWallpaperSearch,
  wallpaperFilter,
  setWallpaperFilter,
  selectedWallpaper,
  selectedWallpaperId,
  setSelectedWallpaperId,
  wallpaperSettings,
  setWallpaperSettings,
  pageApps,
  pages,
}) {
  return (
    <div className="wallpapers-layout">
      <section className="panel wallpaper-manager">
        <SectionHeading
          title="Gérer les fonds d'écran"
          subtitle="Choisissez le fond d'écran affiché derrière les raccourcis du téléphone."
        />

        <SearchBar
          value={wallpaperSearch}
          onChange={setWallpaperSearch}
          placeholder="Rechercher un fond d'écran"
        />

        <SegmentList
          values={['Tous', 'Abstraits', 'Paysages', 'Sombres', 'Personnalisés']}
          active={wallpaperFilter}
          onChange={setWallpaperFilter}
        />

        <div className="wallpaper-grid">
          {wallpapers.map((wallpaper) => (
            <button
              key={wallpaper.id}
              type="button"
              className={`wallpaper-card ${
                wallpaper.id === selectedWallpaperId ? 'active' : ''
              }`}
              style={{ background: wallpaper.css }}
              onClick={() => setSelectedWallpaperId(wallpaper.id)}
            >
              {wallpaper.tag && <Badge tone={wallpaper.tag === 'Actuel' ? 'green' : 'blue'}>{wallpaper.tag}</Badge>}
              {wallpaper.id === selectedWallpaperId && (
                <span className="wallpaper-check">
                  <Check size={18} />
                </span>
              )}
            </button>
          ))}
        </div>

        <PanelToolbar title="Récemment utilisés" />
        <div className="recent-wallpapers">
          {WALLPAPERS.slice(0, 5).map((wallpaper) => (
            <button
              type="button"
              key={wallpaper.id}
              style={{ background: wallpaper.css }}
              className={wallpaper.id === selectedWallpaperId ? 'active' : ''}
              onClick={() => setSelectedWallpaperId(wallpaper.id)}
              aria-label={wallpaper.name}
            />
          ))}
        </div>
      </section>

      <section className="panel wallpaper-editor">
        <h2>Fond sélectionné</h2>
        <div className="wallpaper-large" style={{ background: selectedWallpaper.css }} />
        <div className="meta-row">
          <div>
            <strong>{selectedWallpaper.name}</strong>
            <p>{selectedWallpaper.size}</p>
          </div>
          {selectedWallpaper.tag && <Badge tone="green">{selectedWallpaper.tag}</Badge>}
        </div>

        <RangeField
          label="Intensité du flou"
          value={wallpaperSettings.blur}
          onChange={(blur) => setWallpaperSettings((settings) => ({ ...settings, blur }))}
        />
        <RangeField
          label="Assombrir"
          value={wallpaperSettings.darken}
          onChange={(darken) => setWallpaperSettings((settings) => ({ ...settings, darken }))}
        />

        <Field label="Ajustement">
          <SegmentList
            values={['Remplir', 'Centrer', 'Adapter']}
            active={wallpaperSettings.fit}
            onChange={(fit) => setWallpaperSettings((settings) => ({ ...settings, fit }))}
            compact
          />
        </Field>

        <button
          className="soft-button full-width"
          type="button"
          onClick={() => setWallpaperSettings({ blur: 30, darken: 25, fit: 'Remplir' })}
        >
          <RefreshCcw size={17} />
          Réinitialiser
        </button>

        <div className="inline-info">
          <Info size={17} />
          <span>Le fond est appliqué à toutes les pages du dashboard.</span>
        </div>

        <PanelToolbar title="Aperçu sur le téléphone" />
        <PhonePreview
          mode="landscape"
          page={pages[0]}
          pages={pages}
          apps={pageApps}
          wallpaper={selectedWallpaper}
          settings={wallpaperSettings}
          small
        />
      </section>
    </div>
  )
}

function PagesView({
  pages,
  allPages,
  pageSearch,
  setPageSearch,
  selectedPage,
  setSelectedPageId,
  updateSelectedPage,
  setDefaultPage,
  createNewPage,
  duplicatePage,
  deletePage,
  appsById,
  selectedWallpaper,
  wallpaperSettings,
  handleDragStart,
  handleDropOnSlot,
}) {
  const selectedApps = selectedPage.slots.map((appId) => (appId ? appsById[appId] : null))

  return (
    <div className="pages-layout">
      <section className="panel pages-manager">
        <SectionHeading
          title="Gérer les pages"
          subtitle="Créez, organisez et personnalisez les dashboards affichés sur votre téléphone."
        />

        <div className="search-import-row">
          <SearchBar value={pageSearch} onChange={setPageSearch} placeholder="Rechercher une page" />
          <button className="primary-button compact-button" type="button" onClick={createNewPage}>
            <Plus size={17} />
            Nouvelle page
          </button>
        </div>

        <PanelToolbar title="Pages du dashboard" />
        <div className="page-card-grid">
          {pages.map((page) => {
            const apps = page.slots.map((appId) => (appId ? appsById[appId] : null))
            return (
              <article
                key={page.id}
                className={`page-card ${page.id === selectedPage.id ? 'active' : ''}`}
                onClick={() => setSelectedPageId(page.id)}
              >
                <span className="number-badge">{page.order}</span>
                <PhonePreview
                  mode="landscape"
                  page={page}
                  pages={allPages}
                  apps={apps}
                  wallpaper={selectedWallpaper}
                  settings={wallpaperSettings}
                  thumbnail
                />
                <strong>
                  Page {page.order} — {page.name}
                </strong>
              </article>
            )
          })}
          <button className="add-page-card" type="button" onClick={createNewPage}>
            <Plus size={28} />
            <span>Ajouter une page</span>
          </button>
        </div>

        <div className="inline-info">
          <Info size={17} />
          <span>Sélectionnez une page pour modifier son nom, son ordre ou sa visibilité.</span>
        </div>
      </section>

      <section className="panel page-editor">
        <h2>Page sélectionnée</h2>
        <PhonePreview
          mode="landscape"
          page={selectedPage}
          pages={allPages}
          apps={selectedApps}
          wallpaper={selectedWallpaper}
          settings={wallpaperSettings}
          small
        />

        <Field label="Nom de la page">
          <input
            value={selectedPage.name}
            onChange={(event) => updateSelectedPage({ name: event.target.value })}
          />
        </Field>

        <Field label="Ordre">
          <input
            type="number"
            min="1"
            value={selectedPage.order}
            onChange={(event) => updateSelectedPage({ order: Number(event.target.value) })}
          />
        </Field>

        <ToggleRow
          label="Page par défaut"
          checked={selectedPage.default}
          onChange={() => setDefaultPage(selectedPage.id)}
        />

        <PanelToolbar title="Applications de la page" />
        <DashboardGrid
          page={selectedPage}
          apps={selectedApps}
          selectedAppId=""
          setSelectedAppId={() => {}}
          handleDragStart={handleDragStart}
          handleDropOnSlot={handleDropOnSlot}
          compact
        />

        <div className="button-row">
          <button className="soft-button" type="button" onClick={duplicatePage}>
            <CopyPlus size={17} />
            Dupliquer
          </button>
          <button
            className="soft-button"
            type="button"
            onClick={() => updateSelectedPage({ hidden: !selectedPage.hidden })}
          >
            {selectedPage.hidden ? <Eye size={17} /> : <EyeOff size={17} />}
            {selectedPage.hidden ? 'Afficher' : 'Masquer'}
          </button>
          <button className="danger-button" type="button" onClick={deletePage}>
            <Trash2 size={17} />
            Supprimer
          </button>
        </div>
      </section>
    </div>
  )
}

function SettingsView({
  localServer,
  selectedWallpaper,
  wallpaperSettings,
  pageApps,
  pages,
  serverStatus,
  mobileUrl,
  publicAccessUrl,
  setPublicAccessUrl,
  hubSettings,
  setHubSettings,
  networkExposure,
  setNetworkExposure,
  refreshServerStatus,
}) {
  const pcName = useContext(PcNameContext)
  const normalizedExposure = normalizeNetworkExposure(networkExposure)
  const localPort = String(
    localServer.httpsAvailable
      ? (localServer.httpsPort ?? HTTPS_SERVER_PORT)
      : (localServer.port ?? 56321),
  )
  const isOnline = serverStatus !== 'offline'
  const networkInterfaces = localServer.interfaces ?? []
  const selectedInterfaceIds = new Set(normalizedExposure.selectedInterfaceIds)
  const exposedInterfaces =
    normalizedExposure.mode === 'all'
      ? networkInterfaces
      : networkInterfaces.filter((entry) => selectedInterfaceIds.has(entry.id))
  const displayedExposedCount = exposedInterfaces.length || networkInterfaces.length
  const normalizedPublicUrl = normalizePublicAccessUrl(publicAccessUrl)
  const publicUrlIsInvalid = publicAccessUrl.trim() !== '' && !normalizedPublicUrl
  const normalizedHubSettings = normalizeHubSettings(hubSettings)
  const normalizedHubUrl = normalizePublicAccessUrl(normalizedHubSettings.url)
  const hubUrlIsInvalid = normalizedHubSettings.url.trim() !== '' && !normalizedHubUrl
  const hubActivationReady = Boolean(
    normalizedHubUrl &&
      normalizedHubSettings.machineId &&
      normalizedHubSettings.secret.trim(),
  )
  const hubStatus = localServer.hub ?? { enabled: false, connected: false, state: 'disabled' }
  const [authStatus, setAuthStatus] = useState({ configured: false })
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordSaveState, setPasswordSaveState] = useState('idle')
  const [hubSaveState, setHubSaveState] = useState('idle')

  const refreshAuthStatus = useCallback(() => {
    fetch('/api/auth/status')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload) setAuthStatus(payload)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshAuthStatus()
  }, [refreshAuthStatus])

  const savePassword = async () => {
    if (password.length < 6 || password !== passwordConfirm) {
      setPasswordSaveState('invalid')
      return
    }

    setPasswordSaveState('saving')

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) throw new Error('PASSWORD_SAVE_FAILED')

      setPassword('')
      setPasswordConfirm('')
      setPasswordSaveState('saved')
      refreshAuthStatus()
      window.setTimeout(() => setPasswordSaveState('idle'), 2400)
    } catch {
      setPasswordSaveState('failed')
    }
  }

  const updateHubSettings = (patch) => {
    setHubSettings((currentSettings) =>
      normalizeHubSettings({
        ...currentSettings,
        ...patch,
      }),
    )
  }

  const saveHubConfiguration = async ({ enabled = true } = {}) => {
    const nextHubSettings = normalizeHubSettings({
      ...normalizedHubSettings,
      enabled,
    })

    if (nextHubSettings.enabled && !hubActivationReady) {
      setHubSaveState('invalid')
      return
    }

    setHubSaveState('saving')
    updateHubSettings(nextHubSettings)

    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          config: {
            hub: nextHubSettings,
          },
        }),
      })
      if (!response.ok) throw new Error('HUB_SAVE_FAILED')

      setHubSaveState('saved')
      refreshServerStatus?.()
      window.setTimeout(() => refreshServerStatus?.(), 900)
      window.setTimeout(() => refreshServerStatus?.(), 2200)
      window.setTimeout(() => setHubSaveState('idle'), 2600)
    } catch {
      setHubSaveState('failed')
    }
  }

  const setExposureMode = (mode) => {
    setNetworkExposure((currentExposure) => {
      const current = normalizeNetworkExposure(currentExposure)
      const fallbackInterfaceId =
        current.primaryInterfaceId || localServer.networkExposure?.primaryInterfaceId || networkInterfaces[0]?.id || ''
      const selectedInterfaceIds =
        mode === 'selected' && current.selectedInterfaceIds.length === 0 && fallbackInterfaceId
          ? [fallbackInterfaceId]
          : current.selectedInterfaceIds

      return {
        ...current,
        mode,
        selectedInterfaceIds,
        primaryInterfaceId: current.primaryInterfaceId || fallbackInterfaceId,
      }
    })
  }

  const setPrimaryInterface = (interfaceId) => {
    setNetworkExposure((currentExposure) => {
      const current = normalizeNetworkExposure(currentExposure)
      const selectedIds = new Set(current.selectedInterfaceIds)
      selectedIds.add(interfaceId)

      return {
        ...current,
        selectedInterfaceIds: [...selectedIds],
        primaryInterfaceId: interfaceId,
      }
    })
  }

  const toggleInterface = (interfaceId) => {
    setNetworkExposure((currentExposure) => {
      const current = normalizeNetworkExposure(currentExposure)
      const selectedIds = new Set(current.selectedInterfaceIds)

      if (selectedIds.has(interfaceId) && selectedIds.size > 1) {
        selectedIds.delete(interfaceId)
      } else {
        selectedIds.add(interfaceId)
      }

      const nextSelectedIds = [...selectedIds]
      const primaryInterfaceId = selectedIds.has(current.primaryInterfaceId)
        ? current.primaryInterfaceId
        : interfaceId

      return {
        ...current,
        mode: 'selected',
        selectedInterfaceIds: nextSelectedIds,
        primaryInterfaceId,
      }
    })
  }

  return (
    <div className="settings-layout">
      <section className="panel settings-main">
        <h2>
          <Settings size={22} />
          Paramètres actifs
        </h2>

        <Field label="Nom du PC">
          <input value={pcName} readOnly />
        </Field>

        <DividerTitle icon={Server} title="Serveur local" />
        <div className="server-grid">
          <Field label="Adresse locale">
            <input value={localServer.url} readOnly />
          </Field>
          <Field label="Port">
            <input value={localPort} readOnly />
          </Field>
          <a
            className="soft-button"
            href={localServer.url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            Ouvrir l'interface web
          </a>
        </div>

        <DividerTitle icon={Network} title="Exposition réseau" />
        <div className="network-settings">
          <div className="segmented full">
            <button
              type="button"
              className={normalizedExposure.mode === 'all' ? 'active' : ''}
              onClick={() => setExposureMode('all')}
            >
              Toutes les IP
            </button>
            <button
              type="button"
              className={normalizedExposure.mode === 'selected' ? 'active' : ''}
              onClick={() => setExposureMode('selected')}
            >
              Sélection
            </button>
          </div>

          <div className="network-interface-list">
            {networkInterfaces.length === 0 && (
              <div className="network-empty">
                Aucune interface LAN privée détectée pour le moment.
              </div>
            )}

            {networkInterfaces.map((entry) => {
              const isExposed =
                normalizedExposure.mode === 'all' || selectedInterfaceIds.has(entry.id)
              const isPrimary =
                normalizedExposure.primaryInterfaceId === entry.id || entry.primary

              return (
                <div
                  key={entry.id}
                  className={`network-interface-row ${isExposed ? 'active' : ''}`}
                >
                  <label className="network-check">
                    <input
                      type="checkbox"
                      checked={isExposed}
                      disabled={normalizedExposure.mode === 'all'}
                      onChange={() => toggleInterface(entry.id)}
                    />
                    <span>
                      <strong>{entry.name}</strong>
                      <small>{entry.kind}</small>
                    </span>
                  </label>

                  <code>{entry.address}</code>

                  <button
                    className={`compact-button ${isPrimary ? 'active' : ''}`}
                    type="button"
                    onClick={() => setPrimaryInterface(entry.id)}
                  >
                    {isPrimary ? 'Mobile' : 'Utiliser'}
                  </button>

                  <a
                    className="compact-button"
                    href={entry.localUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              )
            })}
          </div>

          <div className="inline-info">
            <Info size={17} />
            <span>
              Le serveur écoute sur toutes les interfaces ; en mode sélection,
              seuls les sous-réseaux choisis peuvent accéder au mobile.
            </span>
          </div>
        </div>

        <DividerTitle icon={Lock} title="Accès mobile HTTPS" />
        <Field label="URL mobile HTTPS">
          <input
            value={publicAccessUrl}
            onChange={(event) => setPublicAccessUrl(event.target.value)}
            placeholder="https://moodbeast.tailnet-name.ts.net"
          />
        </Field>

        <div className={`inline-info ${publicUrlIsInvalid ? 'validation-warning' : ''}`}>
          <Info size={17} />
          <span>
            {publicUrlIsInvalid
              ? "L'URL mobile doit commencer par https:// pour etre utilisee par iOS."
              : "Utilisez ici une URL HTTPS directe si vous n'utilisez pas le hub. Vide, ShortApps utilise l'adresse HTTPS locale du PC."}
          </span>
        </div>

        <DividerTitle icon={Network} title="Hub distant" />
        <div className="hub-settings">
          <ToggleRow
            label="Connecter ce PC au hub ShortApps"
            checked={normalizedHubSettings.enabled}
            onChange={() => updateHubSettings({ enabled: !normalizedHubSettings.enabled })}
          />
          <div className="password-grid">
            <Field label="URL du hub">
              <input
                value={normalizedHubSettings.url}
                onChange={(event) => updateHubSettings({ url: event.target.value })}
                placeholder="https://shortapps.tournayre.ovh"
              />
            </Field>
            <Field label="ID machine">
              <input
                value={normalizedHubSettings.machineId}
                onChange={(event) => updateHubSettings({ machineId: event.target.value })}
                placeholder="moodbeast"
                autoCapitalize="none"
              />
            </Field>
          </div>
          <Field label="Secret de connexion hub">
            <input
              type="password"
              value={normalizedHubSettings.secret}
              onChange={(event) => updateHubSettings({ secret: event.target.value })}
              placeholder="Secret long defini sur la VM"
            />
          </Field>
          <div className={`inline-info ${hubUrlIsInvalid ? 'validation-warning' : ''}`}>
            <Info size={17} />
            <span>
              {hubUrlIsInvalid
                ? "L'URL du hub doit commencer par https://."
                : "Le hub relaie le telephone vers ce PC via une connexion sortante. Le mot de passe mobile reste verifie par le PC."}
            </span>
          </div>
          {hubSaveState === 'invalid' && (
            <div className="inline-info validation-warning">
              <Info size={17} />
              <span>Renseignez une URL HTTPS valide, un ID machine et le secret hub avant d'activer la connexion.</span>
            </div>
          )}
          {hubSaveState === 'failed' && (
            <div className="inline-info validation-warning">
              <Info size={17} />
              <span>Impossible d'enregistrer la configuration hub depuis cette session.</span>
            </div>
          )}
          {hubSaveState === 'saved' && (
            <div className="inline-info validation-success">
              <Check size={17} />
              <span>Configuration hub enregistrée. La connexion est relancée automatiquement.</span>
            </div>
          )}
          <div className="button-row hub-action-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => saveHubConfiguration({ enabled: true })}
            >
              <Network size={16} />
              {hubSaveState === 'saving'
                ? 'Enregistrement...'
                : normalizedHubSettings.enabled
                  ? 'Enregistrer et connecter'
                  : 'Activer et enregistrer'}
            </button>
            {(normalizedHubSettings.enabled || hubStatus.enabled || hubStatus.connected) && (
              <button
                className="soft-button"
                type="button"
                onClick={() => saveHubConfiguration({ enabled: false })}
              >
                <X size={16} />
                Désactiver le hub
              </button>
            )}
          </div>
        </div>

        <div className="mobile-link-panel">
          <code>{mobileUrl}</code>
          <div className="button-row">
            <a className="soft-button" href={mobileUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              Ouvrir
            </a>
            <button
              className="soft-button"
              type="button"
              onClick={() => navigator.clipboard?.writeText(mobileUrl)}
            >
              <Link size={16} />
              Copier le lien
            </button>
          </div>
        </div>

        <DividerTitle icon={Lock} title="Mot de passe mobile" />
        <div className="password-settings">
          <div className="inline-info">
            <Info size={17} />
            <span>
              {authStatus.configured
                ? 'Un mot de passe est configure. Les telephones doivent le saisir pour charger le dashboard et envoyer des actions.'
                : "Aucun mot de passe n'est configure. Definissez-le ici avant d'utiliser la webapp mobile."}
            </span>
          </div>
          <div className="password-grid">
            <Field label="Nouveau mot de passe">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 caracteres"
              />
            </Field>
            <Field label="Confirmation">
              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="Repetez le mot de passe"
              />
            </Field>
          </div>
          {passwordSaveState === 'invalid' && (
            <div className="inline-info validation-warning">
              <Info size={17} />
              <span>Le mot de passe doit contenir au moins 6 caracteres et correspondre a la confirmation.</span>
            </div>
          )}
          {passwordSaveState === 'failed' && (
            <div className="inline-info validation-warning">
              <Info size={17} />
              <span>Impossible d'enregistrer le mot de passe depuis cette session.</span>
            </div>
          )}
          <button className="primary-button full-width" type="button" onClick={savePassword}>
            <Lock size={16} />
            {passwordSaveState === 'saving'
              ? 'Enregistrement...'
              : passwordSaveState === 'saved'
                ? 'Mot de passe enregistre'
                : 'Enregistrer le mot de passe'}
          </button>
        </div>
      </section>

      <aside className="settings-side">
        <section className="panel system-card">
          <h2>État du système</h2>
          <InfoList
            rows={[
              ['Serveur local', isOnline ? 'En ligne' : 'Hors ligne'],
              ['IP primaire', localServer.ip],
              ['Interfaces exposées', `${displayedExposedCount}/${networkInterfaces.length}`],
              ['URL mobile', normalizedHubSettings.enabled ? 'Hub HTTPS' : normalizedPublicUrl ? 'HTTPS externe' : 'HTTPS local'],
              ['Hub distant', hubStatus.connected ? 'Connecté' : hubStatus.enabled ? hubStatus.state : 'Désactivé'],
              ['Mot de passe', authStatus.configured ? 'Configuré' : 'À définir'],
              ['Version', APP_VERSION],
            ]}
            icons={[Network, Server, Network, Network, Lock, Info, Info]}
          />
        </section>
        <section className="panel system-card">
          <PanelToolbar title="Aperçu mobile" />
          <PhonePreview
            mode="landscape"
            page={pages[0]}
            pages={pages}
            apps={pageApps}
            wallpaper={selectedWallpaper}
            settings={wallpaperSettings}
            small
          />
          <div className="inline-info">
            <Info size={17} />
            <span>Le mode paysage est le mode principal.</span>
          </div>
        </section>
      </aside>
    </div>
  )
}

function MobileWebApp({ pages, wallpaper, settings }) {
  const pcName = useContext(PcNameContext)
  const visiblePages = pages.length
    ? pages
    : [{ id: 'empty', name: 'Accueil', order: 1, apps: [] }]
  const [activePageId, setActivePageId] = useState(visiblePages[0].id)
  const [launchingAppId, setLaunchingAppId] = useState('')
  const [pressedShortcutId, setPressedShortcutId] = useState('')
  const pressedShortcutRef = useRef('')
  const [mobileMode, setMobileMode] = useState('dashboard')
  const [pressedKey, setPressedKey] = useState('')
  const [authState, setAuthState] = useState('checking')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    fetch('/api/auth/status', {
      headers: createAuthHeaders(),
      cache: 'no-store',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload?.configured) {
          setAuthState('setup-required')
          return
        }

        setAuthState(payload.authenticated ? 'authenticated' : 'locked')
      })
      .catch(() => setAuthState('locked'))
  }, [])

  const login = async (event) => {
    event.preventDefault()
    setAuthError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ password: authPassword }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.token) throw new Error(payload?.error ?? 'AUTH_FAILED')

      window.localStorage.setItem('shortapps.authToken', payload.token)
      triggerHaptic(12)
      window.location.reload()
    } catch {
      setAuthError('Mot de passe incorrect ou serveur indisponible.')
      triggerHaptic(35)
    }
  }

  const handleScroll = (event) => {
    const pageWidth = event.currentTarget.clientWidth
    const pageIndex = Math.round(event.currentTarget.scrollLeft / pageWidth)
    const nextPage = visiblePages[pageIndex]
    if (nextPage && nextPage.id !== activePageId) setActivePageId(nextPage.id)
  }

  const launchApp = async (app) => {
    setLaunchingAppId(app.id)

    try {
      const response = await fetch('/api/apps/launch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...createAuthHeaders() },
        cache: 'no-store',
        keepalive: true,
        body: JSON.stringify({ app }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.launched === false) throw new Error(result?.reason ?? 'APP_LAUNCH_FAILED')
    } catch {
      triggerHaptic(30)
    } finally {
      window.setTimeout(() => setLaunchingAppId(''), 650)
    }
  }

  const sendKey = async (key, action) => {
    await fetch('/api/keyboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createAuthHeaders() },
      cache: 'no-store',
      keepalive: true,
      body: JSON.stringify({ key, action }),
    }).catch(() => {})
  }

  const pressKey = (key) => {
    triggerHaptic(10)
    setPressedKey(key)
    sendKey(key, 'down')
  }

  const releaseKey = (key) => {
    setPressedKey('')
    sendKey(key, 'up')
  }

  return (
    <main className="mobile-webapp">
      <div
        className="mobile-wallpaper"
        style={{
          background: wallpaper.css,
          filter: `blur(${settings.blur / 35}px)`,
        }}
      />
      <div
        className="mobile-dimmer"
        style={{ background: `rgba(2, 8, 23, ${settings.darken / 100})` }}
      />

      <header className="mobile-topbar">
        <span>{pcName}</span>
        <button
          className="mobile-mode-toggle"
          type="button"
          onClick={() => {
            triggerHaptic(8)
            setMobileMode((mode) => (mode === 'dashboard' ? 'keypad' : 'dashboard'))
          }}
        >
          ShortApps
        </button>
      </header>

      {authState !== 'authenticated' && (
        <section className="mobile-auth-panel">
          <div className="mobile-auth-card">
            <Lock size={38} />
            <h1>ShortApps</h1>
            {authState === 'setup-required' ? (
              <p>Configurez le mot de passe depuis l'application Windows avant d'ouvrir le dashboard mobile.</p>
            ) : (
              <form onSubmit={login}>
                <label>
                  Mot de passe
                  <input
                    type="password"
                    value={authPassword}
                    autoComplete="current-password"
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="Mot de passe ShortApps"
                  />
                </label>
                {authError && <span>{authError}</span>}
                <button type="submit">Ouvrir le dashboard</button>
              </form>
            )}
          </div>
        </section>
      )}

      {authState === 'authenticated' && mobileMode === 'dashboard' ? (
        <>
          <section className="mobile-pages" onScroll={handleScroll}>
            {visiblePages.map((page) => (
              <article className="mobile-page" key={page.id}>
                <div className="mobile-shortcut-grid">
                  {Array.from({ length: 8 }).map((_, index) => {
                    const app = page.apps[index]

                    return app ? (
                      <button
                        key={`${page.id}-${app.id}`}
                        className={`mobile-shortcut ${
                          launchingAppId === app.id ? 'launching' : ''
                        } ${
                          pressedShortcutId === app.id ? 'pressed' : ''
                        }`}
                        type="button"
                        onPointerDown={() => {
                          triggerHaptic(10)
                          pressedShortcutRef.current = app.id
                          setPressedShortcutId(app.id)
                        }}
                        onPointerUp={() => {
                          const shouldLaunch = pressedShortcutRef.current === app.id
                          pressedShortcutRef.current = ''
                          setPressedShortcutId('')
                          if (shouldLaunch) launchApp(app)
                        }}
                        onPointerCancel={() => {
                          pressedShortcutRef.current = ''
                          setPressedShortcutId('')
                        }}
                        onPointerLeave={() => {
                          pressedShortcutRef.current = ''
                          setPressedShortcutId('')
                        }}
                      >
                        <AppIcon app={app} phone />
                        <span>{app.name}</span>
                      </button>
                    ) : (
                      <span className="mobile-shortcut empty" key={`${page.id}-empty-${index}`} />
                    )
                  })}
                </div>
              </article>
            ))}
          </section>

          <PageDots pages={visiblePages} activePageId={activePageId} />
        </>
      ) : authState === 'authenticated' ? (
        <section className="numpad-panel" aria-label="Pavé numérique">
          {NUMPAD_ROWS.map((row, rowIndex) => (
            <div className={`numpad-row row-${rowIndex + 1}`} key={`row-${rowIndex}`}>
              {row.map((item) => (
                <button
                  className={`numpad-key ${item.wide ? 'wide' : ''} ${
                    pressedKey === item.key ? 'pressed' : ''
                  }`}
                  key={item.key}
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                    pressKey(item.key)
                  }}
                  onPointerUp={(event) => {
                    event.preventDefault()
                    releaseKey(item.key)
                  }}
                  onPointerCancel={() => releaseKey(item.key)}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </main>
  )
}

function PhonePreview({
  mode,
  page,
  pages,
  apps,
  wallpaper,
  settings,
  large = false,
  small = false,
  thumbnail = false,
}) {
  const pcName = useContext(PcNameContext)
  const visibleApps = apps.filter(Boolean).slice(0, mode === 'portrait' ? 6 : 8)
  const frameClass = [
    'phone-frame',
    mode,
    large ? 'large' : '',
    small ? 'small' : '',
    thumbnail ? 'thumbnail' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={frameClass}>
      <div className="phone-bezel">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div
            className="phone-wallpaper"
            style={{
              background: wallpaper.css,
              filter: `blur(${settings.blur / 35}px)`,
            }}
          />
          <div
            className="phone-dimmer"
            style={{ background: `rgba(2, 8, 23, ${settings.darken / 100})` }}
          />

          <div className="phone-header">
            <span>{pcName}</span>
            <strong>ShortApps</strong>
          </div>
          <div className="phone-app-grid">
            {visibleApps.map((app) => (
              <div className="phone-app" key={`${page.id}-${app.id}`}>
                <AppIcon app={app} phone />
                <span>{app.name}</span>
              </div>
            ))}
          </div>
          <PageDots pages={pages} activePageId={page.id} />
        </div>
      </div>
    </div>
  )
}

function DashboardGrid({
  page,
  apps,
  selectedAppId,
  setSelectedAppId,
  handleDragStart,
  handleDropOnSlot,
  onRemoveSlot,
  compact = false,
}) {
  return (
    <div className={`shortcut-grid ${compact ? 'compact' : ''}`}>
      {Array.from({ length: 8 }).map((_, index) => {
        const app = apps[index]
        return (
          <button
            key={`${page.id}-${index}`}
            type="button"
            className={`shortcut-cell ${app?.id === selectedAppId ? 'active' : ''} ${
              !app ? 'empty' : ''
            }`}
            draggable={Boolean(app)}
            onClick={() => app && setSelectedAppId(app.id)}
            onDragStart={(event) =>
              app &&
              handleDragStart(event, {
                appId: app.id,
                fromPageId: page.id,
                fromIndex: index,
              })
            }
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDropOnSlot(event, page.id, index)}
          >
            {compact && <span className="slot-number">{index + 1}</span>}
            {app ? (
              <>
                <AppIcon app={app} />
                <span>{app.name}</span>
                {onRemoveSlot ? (
                  <span
                    className="cell-remove"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemoveSlot(index)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onRemoveSlot(index)
                    }}
                  >
                    <X size={14} />
                  </span>
                ) : (
                  <Check className="cell-check" size={14} />
                )}
              </>
            ) : (
              <Plus size={23} />
            )}
          </button>
        )
      })}
    </div>
  )
}

function AppIcon({ app, small = false, phone = false }) {
  const hasIconImage =
    app.visualType !== 'text' &&
    typeof app.iconDataUrl === 'string' &&
    app.iconDataUrl.startsWith('data:image/')
  const className = [
    'app-icon',
    small ? 'small' : '',
    phone ? 'phone' : '',
    app.visualType === 'text' ? 'text-mode' : '',
    hasIconImage ? 'image-mode' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={className}
      style={{
        '--app-start': app.colors[0],
        '--app-end': app.colors[1],
      }}
      aria-hidden="true"
    >
      {hasIconImage ? (
        <img src={app.iconDataUrl} alt="" loading="lazy" draggable="false" />
      ) : (
        <span>{app.visualType === 'text' ? app.centralText || app.name[0] : app.mark}</span>
      )}
    </span>
  )
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="section-heading">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}

function PanelToolbar({ title, children }) {
  return (
    <div className="panel-toolbar">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <label className="search-bar">
      <Search size={18} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function SegmentList({ values, active, onChange, compact = false }) {
  return (
    <div className={`segment-list ${compact ? 'compact' : ''}`}>
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className={active === value ? 'active' : ''}
          onClick={() => onChange(value)}
        >
          {value}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function RangeField({ label, value, onChange }) {
  return (
    <label className="range-field">
      <span>
        {label}
        <strong>{value} %</strong>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ToggleRow({ label, checked, onChange = () => {} }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        className={`toggle ${checked ? 'active' : ''}`}
        onClick={onChange}
        aria-pressed={checked}
      >
        <span />
      </button>
    </div>
  )
}

function Badge({ children, tone = 'blue' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

function InfoList({ rows, icons = [] }) {
  return (
    <dl className="info-list">
      {rows.map(([label, value], index) => {
        const Icon = icons[index]
        return (
          <div key={label}>
            <dt>
              {Icon && <Icon size={18} />}
              {label}
            </dt>
            <dd>{value}</dd>
          </div>
        )
      })}
    </dl>
  )
}

function DividerTitle({ icon: Icon, title }) {
  return (
    <div className="divider-title">
      <Icon size={22} />
      <h2>{title}</h2>
    </div>
  )
}

function PageDots({ pages, activePageId }) {
  return (
    <div className="page-dots">
      {pages.map((page) => (
        <span key={page.id} className={page.id === activePageId ? 'active' : ''} />
      ))}
    </div>
  )
}

export default App
