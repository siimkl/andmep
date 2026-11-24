param(
  [int]$Port = 8040
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$distPath = Join-Path $projectRoot 'dist'

Write-Host "Andmepädevuse praktikumid: http://127.0.0.1:$Port/"
python -m http.server $Port --bind 127.0.0.1 --directory $distPath
