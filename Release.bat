@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ══════════════════════════════════════════════════
echo       🐧 PenguinMagic 一鍵釋出工具
echo ══════════════════════════════════════════════════
echo.

:: 獲取當前版本號
for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" package.json') do (
    set "current_version=%%~a"
)
echo 📌 當前版本: %current_version%
echo.

:: 詢問是否更新版本號
set /p update_ver="是否更新版本號 (+0.0.1)? [Y/n]: "
if /i "%update_ver%"=="" set update_ver=Y
if /i "%update_ver%"=="Y" (
    echo.
    echo 📝 正在更新版本號...
    node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));const v=p.version.split('.').map(Number);if(v[2]>=9){v[1]++;v[2]=0;}else{v[2]++;}p.version=v.join('.');fs.writeFileSync('package.json',JSON.stringify(p,null,2));console.log('✅ 版本號已更新: '+p.version);"
    if errorlevel 1 (
        echo ❌ 版本號更新失敗
        pause
        exit /b 1
    )
    echo.
)

:: 執行打包
echo ══════════════════════════════════════════════════
echo 📦 開始打包...
echo ══════════════════════════════════════════════════
echo.
call npm run package
if errorlevel 1 (
    echo.
    echo ❌ 打包失敗！
    pause
    exit /b 1
)

echo.
echo ══════════════════════════════════════════════════
echo 📤 開始上傳...
echo ══════════════════════════════════════════════════
echo.
call npm run upload
if errorlevel 1 (
    echo.
    echo ❌ 上傳失敗！
    pause
    exit /b 1
)

echo.
echo ══════════════════════════════════════════════════
echo 🎉 釋出完成！
echo ══════════════════════════════════════════════════
echo.
pause
