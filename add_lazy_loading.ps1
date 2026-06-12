$files = Get-ChildItem -Path . -Filter *.html | Where-Object { $_.Name -ne 'admin.html' }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Replace <img src="..." alt="..."> with <img src="..." alt="..." loading="lazy">
    # Note: We need to be careful not to add it twice.
    # We will use regex to find img tags without loading="lazy"
    $content = [System.Text.RegularExpressions.Regex]::Replace($content, '(<img\b(?!.*loading=)[^>]+)>', '$1 loading="lazy">')
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "Updated $($file.Name)"
}
