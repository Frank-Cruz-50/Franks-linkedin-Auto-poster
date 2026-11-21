@echo off
REM Windows: Task Scheduler runs this at log on. Edit the folder path below.
cd /d "C:\path\to\Franks-linkedin-Auto-poster"
npm run cron >> cron.log 2>&1
