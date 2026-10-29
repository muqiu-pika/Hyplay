@echo off
cd /d "%~dp0"
title Hyplay Preview
powershell -NoProfile -ExecutionPolicy Bypass -File "preview-server.ps1" -Root "preview" -Port 8080
if errorlevel 1 pause
