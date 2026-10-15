@echo off
title Wari One - Serveur & Tunnel Cloudflare
color 0A
echo ===================================================
echo       LANCEMENT DU BACKEND ET DU TUNNEL WARI
echo ===================================================
echo.

cd /d "%~dp0paiement-backend"

echo [1/2] Demarrage du serveur Node.js sur le port 3000...
start "Wari Backend (Node.js)" cmd /k "node server.js"

timeout /t 2 >nul

echo [2/2] Demarrage du Tunnel Cloudflare HTTPS...
start "Cloudflare Tunnel" cmd /k ""%~dp0tools\cloudflared.exe" tunnel --url http://localhost:3000"

echo.
echo ===================================================
echo   Le serveur et le tunnel sont maintenant actifs !
echo   Vous pouvez utiliser l'application mobile partout.
echo ===================================================
timeout /t 5 >nul
