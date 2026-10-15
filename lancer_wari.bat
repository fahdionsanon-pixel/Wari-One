@echo off
title Lancement de Wari App & Backend
echo ===================================================
echo        DEMARRAGE AUTOMATIQUE DE WARI ONE
echo ===================================================
echo.
echo [1/2] Lancement du serveur Backend (Port 3000)...
start "Wari - Backend (Port 3000)" cmd /k "cd /d %~dp0paiement-backend && node server.js"

timeout /t 2 /nobreak > nul

echo [2/2] Lancement de l'application Ionic Frontend...
start "Wari - Frontend Ionic" cmd /k "cd /d %~dp0paiement-app && npx ionic serve --port 8101"

echo.
echo ===================================================
echo   Deux fenetres ont ete ouvertes :
echo   - La fenetre du Backend (port 3000)
echo   - La fenetre du Frontend (Ionic)
echo.
echo   L'application s'ouvrira dans votre navigateur.
echo ===================================================
pause
