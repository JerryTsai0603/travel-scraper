$ErrorActionPreference = 'Stop'

$tasks = @('DailyScraperJableMissav', 'DailyScraperWeb')
foreach ($name in $tasks) {
  $existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($existing) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    Write-Host "[uninstall-task] removed: $name"
  } else {
    Write-Host "[uninstall-task] not found: $name"
  }
}
