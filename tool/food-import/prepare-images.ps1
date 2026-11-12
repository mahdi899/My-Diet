param([string]$JobsFile, [string]$Destination)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$encoder = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$parameters = [Drawing.Imaging.EncoderParameters]::new(1)
$parameters.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]82)
$jobs = Get-Content -Raw -LiteralPath $JobsFile | ConvertFrom-Json
foreach ($job in $jobs) {
    $source = [Drawing.Image]::FromFile($job.input)
    $ratio = [math]::Min(1, 960 / [math]::Max($source.Width, $source.Height))
    $bitmap = [Drawing.Bitmap]::new([int]($source.Width * $ratio), [int]($source.Height * $ratio))
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($source, 0, 0, $bitmap.Width, $bitmap.Height)
    $bitmap.Save((Join-Path $Destination $job.output), $encoder, $parameters)
    $graphics.Dispose()
    $bitmap.Dispose()
    $source.Dispose()
}
$parameters.Dispose()
Write-Output "Prepared $($jobs.Count) catalog images"
