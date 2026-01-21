$files = Get-ChildItem "d:\Dropbox\0000google\87boss_banana\src\components\RunningHub\" -Filter *.tsx
foreach ($file in $files) {
    $content = Get-Content $file.FullName
    $content = $content -replace "'\.\./services/api'", "'../../services/runningHub/api'"
    $content = $content -replace "'\.\./services/appService'", "'../../services/runningHub/appService'"
    $content = $content -replace "'\.\./services/autoSaveService'", "'../../services/runningHub/autoSaveService'"
    $content = $content -replace "'\.\./stores/taskStore'", "'../../services/runningHub/taskStore'"
    $content = $content -replace "'\.\./types'", "'../../services/runningHub/types'"
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
}
