@echo off
REM Build the Umbry loopback capturer.
REM Run from a Visual Studio "x64 Native Tools Command Prompt for VS" so cl.exe
REM and the Windows SDK are on PATH. Requires the C++ workload + Windows SDK
REM 10.0.20348 or newer (for audioclientactivationparams.h / process loopback).
cl /nologo /std:c++17 /EHsc /O2 /DUNICODE /D_UNICODE loopback.cpp /Fe:loopback.exe /link ole32.lib mmdevapi.lib
if %errorlevel%==0 (echo. & echo Built loopback.exe) else (echo. & echo BUILD FAILED)
