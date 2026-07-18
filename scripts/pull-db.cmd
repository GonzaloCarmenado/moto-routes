@echo off
setlocal enabledelayedexpansion

chcp 65001 >nul

echo ========================================
echo   Moto Routes - Pull Database
echo ========================================
echo.

echo Verificando dispositivo...
echo.
adb devices 2>nul | findstr "device$" >nul
if %errorlevel% neq 0 (
    echo   ERROR: No hay dispositivos Android conectados.
    exit /b 1
)
echo   Dispositivo encontrado
echo.

echo Buscando BBDD en el dispositivo...
echo.
set DB_NAME=moto-routes.db
set LOCAL_COPY=moto-routes-export.db

adb exec-out run-as com.motoroutes.app cat %DB_NAME% > %LOCAL_COPY% 2>nul

if not exist %LOCAL_COPY% (
    echo   La BBDD no existe aun.
    echo   Motivo: no se ha guardado ninguna ruta desde la app.
    exit /b 0
)

for %%F in (%LOCAL_COPY%) do set SIZE=%%~zF
if %SIZE% lss 100 (
    echo   Archivo demasiado pequeno (%SIZE% bytes), probablemente la BBDD no existe.
    del %LOCAL_COPY% 2>nul
    exit /b 0
)

echo   BBDD extraida: %LOCAL_COPY% (%SIZE% bytes)
echo.

echo Verificando integridad...
echo.
findstr /m "SQLite format 3" %LOCAL_COPY% >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Archivo no es una BBDD SQLite valida.
    del %LOCAL_COPY% 2>nul
    exit /b 1
)
echo   BBDD SQLite verificada correctamente
echo.

echo Verificando sqlite3...
echo.
where sqlite3 >nul 2>&1
if %errorlevel% neq 0 (
    echo   sqlite3 no encontrado.
    echo   Los datos estan en: %LOCAL_COPY%
    echo   Abrelo con DB Browser for SQLite
    exit /b 0
)

echo ========================================
echo   TABLAS ENCONTRADAS
echo ========================================
sqlite3 %LOCAL_COPY% ".tables"
echo.

echo ========================================
echo   TABLA: routes
echo ========================================
sqlite3 -header -column %LOCAL_COPY% "SELECT id, substr(created_at,1,19) AS created, ROUND(duration,1) AS dur_seg, ROUND(total_distance,1) AS dist_m, ROUND(avg_speed,1) AS vel_kmh, status, visibility, origin FROM routes;"
echo.

echo ========================================
echo   TABLA: route_points (resumen)
echo ========================================
sqlite3 -header -column %LOCAL_COPY% "SELECT COUNT(*) AS total_puntos, COUNT(DISTINCT route_id) AS rutas FROM route_points;"
echo.

echo ========================================
echo   TABLA: route_stops (resumen)
echo ========================================
sqlite3 -header -column %LOCAL_COPY% "SELECT COUNT(*) AS total_paradas, COUNT(DISTINCT route_id) AS rutas FROM route_stops;"
echo.

echo ========================================
echo   DATOS COMPLETOS EN FORMATO SQL
echo ========================================
echo.
echo -- SCHEMA COMPLETO --
sqlite3 %LOCAL_COPY% ".schema"

for /f "tokens=*" %%T in ('sqlite3 %LOCAL_COPY% ".tables"') do (
    echo.
    echo -- DATOS: %%T --
    sqlite3 -header -column %LOCAL_COPY% "SELECT * FROM '%%T';"
)

echo.
echo ========================================
echo   Exportado a: %LOCAL_COPY%
echo ========================================