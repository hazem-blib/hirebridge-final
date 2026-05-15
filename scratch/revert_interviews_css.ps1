$filePath = 'c:\Users\LOQ\Desktop\hirebridge-employer-review-page-fixed\src\app\features\employer\interviews\interviews.component.css'
$content = Get-Content $filePath

# Find the point before I started adding unified overrides or toolbar styles.
$index = -1
for ($i = 0; $i -lt $content.Length; $i++) {
    if ($content[$i] -like '*Unified Executive Design Overrides (Interviews)*') {
        $index = $i
        break
    }
}

if ($index -ne -1) {
    $finalContent = $content[0..($index-1)]
    $finalContent | Set-Content $filePath
}
