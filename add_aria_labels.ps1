$files = Get-ChildItem -Path . -Filter *.html | Where-Object { $_.Name -ne 'admin.html' }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Replace social links with aria labels
    $content = $content -replace '<a href="#" class="social-link"><svg class="social-icon" viewBox="0 0 24 24"><path d="M22.675', '<a href="#" class="social-link" aria-label="Facebook"><svg class="social-icon" viewBox="0 0 24 24"><path d="M22.675'
    $content = $content -replace '<a href="#" class="social-link"><svg class="social-icon" viewBox="0 0 24 24"><path d="M24 4.557', '<a href="#" class="social-link" aria-label="Twitter"><svg class="social-icon" viewBox="0 0 24 24"><path d="M24 4.557'
    $content = $content -replace '<a href="#" class="social-link"><svg class="social-icon" viewBox="0 0 24 24"><path d="M12 0A12', '<a href="#" class="social-link" aria-label="Social Media"><svg class="social-icon" viewBox="0 0 24 24"><path d="M12 0A12'
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "Updated $($file.Name)"
}
