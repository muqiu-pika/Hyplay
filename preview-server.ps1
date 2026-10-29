param(
    [string]$Root = "preview",
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$rootFull = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $Root))

if (-not (Test-Path -LiteralPath $rootFull)) {
    Write-Host "Preview folder not found: $rootFull"
    Read-Host "Press Enter to exit"
    exit 1
}

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".map"  = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"  = "font/ttf"
    ".txt"  = "text/plain; charset=utf-8"
    ".xml"  = "application/xml; charset=utf-8"
}

$listener = $null
$activePort = 0

for ($p = $Port; $p -lt ($Port + 20); $p++) {
    $candidate = $null
    try {
        $candidate = New-Object System.Net.HttpListener
        $candidate.Prefixes.Add("http://localhost:$p/")
        $candidate.Start()
        $listener = $candidate
        $activePort = $p
        break
    }
    catch {
        if ($candidate) {
            try { $candidate.Close() } catch { }
        }
    }
}

if (-not $listener) {
    Write-Host "Could not start the preview server. Please close other programs using ports $Port-$($Port + 19)."
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "  Hyplay preview is running"
Write-Host "  URL   : http://localhost:$activePort/"
Write-Host "  Folder: $rootFull"
Write-Host "  Close this window to stop."
Write-Host ""

if (-not $NoBrowser) {
    Start-Process ("http://localhost:" + $activePort + "/")
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
        $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
        $relative = $urlPath.TrimStart("/")
        $localPath = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))

        if (-not $localPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
            $localPath = Join-Path $rootFull "__forbidden__"
        }

        if (Test-Path -LiteralPath $localPath -PathType Container) {
            $localPath = Join-Path $localPath "index.html"
        }

        if (Test-Path -LiteralPath $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $ext = [System.IO.Path]::GetExtension($localPath).ToLowerInvariant()
            if ($mime.ContainsKey($ext)) {
                $response.ContentType = $mime[$ext]
            }
            else {
                $response.ContentType = "application/octet-stream"
            }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        else {
            $response.StatusCode = 404
            $notFound = Join-Path $rootFull "404.html"
            if (Test-Path -LiteralPath $notFound -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($notFound)
                $response.ContentType = "text/html; charset=utf-8"
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            else {
                $text = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.ContentType = "text/plain; charset=utf-8"
                $response.ContentLength64 = $text.Length
                $response.OutputStream.Write($text, 0, $text.Length)
            }
        }
    }
    catch {
        try {
            $response.StatusCode = 500
            $text = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $text.Length
            $response.OutputStream.Write($text, 0, $text.Length)
        }
        catch { }
    }
    finally {
        try { $response.OutputStream.Close() } catch { }
        try { $response.Close() } catch { }
    }
}
