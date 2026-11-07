@echo off
cd /d "%~dp0"
call flutter pub get
if errorlevel 1 exit /b 1
call flutter run -t lib/main.dart
