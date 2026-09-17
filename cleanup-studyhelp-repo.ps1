# ============================================
# studyhelp-astro Production Repo Cleanup
# Archives old backups/dumps, checks git status
# before touching anything build-related.
# Run FROM the repo folder:
# D:\Wesbites\studyhelp-astro\studyhelp
# ============================================

$repo = "D:\Wesbites\studyhelp-astro\studyhelp"
$archive = "D:\Wesbites\studyhelp-astro\studyhelp-backups"

Set-Location $repo

# --- Step 1: Check git status first ---
Write-Host "`n=== Checking git status ===" -ForegroundColor Cyan
$gitStatus = git status --porcelain 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "This folder is not a git repo, or git isn't available. Stopping - verify manually." -ForegroundColor Red
    exit
}

if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "Git status is CLEAN - no uncommitted changes." -ForegroundColor Green
} else {
    Write-Host "Git status has UNCOMMITTED CHANGES:" -ForegroundColor Yellow
    Write-Host $gitStatus
    Write-Host "`nReview these before proceeding. Archiving files is still safe (non-destructive)," -ForegroundColor Yellow
    Write-Host "but do NOT delete .astro/.wrangler/dist/node_modules until you've committed or confirmed these changes." -ForegroundColor Yellow
}

# --- Step 2: Create archive folder ---
if (-not (Test-Path $archive)) {
    New-Item -ItemType Directory -Path $archive | Out-Null
    Write-Host "`nCreated archive folder: $archive" -ForegroundColor Green
}

# --- Step 3: Move backup/dump files to archive (non-destructive, easy to restore) ---
$archiveList = @(
    "studyhelp-db-backup.sql",
    "current-schema-dump.txt",
    "schema_check.json",
    "backup-slugs.txt",
    "live-slugs.txt",
    "import-chapter-content.sql"
)

Write-Host "`n=== Archiving backup/dump files ===" -ForegroundColor Cyan
foreach ($item in $archiveList) {
    $src = Join-Path $repo $item
    $dest = Join-Path $archive $item
    if (Test-Path $src) {
        Move-Item -Path $src -Destination $dest -Force
        Write-Host "Archived: $item" -ForegroundColor Cyan
    } else {
        Write-Host "Not found (skipped): $item" -ForegroundColor Yellow
    }
}

# --- Step 4: Report on build folders (does NOT delete automatically) ---
Write-Host "`n=== Build folders (NOT deleted - review below) ===" -ForegroundColor Cyan
$buildFolders = @(".astro", ".wrangler", "dist", "node_modules")
foreach ($bf in $buildFolders) {
    $path = Join-Path $repo $bf
    if (Test-Path $path) {
        $size = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host ("{0,-15} exists  ~{1:N1} MB" -f $bf, $size) -ForegroundColor White
    }
}

Write-Host "`n--- NEXT STEPS ---" -ForegroundColor Green
Write-Host "1. Confirm your live site still works (open it in browser, test a page/checkout)."
Write-Host "2. If git status was CLEAN and site works fine, you can safely delete build folders:"
Write-Host '   Remove-Item ".astro",".wrangler","dist" -Recurse -Force'
Write-Host "   (node_modules only if you will run 'npm install' before next build/deploy)"
Write-Host "3. Archived backup files are now in: $archive"
Write-Host "   Move that folder to E:\Reference later if you want it off D: entirely."
