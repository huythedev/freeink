$ErrorActionPreference = 'Stop'
# Runs only on the disposable Windows CI runner, after both packages are built.
$msi = Get-ChildItem dist -Filter '*.msi' -File | Select-Object -First 1
$exe = Get-ChildItem dist -Filter '*.exe' -File | Select-Object -First 1
$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.OpenDatabase($msi.FullName, 0)
$view = $database.OpenView("SELECT ``ProgId_`` FROM ``Extension`` WHERE ``Extension`` = 'freeink'")
$view.Execute()
$record = $view.Fetch()
if (-not $record -or -not $record.StringData(1)) { throw 'MSI does not register .freeink' }
$view.Close()
$view = $database.OpenView("SELECT ``Argument`` FROM ``Verb`` WHERE ``Extension_`` = 'freeink' AND ``Verb`` = 'open'")
$view.Execute()
$record = $view.Fetch()
if (-not $record -or $record.StringData(1) -notmatch '"%1"') { throw 'MSI open command must quote the document argument' }
$view.Close()
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($database)
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($installer)

$installRoot = Join-Path $env:RUNNER_TEMP 'FreeInk Association Test'
try {
  $process = Start-Process -FilePath $exe.FullName -ArgumentList @('/S', '/currentuser', "/D=$installRoot") -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "NSIS exited with $($process.ExitCode)" }
  $class = (Get-Item 'HKCU:\Software\Classes\.freeink').GetValue('')
  if ($class -ne 'FreeInk.Notebook') { throw 'NSIS did not register the expected .freeink class' }
  $command = (Get-Item "HKCU:\Software\Classes\$class\shell\open\command").GetValue('')
  if ($command -notmatch '^"[^"]+FreeInk\.exe"\s+"%1"$') { throw "Invalid NSIS open command: $command" }
  Write-Host 'NSIS installed association and MSI association tables both verified.'
} finally {
  Get-Process -Name FreeInk -ErrorAction SilentlyContinue | Stop-Process -Force
  $uninstaller = Join-Path $installRoot 'Uninstall FreeInk.exe'
  if (Test-Path $uninstaller) { Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait }
}
