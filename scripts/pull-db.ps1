# pull-db.ps1
# Script para extraer y visualizar la BBDD SQLite de Moto Routes desde Android
# Uso: .\scripts\pull-db.ps1
# Requisitos: adb, sqlite3 (sqlite.org/download.html)

$ErrorActionPreference = "Stop"
$packageName = "com.motoroutes.app"
$localCopy = "moto-routes-export.db"

function Write-Title {
    param([string]$Text, [string]$Color = "Cyan")
    Write-Host "`n========================================" -ForegroundColor $Color
    Write-Host "  $Text" -ForegroundColor $Color
    Write-Host "========================================" -ForegroundColor $Color
}

Write-Title "Moto Routes - Pull Database"

# 1. Verificar adb y dispositivo
Write-Host "`nVerificando dispositivo..." -ForegroundColor Yellow
$devices = adb devices | Where-Object { $_ -match "device$" }
if (-not $devices) {
    Write-Host "  ERROR: No hay dispositivos Android conectados." -ForegroundColor Red
    exit 1
}
Write-Host "  Dispositivo encontrado" -ForegroundColor Green

# 2. Buscar la BBDD en todas las ubicaciones posibles
Write-Host "`nBuscando BBDD en el dispositivo..." -ForegroundColor Yellow

# Primero buscar con find para localizar cualquier .db
$rawDbs = adb shell "run-as $packageName find /data/data/$packageName -name '*.db' -o -name '*.sqlite' 2>/dev/null" 2>$null
$dbList = @($rawDbs -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 })

$foundDb = $null
if ($dbList.Count -gt 0) {
    $foundDb = $dbList[0]
    Write-Host "  BBDD encontrada: $foundDb" -ForegroundColor Green
}

if (-not $foundDb) {
    Write-Host "  La BBDD todavia no existe en el dispositivo." -ForegroundColor Yellow
    Write-Host "  Motivo: aun no se ha guardado ninguna ruta desde la app." -ForegroundColor Yellow
    exit 0
}

# 3. Extraer la BBDD
Write-Host "`nExtrayendo BBDD del dispositivo..." -ForegroundColor Yellow
$dbFile = $foundDb.Split('/')[-1]
adb exec-out run-as $packageName cat "$dbFile" > $localCopy
$size = (Get-Item $localCopy -ErrorAction SilentlyContinue).Length
if (-not $size) { $size = 0 }
$msg = "  BBDD extraida: $localCopy ($($size) bytes)"
Write-Host $msg -ForegroundColor Green

# 4. Verificar integridad
$header = Get-Content $localCopy -Encoding Byte -TotalCount 16
$isSqlite = ($header[0] -eq 0x53 -and $header[1] -eq 0x51 -and $header[2] -eq 0x4C)
if (-not $isSqlite) {
    Write-Host "  ERROR: Archivo extraido no es una BBDD SQLite valida." -ForegroundColor Red
    Remove-Item $localCopy -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  BBDD SQLite verificada correctamente" -ForegroundColor Green

# 5. Verificar sqlite3
$sqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue
if (-not $sqlite3) {
    Write-Host "`n  sqlite3 no encontrado. Los datos estan en: $localCopy" -ForegroundColor Yellow
    Write-Host "  Abrelo con DB Browser for SQLite" -ForegroundColor Yellow
    exit 0
}

# 6. Mostrar datos
Write-Title "TABLAS ENCONTRADAS"
$tables = sqlite3 $localCopy ".tables"
Write-Host "  $tables" -ForegroundColor White

Write-Title "TABLA: routes"
sqlite3 -header -column $localCopy "SELECT id, substr(created_at,1,19) AS created, ROUND(duration,1) AS dur_seg, ROUND(total_distance,1) AS dist_m, ROUND(avg_speed,1) AS vel_kmh, status, visibility, origin FROM routes;"

Write-Title "TABLA: route_points (resumen)"
$pointCount = sqlite3 -header -column $localCopy "SELECT COUNT(*) AS total_puntos, COUNT(DISTINCT route_id) AS rutas FROM route_points;"
Write-Host "  $pointCount" -ForegroundColor White

Write-Title "TABLA: route_stops (resumen)"
$stopCount = sqlite3 -header -column $localCopy "SELECT COUNT(*) AS total_paradas, COUNT(DISTINCT route_id) AS rutas FROM route_stops;"
Write-Host "  $stopCount" -ForegroundColor White

# 7. Exportar datos completos
Write-Title "DATOS COMPLETOS EN FORMATO SQL"

Write-Host "`n-- SCHEMA COMPLETO --" -ForegroundColor Gray
sqlite3 $localCopy ".schema"

$tableList = $tables.Trim() -split "\s+"
foreach ($table in $tableList) {
    if ($table.Length -gt 0) {
        Write-Host "`n-- DATOS: $table --" -ForegroundColor Gray
        sqlite3 -header -column $localCopy "SELECT * FROM $table;"
    }
}

Write-Title "Exportado" "Green"
Write-Host "  Archivo: $localCopy" -ForegroundColor Green
Write-Host "  Abrelo con: sqlite3 $localCopy" -ForegroundColor Green
Write-Host "  O con: DB Browser for SQLite" -ForegroundColor Green