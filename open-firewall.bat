@echo off
setlocal
chcp 65001 >nul

rem Opens the ports the phone/tablet needs to reach this computer.
rem Must be run as administrator.
rem Usage: open-firewall.bat          (interactive)
rem        open-firewall.bat quiet    (no pause, used by install.bat)

net session >nul 2>nul
if errorlevel 1 (
  echo This script must be run as administrator.
  echo Right-click open-firewall.bat and choose "Run as administrator".
  if not "%~1"=="quiet" pause
  exit /b 1
)

echo Adding firewall rules for ports 3000, 3001, 3443 and 3444...

netsh advfirewall firewall delete rule name="Clothes Web 3000" >nul 2>nul
netsh advfirewall firewall delete rule name="Clothes API 3001" >nul 2>nul
netsh advfirewall firewall delete rule name="Clothes Web HTTPS 3443" >nul 2>nul
netsh advfirewall firewall delete rule name="Clothes API HTTPS 3444" >nul 2>nul
netsh advfirewall firewall delete rule name="Clothes HTTPS 3443" >nul 2>nul

netsh advfirewall firewall add rule name="Clothes Web 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul
netsh advfirewall firewall add rule name="Clothes API 3001" dir=in action=allow protocol=TCP localport=3001 profile=private,domain >nul
netsh advfirewall firewall add rule name="Clothes Web HTTPS 3443" dir=in action=allow protocol=TCP localport=3443 profile=private,domain >nul
netsh advfirewall firewall add rule name="Clothes API HTTPS 3444" dir=in action=allow protocol=TCP localport=3444 profile=private,domain >nul

echo   [ok] port 3000  (web,  http)
echo   [ok] port 3001  (api,  http)
echo   [ok] port 3443  (web,  https)
echo   [ok] port 3444  (api,  https)
echo.
echo Rules apply to private/domain networks only, not public Wi-Fi.
echo.
echo To remove them later:
echo   netsh advfirewall firewall delete rule name="Clothes Web 3000"
echo   netsh advfirewall firewall delete rule name="Clothes API 3001"
echo   netsh advfirewall firewall delete rule name="Clothes Web HTTPS 3443"
echo   netsh advfirewall firewall delete rule name="Clothes API HTTPS 3444"

if not "%~1"=="quiet" pause
endlocal
