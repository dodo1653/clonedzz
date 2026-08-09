# Update the clonedzz v1.0.0 draft release: delete old CloneDzz-named assets,
# upload the new lowercase-named installers.
$ErrorActionPreference = 'Stop'

# Get the GitHub token from the git credential store
$input = "protocol=https`nhost=github.com`n`n"
$token = (($input | git credential fill 2>$null) | Select-String '^password=').ToString().Replace('password=', '')
if (-not $token) { Write-Error 'ERROR: no token found in git credential store'; exit 1 }

$headers = @{ 'Authorization' = "Bearer $token"; 'User-Agent' = 'clonedzz-release-tool' }
$api = 'https://api.github.com/repos/dodo1653/curseforge'

# Find the draft release (v1.0.0)
$rels = Invoke-RestMethod -Headers $headers -Uri "$api/releases" -Method Get
$rel = $rels | Where-Object { $_.tag_name -eq 'v1.0.0' } | Select-Object -First 1
if (-not $rel) { Write-Error 'ERROR: no v1.0.0 release found'; exit 1 }
Write-Output "release: $($rel.tag_name) draft=$($rel.draft) id=$($rel.id)"

# Delete existing assets
foreach ($a in $rel.assets) {
    Write-Output "deleting old asset: $($a.name) ($($a.id))"
    Invoke-RestMethod -Headers $headers -Uri "$api/releases/assets/$($a.id)" -Method Delete | Out-Null
}
Write-Output 'old assets deleted'

# Upload the new installers
$files = @(
    @{ Path = 'D:\cooks\websites\cloneforge\apps\desktop\release\clonedzz Setup 1.0.0.exe'; Name = 'clonedzz Setup 1.0.0.exe' },
    @{ Path = 'D:\cooks\websites\cloneforge\apps\desktop\release\clonedzz 1.0.0.exe'; Name = 'clonedzz 1.0.0.exe' }
)

foreach ($f in $files) {
    $asset = Get-Item $f.Path
    Write-Output "uploading $($f.Name) ($([math]::Round($asset.Length/1MB)) MB)..."
    $uploadUrl = "https://uploads.github.com/repos/dodo1653/curseforge/releases/$($rel.id)/assets?name=$([uri]::EscapeDataString($f.Name))"
    $uploadHeaders = @{
        'Authorization' = "Bearer $token"
        'User-Agent' = 'clonedzz-release-tool'
        'Content-Type' = 'application/octet-stream'
    }
    try {
        $resp = Invoke-RestMethod -Headers $uploadHeaders -Uri $uploadUrl -Method Post -InFile $asset.FullName -ContentType 'application/octet-stream'
        Write-Output "  uploaded id=$($resp.id) state=$($resp.state)"
    } catch {
        Write-Output "  upload failed: $($_.Exception.Message)"
    }
}

# Final state
Start-Sleep 2
$rels2 = Invoke-RestMethod -Headers $headers -Uri "$api/releases" -Method Get
$rel2 = $rels2 | Where-Object { $_.tag_name -eq 'v1.0.0' } | Select-Object -First 1
Write-Output '=== final assets ==='
foreach ($a in $rel2.assets) {
    Write-Output ("  " + $a.name + "  " + [math]::Round($a.size/1MB) + " MB  state=" + $a.state)
}
Write-Output ("release url: " + $rel2.html_url)
