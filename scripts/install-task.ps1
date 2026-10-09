$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path "$scriptDir\.."
$nodePath = (Get-Command node.exe).Source
$webEntry = Join-Path $projectRoot 'web\server.js'
$scrapeEntry = Join-Path $projectRoot 'src\index.js'
$workingDir = $projectRoot.Path

# ---- Scrape task (existing) ----
$scrapeTask = 'DailyScraperJableMissav'
$existing = Get-ScheduledTask -TaskName $scrapeTask -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $scrapeTask -Confirm:$false }

$scrapeAction = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$scrapeEntry`" --once" -WorkingDirectory $workingDir
$scrapeTrigger = New-ScheduledTaskTrigger -Daily -At '08:00'
$scrapeSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBorders -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName $scrapeTask `
  -Action $scrapeAction `
  -Trigger $scrapeTrigger `
  -Settings $scrapeSettings `
  -Description "Daily scrape Jable.tv + missav123.com for 絲襪+腳交+中文字幕 videos" `
  | Out-Null

Write-Host "[install-task] scrape registered: $scrapeTask (daily 08:00 Asia/Taipei)"

# ---- Web server task (new) ----
$webTask = 'DailyScraperWeb'
$existing = Get-ScheduledTask -TaskName $webTask -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $webTask -Confirm:$false }

$port = if ($env:PORT) { $env:PORT } else { '3000' }
$host = if ($env:HOST) { $env:HOST } else { '127.0.0.1' }
$webArgument = "`"$webEntry`""
$webEnv = "PORT=$port;HOST=$host"

$webAction = New-ScheduledTaskAction `
  -Execute $nodePath `
  -Argument $webArgument `
  -WorkingDirectory $workingDir

# Use environment-variable syntax to inject PORT / HOST into the action
$webAction = New-ScheduledTaskAction -Execute $nodePath -Argument $webArgument -WorkingDirectory $workingDir
# Inject env via task settings below

$webTrigger = New-ScheduledTaskTrigger -AtLogOn
$webTrigger.Delay = '00:00:30'
$webSettings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBorders `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
  -TaskName $webTask `
  -Action $webAction `
  -Trigger $webTrigger `
  -Settings $webSettings `
  -Description "Run daily-scraper web frontend on http://${host}:${port}" `
  | Out-Null

# Patch environment variables (separate step)
$task = Get-ScheduledTask -TaskName $webTask
$task.EnvironmentVariables.Add('PORT', $port)
$task.EnvironmentVariables.Add('HOST', $host)
$task | Set-ScheduledTask | Out-Null

Write-Host "[install-task] web registered:   $webTask (at logon, restart on crash)"
Write-Host "[install-task] node:    $nodePath"
Write-Host "[install-task] entry:   $webEntry"
Write-Host "[install-task] url:     http://${host}:${port}"
Write-Host ""
Write-Host "[install-task] useful commands:"
Write-Host "  Start-ScheduledTask -TaskName $webTask      # start now"
Write-Host "  Get-ScheduledTask    -TaskName $webTask      # status"
Write-Host "  Stop-ScheduledTask   -TaskName $webTask      # stop"
