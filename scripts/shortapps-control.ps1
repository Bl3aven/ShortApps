[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'open', 'stop', 'restart', 'status')]
  [string]$Action = 'open',

  [int]$Port = 5173,
  [int]$TunnelPort = 56321,
  [string]$HostAddress = '0.0.0.0'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LogsDir = Join-Path $ProjectRoot 'logs'
$OutLog = Join-Path $LogsDir 'vite.out.log'
$ErrLog = Join-Path $LogsDir 'vite.err.log'
$PidFile = Join-Path $LogsDir 'shortapps-dev.pid'
$TunnelOutLog = Join-Path $LogsDir 'local-server.out.log'
$TunnelErrLog = Join-Path $LogsDir 'local-server.err.log'
$TunnelPidFile = Join-Path $LogsDir 'shortapps-tunnel.pid'
$LocalUrl = "http://localhost:$Port/"
$StatusUrl = "http://127.0.0.1:$Port/api/status"
$TunnelLocalUrl = "http://localhost:$TunnelPort/"
$TunnelStatusUrl = "http://127.0.0.1:$TunnelPort/api/status"

function Test-ShortAppsHttp {
  try {
    $response = Invoke-WebRequest -Uri $StatusUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-ShortAppsStatus {
  try {
    return Invoke-RestMethod -Uri $StatusUrl -TimeoutSec 2
  } catch {
    return $null
  }
}

function Test-TunnelHttp {
  try {
    $response = Invoke-WebRequest -Uri $TunnelStatusUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-TunnelStatus {
  try {
    return Invoke-RestMethod -Uri $TunnelStatusUrl -TimeoutSec 2
  } catch {
    return $null
  }
}

function Test-ShortAppsProcess {
  param([Parameter(Mandatory)] $ProcessInfo)

  $name = [string]$ProcessInfo.Name
  $commandLine = [string]$ProcessInfo.CommandLine
  if (-not $commandLine) { return $false }

  $rootPattern = [regex]::Escape($ProjectRoot)
  $portPattern = "--port\s+$Port\b"

  if ($name -eq 'node.exe') {
    if (
      $commandLine -match $rootPattern -and (
        $commandLine -match 'vite[\\/]+bin[\\/]+vite\.js' -or
        $commandLine -match 'server[\\/]+local-server\.js' -or
        $commandLine -match 'electron[\\/]+cli\.js'
      )
    ) {
      return $true
    }

    if (
      $commandLine -match 'npm-cli\.js' -and
      $commandLine -match 'run\s+(dev|start|electron|preview)' -and
      $commandLine -match $portPattern
    ) {
      return $true
    }
  }

  if ($name -eq 'cmd.exe') {
    if (
      $commandLine -match $rootPattern -and
      $commandLine -match 'npm(\.cmd)?' -and
      $commandLine -match 'run\s+(dev|start|electron|preview)'
    ) {
      return $true
    }

    if ($commandLine -match 'vite' -and $commandLine -match $portPattern) {
      return $true
    }
  }

  if (($name -eq 'electron.exe' -or $name -eq 'ShortApps.exe') -and $commandLine -match $rootPattern) {
    return $true
  }

  return $false
}

function Add-DescendantProcessIds {
  param(
    [Parameter(Mandatory)] [object[]]$AllProcesses,
    [Parameter(Mandatory)] [System.Collections.Generic.HashSet[int]]$Ids,
    [Parameter(Mandatory)] [int]$ParentId
  )

  $children = @($AllProcesses | Where-Object { $_.ParentProcessId -eq $ParentId })
  foreach ($child in $children) {
    if ($Ids.Add([int]$child.ProcessId)) {
      Add-DescendantProcessIds -AllProcesses $AllProcesses -Ids $Ids -ParentId ([int]$child.ProcessId)
    }
  }
}

function Get-ShortAppsProcesses {
  $allProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and $_.Name -in @('node.exe', 'cmd.exe', 'electron.exe', 'ShortApps.exe')
  })

  $matchedProcesses = @($allProcesses | Where-Object { Test-ShortAppsProcess $_ })
  $ids = [System.Collections.Generic.HashSet[int]]::new()

  foreach ($processInfo in $matchedProcesses) {
    [void]$ids.Add([int]$processInfo.ProcessId)
    Add-DescendantProcessIds -AllProcesses $allProcesses -Ids $ids -ParentId ([int]$processInfo.ProcessId)

    $parent = $allProcesses | Where-Object { $_.ProcessId -eq $processInfo.ParentProcessId } | Select-Object -First 1
    while ($parent -and (Test-ShortAppsProcess $parent)) {
      [void]$ids.Add([int]$parent.ProcessId)
      $parent = $allProcesses | Where-Object { $_.ProcessId -eq $parent.ParentProcessId } | Select-Object -First 1
    }
  }

  $portsToCheck = @()
  if (Test-ShortAppsHttp) { $portsToCheck += $Port }
  if (Test-TunnelHttp) { $portsToCheck += $TunnelPort }

  if ($portsToCheck.Count -gt 0) {
    try {
      foreach ($listenerPort in $portsToCheck) {
        $listeners = @(Get-NetTCPConnection -LocalPort $listenerPort -State Listen -ErrorAction Stop)
        foreach ($listener in $listeners) {
          $owner = $allProcesses | Where-Object { $_.ProcessId -eq $listener.OwningProcess } | Select-Object -First 1
          if ($owner -and ((Test-ShortAppsProcess $owner) -or ($listenerPort -in @($Port, $TunnelPort)))) {
            [void]$ids.Add([int]$owner.ProcessId)
            Add-DescendantProcessIds -AllProcesses $allProcesses -Ids $ids -ParentId ([int]$owner.ProcessId)
          }
        }
      }
    } catch {
      # Get-NetTCPConnection is best-effort here.
    }
  }

  return @($allProcesses | Where-Object { $ids.Contains([int]$_.ProcessId) })
}

function Start-ShortApps {
  New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

  $devWasRunning = Test-ShortAppsHttp
  $tunnelWasRunning = Test-TunnelHttp

  if ($devWasRunning) {
    Write-Host "Interface deja lancee: $LocalUrl"
  } else {
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    $command = "cd /d `"$ProjectRoot`" && `"$npm`" run dev -- --host $HostAddress --port $Port"
    $process = Start-Process `
      -FilePath "$env:SystemRoot\System32\cmd.exe" `
      -ArgumentList @('/d', '/s', '/c', "`"$command`"") `
      -WorkingDirectory $ProjectRoot `
      -RedirectStandardOutput $OutLog `
      -RedirectStandardError $ErrLog `
      -WindowStyle Hidden `
      -PassThru

    if ($process) {
      Set-Content -Path $PidFile -Value ([string]$process.Id) -Encoding ascii
    }
  }

  if ($tunnelWasRunning) {
    Write-Host "Tunnel local deja lance: $TunnelLocalUrl"
  } else {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $tunnelProcess = Start-Process `
      -FilePath $node `
      -ArgumentList @('server/local-server.js') `
      -WorkingDirectory $ProjectRoot `
      -RedirectStandardOutput $TunnelOutLog `
      -RedirectStandardError $TunnelErrLog `
      -WindowStyle Hidden `
      -PassThru

    if ($tunnelProcess) {
      Set-Content -Path $TunnelPidFile -Value ([string]$tunnelProcess.Id) -Encoding ascii
    }
  }

  if (-not $devWasRunning) {
    for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
      if (Test-ShortAppsHttp) {
        Write-Host "Interface lancee: $LocalUrl"
        break
      }
      Start-Sleep -Milliseconds 250
    }

    if (-not (Test-ShortAppsHttp)) {
      Write-Warning "L'interface ne repond pas encore sur $LocalUrl"
      if (Test-Path -LiteralPath $ErrLog) {
        Get-Content -LiteralPath $ErrLog -Tail 20
      }
    }
  }

  if (-not $tunnelWasRunning) {
    for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
      if (Test-TunnelHttp) {
        Write-Host "Tunnel local lance: $TunnelLocalUrl"
        break
      }
      Start-Sleep -Milliseconds 250
    }

    if (-not (Test-TunnelHttp)) {
      Write-Warning "Le tunnel local ne repond pas encore sur $TunnelLocalUrl"
      if (Test-Path -LiteralPath $TunnelErrLog) {
        Get-Content -LiteralPath $TunnelErrLog -Tail 20
      }
    }
  }

  $tunnelStatus = Get-TunnelStatus
  if ($tunnelStatus -and $tunnelStatus.hub) {
    $hub = $tunnelStatus.hub
    if ($hub.connected) {
      Write-Host "Hub connecte: $($hub.url) / machine $($hub.machineId)"
    } else {
      Write-Host "Hub: $($hub.state)"
      if ($hub.lastError) {
        Write-Host "Derniere erreur hub: $($hub.lastError)"
      }
    }
  }
}

function Open-ShortApps {
  Start-ShortApps
  Start-Process $LocalUrl
}

function Stop-ShortApps {
  $processes = @(Get-ShortAppsProcesses)

  if ($processes.Count -eq 0) {
    if ((Test-ShortAppsHttp) -or (Test-TunnelHttp)) {
      Write-Warning "ShortApps repond, mais aucun processus n'a ete identifie automatiquement."
    } else {
      Write-Host "ShortApps est deja arrete."
    }
    return
  }

  $ids = @($processes | Select-Object -ExpandProperty ProcessId -Unique)
  foreach ($id in $ids) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }

  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    if ((-not (Test-ShortAppsHttp)) -and (-not (Test-TunnelHttp))) { break }
    Start-Sleep -Milliseconds 200
  }

  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $TunnelPidFile -Force -ErrorAction SilentlyContinue
  Write-Host "ShortApps ferme."
}

function Show-ShortAppsStatus {
  $status = Get-ShortAppsStatus
  $tunnelStatus = Get-TunnelStatus

  if ($status) {
    Write-Host "Interface: lancee"
    Write-Host "URL:       $LocalUrl"
    if ($status.localUrl) {
      Write-Host "Reseau:    $($status.localUrl)"
    }
  } else {
    Write-Host "Interface: arretee"
  }

  if ($tunnelStatus) {
    Write-Host "Tunnel:    lance"
    Write-Host "Local:     $TunnelLocalUrl"
    if ($tunnelStatus.hub) {
      $hub = $tunnelStatus.hub
      Write-Host "Hub:       $($hub.state)"
      if ($hub.machineId) {
        Write-Host "Machine:   $($hub.machineId)"
      }
      if ($hub.url) {
        Write-Host "Hub URL:   $($hub.url)"
      }
      if ($hub.lastError) {
        Write-Host "Erreur:    $($hub.lastError)"
      }
    }
  } else {
    Write-Host "Tunnel:    arrete"
  }

  $processes = @(Get-ShortAppsProcesses)
  if ($processes.Count -gt 0) {
    Write-Host ""
    Write-Host "Processus:"
    $processes |
      Sort-Object ProcessId |
      Select-Object ProcessId, Name, CommandLine |
      Format-Table -AutoSize
  }
}

switch ($Action) {
  'start' { Start-ShortApps }
  'open' { Open-ShortApps }
  'stop' { Stop-ShortApps }
  'restart' {
    Stop-ShortApps
    Start-ShortApps
    Start-Process $LocalUrl
  }
  'status' { Show-ShortAppsStatus }
}
