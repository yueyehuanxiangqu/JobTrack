param([Parameter(Mandatory=$true)][ValidateSet('Install','Uninstall','Inspect')][string]$Mode,[switch]$AllowOwnedPackageUpdate)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$pkg = Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json
$brand = Get-Content -Raw -LiteralPath (Join-Path $root 'branding\brand.json') | ConvertFrom-Json
$installer = Join-Path $root ('dist-desktop\JobTrack-Setup-' + $pkg.version + '.exe')
# electron-builder's one-click/current-user target uses the staged package's
# sanitized name for its directory, independently of the visible product name.
$staged = Get-Content -Raw -LiteralPath (Join-Path $root '.desktop-build\app\package.json') | ConvertFrom-Json
if ($staged.name -notmatch '^[a-z0-9-]+$' -or $staged.productName -ne $brand.name) { throw 'Unexpected staged package identity.' }
$installDir = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA ('Programs\' + $staged.name)))
$exe = Join-Path $installDir 'JobTrack.exe'
$uninstaller = Join-Path $installDir 'Uninstall JobTrack.exe'
$reports = Join-Path $root '.local-runtime-test\Phase6C installation'
$ownership = Join-Path $reports 'owned-install.json'
New-Item -ItemType Directory -Path $reports -Force | Out-Null
function Records {
  @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' | ForEach-Object {
    $record = Get-ItemProperty -LiteralPath $_.PSPath
    if ($record.DisplayName -eq 'JobTrack' -or $record.DisplayName -eq ('JobTrack ' + $pkg.version)) { $record }
  })
}
function Assert-NoApp {
  $active = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($installDir + '\', [StringComparison]::OrdinalIgnoreCase) })
  if ($active.Count) { throw 'Close the owned JobTrack application before modifying its installation.' }
}
function Shortcuts {
  $shell = New-Object -ComObject WScript.Shell
  $desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'JobTrack.lnk'
  $programs = [Environment]::GetFolderPath('Programs')
  $files = @($desktop)
  $files += @(Get-ChildItem -LiteralPath $programs -Filter JobTrack.lnk -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {$_.FullName})
  @($files | Select-Object -Unique | Where-Object {Test-Path -LiteralPath $_} | ForEach-Object {
    $lnk = $shell.CreateShortcut($_)
    $folder = (New-Object -ComObject Shell.Application).Namespace([IO.Path]::GetDirectoryName($_))
    $item = $folder.ParseName([IO.Path]::GetFileName($_))
    [pscustomobject]@{Path=$_;Target=$lnk.TargetPath;Icon=$lnk.IconLocation;AppId=$item.ExtendedProperty('System.AppUserModel.ID')}
  })
}
Assert-NoApp
if ($Mode -eq 'Install') {
  if (-not (Test-Path -LiteralPath $installer)) { throw 'Build the exact current-version installer first.' }
  $digest = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash
  if (Test-Path -LiteralPath $ownership) {
    $marker = Get-Content -Raw -LiteralPath $ownership | ConvertFrom-Json
    if ($marker.InstallDir -ne $installDir) { throw 'Owned installation directory differs; review before reuse.' }
    if ($marker.PackageSHA256 -ne $digest -and (-not $AllowOwnedPackageUpdate -or -not $marker.InstalledExeSHA256 -or -not (Test-Path -LiteralPath $exe) -or (Get-FileHash -LiteralPath $exe).Hash -ne $marker.InstalledExeSHA256)) { throw 'Different package requires explicit owned-update approval and an exact prior payload identity.' }
  } elseif ((Test-Path -LiteralPath $installDir) -or @(Records).Count) { throw 'An existing installation is not owned by this test; nothing was overwritten.' }
  $process = Start-Process -FilePath $installer -ArgumentList '/S' -WindowStyle Hidden -PassThru -Wait
  if ($process.ExitCode -ne 0) { throw ('Installer failed: ' + $process.ExitCode) }
  if (-not (Test-Path -LiteralPath $exe)) { throw 'Installed executable missing.' }
  [pscustomobject]@{InstallDir=$installDir;PackageSHA256=$digest;InstalledExeSHA256=(Get-FileHash -LiteralPath $exe).Hash;Version=$pkg.version} | ConvertTo-Json | Set-Content -LiteralPath $ownership -Encoding utf8
} elseif ($Mode -eq 'Uninstall') {
  if (-not (Test-Path -LiteralPath $ownership)) { throw 'No owned-test marker. Refusing to uninstall an unrelated installation.' }
  $marker = Get-Content -Raw -LiteralPath $ownership | ConvertFrom-Json
  if ($marker.InstallDir -ne $installDir -or -not (Test-Path -LiteralPath $uninstaller)) { throw 'Owned uninstaller identity/path mismatch.' }
  $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -PassThru -Wait
  if ($process.ExitCode -ne 0) { throw ('Uninstaller failed: ' + $process.ExitCode) }
  $deadline = (Get-Date).AddSeconds(90)
  while (((Test-Path -LiteralPath $installDir) -or @(Records).Count) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
  if ((Test-Path -LiteralPath $installDir) -or @(Records).Count -or @(Shortcuts).Count) { throw 'Owned application directory, uninstall record or shortcuts remain.' }
  [pscustomobject]@{Mode=$Mode;Passed=$true;ApplicationRemoved=$true;ShortcutsRemoved=$true;UninstallRecordRemoved=$true;UserDataDeletionRequested=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $reports 'uninstall.json') -Encoding utf8
  Write-Output 'PASS actual owned NSIS uninstallation removed app/shortcuts/registration without requesting user-data deletion.'
  exit 0
}
$records = @(Records)
if ($records.Count -ne 1 -or $records[0].DisplayVersion -ne $pkg.version -or $records[0].UninstallString -ne ('"' + $uninstaller + '" /currentuser') -or $records[0].DisplayIcon -ne (Join-Path $installDir 'uninstallerIcon.ico')) { throw 'Installed Apps identity/version/location mismatch.' }
$links = @(Shortcuts)
if ($links.Count -lt 2) { throw 'Desktop or Start menu shortcut missing.' }
foreach ($link in $links) {
  if ($link.Target -ne $exe -or $link.AppId -ne $brand.appId) { throw 'Shortcut executable or AppUserModelID mismatch.' }
}
$meta = (Get-Item -LiteralPath $exe).VersionInfo
if ($meta.ProductName -ne 'JobTrack' -or $meta.FileDescription -ne 'JobTrack' -or $meta.ProductVersion -notin @($pkg.version, ($pkg.version + '.0')) -or $meta.FileVersion -notin @($pkg.version, ($pkg.version + '.0'))) { throw 'EXE product metadata mismatch.' }
$report = [pscustomobject]@{Mode=$Mode;Passed=$true;Version=$pkg.version;InstallDir=$installDir;ProductName=$meta.ProductName;ProductVersion=$meta.ProductVersion;DisplayName=$records[0].DisplayName;Shortcuts=$links;SignatureStatus=(Get-AuthenticodeSignature -LiteralPath $exe).Status.ToString()}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reports 'install.json') -Encoding utf8
Write-Output ('PASS actual NSIS installation, Installed Apps registration, EXE metadata and ' + $links.Count + ' branded shortcuts (' + $pkg.version + ').')
