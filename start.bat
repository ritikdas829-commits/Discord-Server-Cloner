@echo off
chcp 65001 >nul
title Viqole Discord Server Cloner
cls

echo ===================================================
echo            Viqole Discord Server Cloner
echo                Gelistirici: viqole
echo ===================================================
echo.

:: Node.js kontrolu
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js sisteminizde bulunamadi!
    echo Lutfen Node.js kurun ve tekrar deneyin: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: node_modules kontrolu ve otomatik kurulum
if not exist "node_modules\" (
    echo [BILGI] Ilk calistirma algilandi. Paketler kuruluyor...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [HATA] Paket kurulumu sirasinda bir sorun olustu.
        pause
        exit /b 1
    )
    echo.
    echo [BASARILI] Paketler basariyla kuruldu!
    timeout /t 2 >nul
    cls
)

:: Programi baslat
node src/index.js

echo.
echo ===================================================
echo Program sonlandi. Pencereyi kapatmak icin bir tusa basin.
echo ===================================================
pause >nul
