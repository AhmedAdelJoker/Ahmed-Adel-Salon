$filePath = "src\pages\LandingPage.jsx"
$content = Get-Content -Path $filePath -Raw

$startMarker = "          {/* 3. services tab page */}"
$endMarker = "          {/* 4. team tab page */}"

$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker, $startIdx)

if ($startIdx -lt 0 -or $endIdx -lt 0) {
  Write-Host "ERROR: markers not found"
  exit 1
}

$newBlock = @"

          {/* 3. services tab page - World-class Services Explorer */}
          {activePage === "services" && (
            <motion.div
              key="services"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="py-12 sm:py-16 px-4 sm:px-6 min-h-[80vh]"
            >
              <div className="max-w-7xl mx-auto">
                <ServicesExplorer
                  services={services}
                  categories={displayCategories}
                  theme={theme}
                  currency={settings?.currency || "ج.م"}
                  onBookService={() => navigate(bookingPath)}
                />
              </div>
            </motion.div>
          )}

"@

$newContent = $content.Substring(0, $startIdx) + $newBlock + $content.Substring($endIdx)

$utf8NoBom = New-Object System.Text.UTF8Encoding $False
[System.IO.File]::WriteAllText($filePath, $newContent, $utf8NoBom)

Write-Host "Done. Old size: $($content.Length), New size: $($newContent.Length)"
