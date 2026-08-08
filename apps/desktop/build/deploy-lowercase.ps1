# Deploy the lowercase "clonedzz" build: copy to Programs\clonedzz, recreate
# desktop/Start-Menu/taskbar shortcuts, refresh the icon cache.
$ErrorActionPreference = 'Continue'

$newDir  = "$env:LOCALAPPDATA\Programs\clonedzz"
$oldDir  = "$env:LOCALAPPDATA\Programs\CloneDzz"
$src     = 'D:\cooks\websites\cloneforge\apps\desktop\release\win-unpacked'
$exe     = Join-Path $newDir 'clonedzz.exe'

# 1. Stop any running app instances
Get-Process | Where-Object { $_.Name -match 'clonedzz|CloneDzz' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Write-Output 'stopped running instances'

# 2. Fresh copy of the new build into the lowercase dir
if (Test-Path $newDir) { Remove-Item $newDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $newDir -Force | Out-Null
Copy-Item -Path (Join-Path $src '*') -Destination $newDir -Recurse -Force
Write-Output "copied to $newDir"

# 3. Remove the old uppercase install dir (no longer used)
if ((Test-Path $oldDir) -and ($oldDir -ne $newDir)) {
    Remove-Item $oldDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Output "removed old $oldDir"
}

# 4. Recreate shortcuts with lowercase label, pointing at the new exe
$wsh = New-Object -ComObject WScript.Shell

$desktop  = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$taskbar  = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'

$targets = @(
    (Join-Path $desktop   'clonedzz.lnk'),
    (Join-Path $startMenu 'clonedzz.lnk'),
    (Join-Path $taskbar   'clonedzz.lnk')
)

foreach ($t in $targets) {
    if (Test-Path $t) { Remove-Item $t -Force -ErrorAction SilentlyContinue }
    $sc = $wsh.CreateShortcut($t)
    $sc.TargetPath = $exe
    $sc.WorkingDirectory = Split-Path $exe
    $sc.IconLocation = "$exe,0"
    $sc.Save()
    Write-Output "shortcut -> $t"
}

# 5. Refresh icon cache (delete iconcache dbs + restart explorer)
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_*.db" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Start-Process explorer.exe
Write-Output 'icon cache refreshed, explorer restarted'
