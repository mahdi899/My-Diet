param([string]$ImageDirectory, [string]$OutputDirectory)
Add-Type -AssemblyName System.Drawing
$images = @(Get-ChildItem -LiteralPath $ImageDirectory -File | Sort-Object Name)
$font = [Drawing.Font]::new('Arial', 11)
for ($page = 0; $page * 25 -lt $images.Count; $page++) {
    $bitmap = [Drawing.Bitmap]::new(1100, 1250)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([Drawing.Color]::White)
    for ($slot = 0; $slot -lt 25; $slot++) {
        $index = $page * 25 + $slot
        if ($index -ge $images.Count) { break }
        $file = $images[$index]
        $photo = [Drawing.Image]::FromFile($file.FullName)
        $x = ($slot % 5) * 220
        $y = [math]::Floor($slot / 5) * 250
        $ratio = [math]::Min(210 / $photo.Width, 210 / $photo.Height)
        $graphics.DrawImage($photo, [int]($x + 5), [int]$y, [int]($photo.Width * $ratio), [int]($photo.Height * $ratio))
        $label = $file.BaseName.Substring([math]::Max(0, $file.BaseName.Length - 8))
        $graphics.DrawString("$index - $label", $font, [Drawing.Brushes]::Black, [float]($x + 5), [float]($y + 212))
        $photo.Dispose()
    }
    $bitmap.Save((Join-Path $OutputDirectory "contact-$page.jpg"), [Drawing.Imaging.ImageFormat]::Jpeg)
    $graphics.Dispose()
    $bitmap.Dispose()
}
$font.Dispose()
