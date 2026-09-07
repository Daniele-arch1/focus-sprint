$port = 8791
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\focus-sprint")).Path

$mime = @{
  ".html" = "text/html"
  ".css"  = "text/css"
  ".js"   = "application/javascript"
  ".json" = "application/json"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Host "Serving $root on http://localhost:$port/"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $requestLine = $reader.ReadLine()
    while (($headerLine = $reader.ReadLine()) -and $headerLine -ne "") {}

    $status = 200
    $body = [byte[]]@()
    $contentType = "text/plain"

    if ($requestLine -match '^GET\s+(\S+)\s+HTTP') {
      $urlPath = $matches[1].Split('?')[0]
      if ($urlPath -eq "/") { $urlPath = "/index.html" }
      $decoded = [System.Uri]::UnescapeDataString($urlPath).TrimStart("/")
      $filePath = Join-Path $root $decoded
      $fullPath = [System.IO.Path]::GetFullPath($filePath)

      if ($fullPath.StartsWith($root) -and (Test-Path $fullPath -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($fullPath)
        $contentType = $mime[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }
        $body = [System.IO.File]::ReadAllBytes($fullPath)
      } else {
        $status = 404
        $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      }
    } else {
      $status = 400
      $body = [System.Text.Encoding]::UTF8.GetBytes("400 Bad Request")
    }

    $statusText = if ($status -eq 200) { "OK" } elseif ($status -eq 404) { "Not Found" } else { "Bad Request" }
    $headerText = "HTTP/1.1 $status $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
  } catch {
  } finally {
    $client.Close()
  }
}
