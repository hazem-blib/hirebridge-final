$filePath = 'c:\Users\LOQ\Desktop\hirebridge-employer-review-page-fixed\src\app\features\employer\review-candidates\review-candidates-page.component.css'
$content = Get-Content $filePath

$newStyles = @(
    '/* --- Canvas Empty State --- */',
    '.empty-state-canvas {',
    '  padding: 80px 40px;',
    '  text-align: center;',
    '  border: 2px dashed #e2e8f0;',
    '  border-radius: 32px;',
    '  margin: 20px 0;',
    '  background: rgba(248, 250, 252, 0.5);',
    '  display: flex;',
    '  flex-direction: column;',
    '  align-items: center;',
    '  animation: fadeIn 0.6s ease-out both;',
    '}',
    '',
    '.empty-glow-box {',
    '  width: 64px;',
    '  height: 64px;',
    '  background: white;',
    '  border-radius: 20px;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  font-size: 1.5rem;',
    '  color: #cbd5e1;',
    '  margin-bottom: 24px;',
    '  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);',
    '}',
    '',
    '.empty-state-canvas h3 {',
    '  font-size: 1.25rem;',
    '  font-weight: 800;',
    '  color: #1e293b;',
    '  margin-bottom: 8px;',
    '  letter-spacing: -0.01em;',
    '}',
    '',
    '.empty-state-canvas p {',
    '  font-size: 0.9rem;',
    '  color: #64748b;',
    '  max-width: 320px;',
    '  line-height: 1.6;',
    '  margin: 0;',
    '}',
    '',
    ':host-context(body.dark) .empty-state-canvas {',
    '  border-color: #243352;',
    '  background: rgba(15, 23, 41, 0.3);',
    '}',
    ':host-context(body.dark) .empty-glow-box {',
    '  background: #1e293b;',
    '  color: #475569;',
    '}',
    ':host-context(body.dark) .empty-state-canvas h3 { color: #e2e8f0; }'
)

# Replace the empty-state-premium block.
$startIndex = -1
for ($i = 0; $i -lt $content.Length; $i++) {
    if ($content[$i] -like '*empty-state-premium {*') {
        $startIndex = $i
        break
    }
}

if ($startIndex -ne -1) {
    $endIndex = $startIndex + 5
    $before = $content[0..($startIndex-1)]
    $after = $content[($endIndex+1)..($content.Length - 1)]
    $finalContent = $before + $newStyles + $after
    $finalContent | Set-Content $filePath
}
