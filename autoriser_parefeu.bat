@echo off
echo Configuration du pare-feu Windows pour Wari...
netsh advfirewall firewall add rule name="Wari Backend Port 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="NodeJS Autoriser Tout" program="C:\Program Files\nodejs\node.exe" dir=in action=allow
echo.
echo ===============================================================
echo [SUCCES] Le port 3000 et Node.js sont maintenant autorises !
echo Vous pouvez tester l'acces depuis votre telephone maintenant.
echo ===============================================================
pause
