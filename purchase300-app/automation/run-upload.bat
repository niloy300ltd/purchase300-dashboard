@echo off
cd /d "%~dp0"
echo Running Purchase300 auto-upload... >> upload-log.txt
node upload-to-dashboard.js >> upload-log.txt 2>&1
echo. >> upload-log.txt
