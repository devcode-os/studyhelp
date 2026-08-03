@echo off
REM sync-content.bat
REM Run this ONE command any time you add, edit, or delete chapters/questions/subjects,
REM BEFORE your usual git add / commit / push.
REM
REM What it does:
REM   1. Reads every JSON file under src\data\ (all subjects, all chapters)
REM   2. Regenerates the full answer set for each chapter
REM   3. Pushes that data into the live D1 database (chapter_content table)
REM
REM After this finishes successfully, do your normal:
REM   git add .
REM   git commit -m "..."
REM   git push

echo.
echo === Step 1/2: Reading chapter files and generating SQL ===
node generate-chapter-content-sql.cjs > import-chapter-content.sql

if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Could not generate SQL from chapter files. Nothing was uploaded.
    echo Check the error above, fix it, and run sync-content.bat again.
    exit /b 1
)

echo.
echo === Step 2/2: Uploading to live database ===
wrangler d1 execute studyhelp-db --remote --file=import-chapter-content.sql

if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Upload to D1 did not complete. Your live site still has the
    echo OLD answers until this succeeds. Run sync-content.bat again.
    exit /b 1
)

echo.
echo === DONE ===
echo Chapter content is now live. You can safely git add / commit / push.
echo.
