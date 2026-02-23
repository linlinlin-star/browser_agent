@echo off
echo ========================================
echo   Browser Agent Chrome Extension
echo ========================================
echo.
echo 请按照以下步骤加载插件:
echo.
echo 1. 打开Chrome浏览器
echo 2. 在地址栏输入: chrome://extensions/
echo 3. 打开右上角的 "开发者模式" 开关
echo 4. 点击 "加载已解压的扩展程序"
echo 5. 选择文件夹:
echo    %~dp0chrome-extension
echo.
echo ========================================
echo.
echo 正在打开Chrome扩展管理页面...
start chrome://extensions/
echo.
pause
