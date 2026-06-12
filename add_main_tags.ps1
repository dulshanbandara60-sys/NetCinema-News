$files = Get-ChildItem -Path . -Filter *.html | Where-Object { $_.Name -notin 'admin.html', 'index.html', 'article.html' }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    if ($content -match '<main>') {
        Write-Host "Skipping $($file.Name)"
        continue
    }

    $content = $content -replace '</header>', "</header>`n    <main>"
    
    if ($content -match '<!-- Footer Section -->\r?\n\s*<footer') {
        $content = $content -replace '<!-- Footer Section -->\r?\n\s*<footer', "</main>`n`n    <!-- Footer Section -->`n    <footer"
    } elseif ($content -match '<footer class="site-footer">') {
        $content = $content -replace '<footer class="site-footer">', "</main>`n`n    <footer class=""site-footer"">"
    }
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "Updated $($file.Name)"
}
