@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ===========================================================
rem  Give this computer a fixed IP address on the local network.
rem
rem  Why: the phone bookmarks http://<ip>:3000, and the HTTPS
rem  certificate is bound to that IP. If the router hands out a
rem  different address later, both stop working.
rem
rem  Must be run as administrator.
rem  Usage: set-static-ip.bat          set a static address
rem         set-static-ip.bat revert   go back to automatic (DHCP)
rem ===========================================================

net session >nul 2>nul
if errorlevel 1 (
  echo This script must be run as administrator.
  echo Right-click set-static-ip.bat and choose "Run as administrator".
  pause
  exit /b 1
)

echo ============================================
echo   Network adapters on this computer
echo ============================================
echo.
netsh interface ipv4 show interfaces
echo.
echo Pick the adapter you use for the shop network.
echo   "Wi-Fi"     = wireless
echo   "Ethernet"  = network cable
echo.
set "ADAPTER="
set /p ADAPTER=Adapter name (copy it exactly from the list above):
if "%ADAPTER%"=="" (
  echo No adapter entered, nothing changed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Current settings of "%ADAPTER%"
echo ============================================
echo.
netsh interface ipv4 show config name="%ADAPTER%"
if errorlevel 1 (
  echo.
  echo Adapter "%ADAPTER%" not found. Check the spelling and try again.
  pause
  exit /b 1
)

if /i "%~1"=="revert" goto :revert

echo.
echo ============================================
echo   New fixed address
echo ============================================
echo.
echo IMPORTANT: pick an address that is
echo   - in the same range as the current one (e.g. 192.168.1.x)
echo   - OUTSIDE the router's automatic range, or reserved in the router
echo     (a high number such as .200 is usually safe)
echo   - not already used by another device
echo.

set "NEW_IP="
set /p NEW_IP=  Fixed IP address (e.g. 192.168.1.200):
if "%NEW_IP%"=="" goto :cancelled

set "MASK=255.255.255.0"
set /p MASK=  Subnet mask [255.255.255.0]:
if "%MASK%"=="" set "MASK=255.255.255.0"

set "GATEWAY="
set /p GATEWAY=  Gateway (your router, e.g. 192.168.1.1):
if "%GATEWAY%"=="" goto :cancelled

set "DNS1=%GATEWAY%"
set /p DNS1=  Primary DNS [%GATEWAY%]:
if "%DNS1%"=="" set "DNS1=%GATEWAY%"

set "DNS2=223.5.5.5"
set /p DNS2=  Secondary DNS [223.5.5.5]:
if "%DNS2%"=="" set "DNS2=223.5.5.5"

echo.
echo ============================================
echo   Confirm
echo ============================================
echo   Adapter : %ADAPTER%
echo   IP      : %NEW_IP%
echo   Mask    : %MASK%
echo   Gateway : %GATEWAY%
echo   DNS     : %DNS1% , %DNS2%
echo.
echo The network will drop for a few seconds while this is applied.
echo If you are connected remotely, you may lose the connection.
echo.
set "CONFIRM="
set /p CONFIRM=Type YES to apply:
if /i not "%CONFIRM%"=="YES" goto :cancelled

echo.
echo Applying...
netsh interface ipv4 set address name="%ADAPTER%" static %NEW_IP% %MASK% %GATEWAY%
if errorlevel 1 goto :failed
netsh interface ipv4 set dns name="%ADAPTER%" static %DNS1% primary
if errorlevel 1 goto :failed
netsh interface ipv4 add dns name="%ADAPTER%" %DNS2% index=2 >nul 2>nul

echo.
echo ============================================
echo   New settings
echo ============================================
echo.
netsh interface ipv4 show config name="%ADAPTER%"

echo.
echo Testing the connection to the router...
ping -n 2 %GATEWAY% >nul
if errorlevel 1 (
  echo   [WARNING] Cannot reach the gateway %GATEWAY%.
  echo   The address may be wrong or already in use.
  echo   Run "set-static-ip.bat revert" to go back to automatic.
) else (
  echo   [ok] Router reachable.
)

echo.
echo Done. From now on open the system on your phone at:
echo   http://%NEW_IP%:3000
echo.
echo To undo this later: set-static-ip.bat revert
pause
goto :eof

:revert
echo.
echo This will set "%ADAPTER%" back to automatic (DHCP).
set "CONFIRM="
set /p CONFIRM=Type YES to continue:
if /i not "%CONFIRM%"=="YES" goto :cancelled
netsh interface ipv4 set address name="%ADAPTER%" source=dhcp
netsh interface ipv4 set dns name="%ADAPTER%" source=dhcp
echo.
netsh interface ipv4 show config name="%ADAPTER%"
echo.
echo Back to automatic.
pause
goto :eof

:cancelled
echo.
echo Cancelled, nothing was changed.
pause
exit /b 1

:failed
echo.
echo Failed to apply the settings. Nothing may have changed, or only part of it.
echo Run "set-static-ip.bat revert" to go back to automatic.
pause
exit /b 1
