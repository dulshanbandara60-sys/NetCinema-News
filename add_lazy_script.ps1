$file = 'script.js'
$content = Get-Content $file -Raw
$content = [System.Text.RegularExpressions.Regex]::Replace($content, '(<img\b(?!.*loading=)[^>]+)>', '$1 loading="lazy">')

# Wait, the hero image shouldn't be lazy loaded.
# In script.js line 173: <img src="${img}" alt="${heroArt.title}"> (this is the hero image).
# Let's remove lazy from it if it was added.
$content = $content -replace '<img src="\$\{img\}" alt="\$\{heroArt.title\}" loading="lazy">', '<img src="${img}" alt="${heroArt.title}">'
$content = $content -replace '<img src="\$\{hero.cover_image \|\| FALLBACK_IMAGE\}" alt="\$\{hero.title\}" loading="lazy">', '<img src="${hero.cover_image || FALLBACK_IMAGE}" alt="${hero.title}">'

Set-Content -Path $file -Value $content -NoNewline
Write-Host "Updated script.js"
