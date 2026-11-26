Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot ""
$sizes = @(512, 192, 180)

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 20, 26))
    $g.FillRectangle($bg, 0, 0, $s, $s)

    $stroke = [int]([math]::Round($s * 0.055))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 106, 166, 160)), $stroke
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $x = [int]($s * 0.14)
    $y = [int]($s * 0.33)
    $w = [int]($s * 0.62)
    $h = [int]($s * 0.34)
    $g.DrawRectangle($pen, $x, $y, $w, $h)

    $nubW = [int]($s * 0.055)
    $nubH = [int]($s * 0.13)
    $nub = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 106, 166, 160))
    $g.FillRectangle($nub, ($x + $w + 2), ($y + [int](($h - $nubH) / 2)), $nubW, $nubH)

    $pad = [int]($s * 0.045)
    $fillW = [int](($w - 2 * $pad) * 0.24)
    $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 63, 109, 143))
    $g.FillRectangle($fill, ($x + $pad), ($y + $pad), $fillW, ($h - 2 * $pad))

    $g.Dispose()
    $path = Join-Path $out ("icon-" + $s + ".png")
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("wrote " + $path)
}
