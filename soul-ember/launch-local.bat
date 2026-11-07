@echo off
title VALIXIS GAMES - Local Arcade Launcher
echo ===================================================
echo   VALIXIS GAMES STUDIO - SOUL EMBER SURVIVORS
echo ===================================================
echo.
echo Launching Soul Ember in default browser...
start "" "%~dp0index.html"
echo.
echo Starting local web server at http://localhost:8080 ...
echo Press Ctrl+C in this window to stop the server.
echo.
python -m http.server 8080 --directory "%~dp0"
pause
