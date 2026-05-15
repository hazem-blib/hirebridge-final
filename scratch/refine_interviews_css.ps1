$filePath = 'c:\Users\LOQ\Desktop\hirebridge-employer-review-page-fixed\src\app\features\employer\interviews\interviews.component.css'
$content = Get-Content $filePath

$newStyles = @(
    '/* --- Refined Intelligence Toolbar --- */',
    '.review-intelligence-toolbar {',
    '  display: flex;',
    '  align-items: flex-end;',
    '  justify-content: space-between;',
    '  padding: 0 0 16px 0;',
    '  border-bottom: 1px solid #f1f5f9;',
    '  margin-bottom: 24px;',
    '  background: transparent;',
    '  box-shadow: none;',
    '}',
    '',
    '.toolbar-left { display: flex; align-items: flex-end; gap: 32px; }',
    '.toolbar-title h2 { font-size: 1.45rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.02em; }',
    '.toolbar-title p { font-size: 0.82rem; color: #64748b; margin: 6px 0 0; font-weight: 500; }',
    '',
    '.hub-search-modern { position: relative; width: 240px; margin-bottom: 4px; }',
    '.hub-search-modern i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.85rem; }',
    '.hub-search-modern input { width: 100%; height: 38px; padding: 0 16px 0 38px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.8rem; color: #1e293b; transition: all 0.3s; }',
    '.hub-search-modern input:focus { background: white; border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); outline: none; }',
    '',
    '.tab-list-premium { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; gap: 2px; }',
    '.tab-item-premium { padding: 6px 14px; border-radius: 10px; font-size: 0.78rem; font-weight: 700; color: #64748b; border: none; background: transparent; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 8px; }',
    '.tab-item-premium.active { background: white; color: #2563eb; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.08); }',
    '.tab-count { padding: 1px 6px; background: #e2e8f0; border-radius: 6px; font-size: 0.68rem; font-weight: 700; color: #64748b; transition: all 0.3s ease; }',
    '.tab-item-premium.active .tab-count { background: #eff6ff; color: #2563eb; }',
    '.tab-item-premium:hover:not(.active) { color: #2563eb; background: rgba(37, 99, 235, 0.03); }'
)

# Find where the old toolbar styles started.
$startIndex = -1
for ($i = 0; $i -lt $content.Length; $i++) {
    if ($content[$i] -like '*Modern Toolbar & Search*') {
        $startIndex = $i
        break
    }
}

if ($startIndex -ne -1) {
    # Find the end of that block (usually before Dark Mode Overrides)
    $endIndex = -1
    for ($i = $startIndex; $i -lt $content.Length; $i++) {
        if ($content[$i] -like '*Dark Mode Overrides*') {
            $endIndex = $i - 1
            break
        }
    }
    
    if ($endIndex -eq -1) { $endIndex = $startIndex + 60 } # fallback

    $before = $content[0..($startIndex-1)]
    $after = $content[($endIndex+1)..($content.Length - 1)]
    $finalContent = $before + $newStyles + $after
    $finalContent | Set-Content $filePath
}
