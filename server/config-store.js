import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

function getConfigPath() {
  const dataDir = process.env.SHORTAPPS_DATA_DIR ?? join(projectRoot, 'data')
  return {
    dataDir,
    configPath: join(dataDir, 'shortapps-config.json'),
  }
}

export async function readConfig() {
  const { configPath } = getConfigPath()

  try {
    const rawConfig = await readFile(configPath, 'utf8')
    return JSON.parse(rawConfig)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function writeConfig(config) {
  const { dataDir, configPath } = getConfigPath()

  await mkdir(dataDir, { recursive: true })
  await writeFile(
    configPath,
    JSON.stringify(
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
}
