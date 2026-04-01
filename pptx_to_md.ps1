param(
  [string]$InputDir = "."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipEntryText {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$EntryName
  )

  $entry = $Zip.GetEntry($EntryName)
  if (-not $entry) {
    return $null
  }

  $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Dispose()
  }
}

function Get-ZipXmlDocument {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$EntryName
  )

  $xmlText = Get-ZipEntryText -Zip $Zip -EntryName $EntryName
  if (-not $xmlText) {
    return $null
  }

  $doc = New-Object System.Xml.XmlDocument
  $doc.LoadXml($xmlText)
  return $doc
}

function New-NamespaceManager {
  param([System.Xml.XmlDocument]$Document)

  $ns = New-Object System.Xml.XmlNamespaceManager($Document.NameTable)
  [void]$ns.AddNamespace("p", "http://schemas.openxmlformats.org/presentationml/2006/main")
  [void]$ns.AddNamespace("a", "http://schemas.openxmlformats.org/drawingml/2006/main")
  [void]$ns.AddNamespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
  return ,$ns
}

function Resolve-ZipPath {
  param(
    [string]$BasePath,
    [string]$Target
  )

  if ([string]::IsNullOrWhiteSpace($Target)) {
    return $null
  }

  if ($Target -match "^[A-Za-z]+:") {
    return $Target
  }

  $baseUri = [System.Uri]::new("https://package/" + $BasePath)
  $resolvedUri = [System.Uri]::new($baseUri, $Target)
  return [System.Uri]::UnescapeDataString($resolvedUri.AbsolutePath.TrimStart("/"))
}

function Get-RelationshipMap {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$RelsPath
  )

  $doc = Get-ZipXmlDocument -Zip $Zip -EntryName $RelsPath
  if (-not $doc) {
    return @{}
  }

  $map = @{}
  foreach ($rel in $doc.DocumentElement.ChildNodes) {
    if ($rel.NodeType -ne [System.Xml.XmlNodeType]::Element) {
      continue
    }

    $id = $rel.GetAttribute("Id")
    if (-not $id) {
      continue
    }

    $map[$id] = @{
      Type = $rel.GetAttribute("Type")
      Target = $rel.GetAttribute("Target")
      TargetMode = $rel.GetAttribute("TargetMode")
    }
  }

  return $map
}

function Get-SlideEntries {
  param([System.IO.Compression.ZipArchive]$Zip)

  [System.Xml.XmlDocument]$presentationDoc = Get-ZipXmlDocument -Zip $Zip -EntryName "ppt/presentation.xml"
  if (-not $presentationDoc) {
    return @()
  }

  [System.Xml.XmlNamespaceManager]$ns = New-NamespaceManager -Document $presentationDoc
  $presentationRels = Get-RelationshipMap -Zip $Zip -RelsPath "ppt/_rels/presentation.xml.rels"
  $slideIds = $presentationDoc.SelectNodes("/p:presentation/p:sldIdLst/p:sldId", $ns)

  $entries = @()
  foreach ($slideId in $slideIds) {
    $relId = $slideId.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    if (-not $presentationRels.ContainsKey($relId)) {
      continue
    }

    $slidePath = Resolve-ZipPath -BasePath "ppt/presentation.xml" -Target $presentationRels[$relId].Target
    $entries += $slidePath
  }

  return $entries
}

function Get-ParagraphText {
  param([System.Xml.XmlNode]$Paragraph)

  $texts = @()
  foreach ($node in $Paragraph.ChildNodes) {
    switch ($node.LocalName) {
      "r" {
        foreach ($textNode in $node.SelectNodes("./a:t", $script:Ns)) {
          $texts += $textNode.InnerText
        }
      }
      "fld" {
        foreach ($textNode in $node.SelectNodes("./a:t", $script:Ns)) {
          $texts += $textNode.InnerText
        }
      }
      "br" {
        $texts += "`n"
      }
      default { }
    }
  }

  $joined = ($texts -join "")
  $joined = $joined -replace "\r", ""
  return $joined.Trim()
}

function Get-ShapeTextBlock {
  param([System.Xml.XmlNode]$ShapeNode)

  $paragraphs = @()
  foreach ($paragraph in $ShapeNode.SelectNodes("./p:txBody/a:p", $script:Ns)) {
    $text = Get-ParagraphText -Paragraph $paragraph
    if ([string]::IsNullOrWhiteSpace($text)) {
      continue
    }

    $pPr = $paragraph.SelectSingleNode("./a:pPr", $script:Ns)
    $level = 0
    if ($pPr -and $pPr.Attributes["lvl"]) {
      [void][int]::TryParse($pPr.Attributes["lvl"].Value, [ref]$level)
    }

    $isBullet = $false
    if ($pPr) {
      if ($pPr.SelectSingleNode("./a:buChar", $script:Ns) -or
          $pPr.SelectSingleNode("./a:buAutoNum", $script:Ns) -or
          $pPr.Attributes["lvl"]) {
        $isBullet = $true
      }
    }

    $paragraphs += [pscustomobject]@{
      Text = $text
      Level = $level
      IsBullet = $isBullet
    }
  }

  if ($paragraphs.Count -eq 0) {
    return $null
  }

  $phType = $null
  $phNode = $ShapeNode.SelectSingleNode("./p:nvSpPr/p:nvPr/p:ph", $script:Ns)
  if ($phNode -and $phNode.Attributes["type"]) {
    $phType = $phNode.Attributes["type"].Value
  }

  $isTitle = $phType -in @("title", "ctrTitle")
  return [pscustomobject]@{
    Kind = "text"
    IsTitle = $isTitle
    Paragraphs = $paragraphs
  }
}

function Get-TableBlock {
  param([System.Xml.XmlNode]$GraphicFrameNode)

  $tableNode = $GraphicFrameNode.SelectSingleNode("./a:graphic/a:graphicData/a:tbl", $script:Ns)
  if (-not $tableNode) {
    return $null
  }

  $rows = @()
  foreach ($row in $tableNode.SelectNodes("./a:tr", $script:Ns)) {
    $cells = @()
    foreach ($cell in $row.SelectNodes("./a:tc", $script:Ns)) {
      $cellParagraphs = @()
      foreach ($paragraph in $cell.SelectNodes("./a:txBody/a:p", $script:Ns)) {
        $text = Get-ParagraphText -Paragraph $paragraph
        if ($text) {
          $cellParagraphs += $text
        }
      }

      $cells += (($cellParagraphs -join "<br>") -replace "\|", "\|")
    }
    $rows += ,$cells
  }

  if ($rows.Count -eq 0) {
    return $null
  }

  return [pscustomobject]@{
    Kind = "table"
    Rows = $rows
  }
}

function Export-ImageBlock {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$SlidePath,
    [hashtable]$RelsMap,
    [System.Xml.XmlNode]$PicNode,
    [string]$AssetDir,
    [string]$AssetPrefix,
    [int]$ImageIndex
  )

  $blipNode = $PicNode.SelectSingleNode("./p:blipFill/a:blip", $script:Ns)
  if (-not $blipNode) {
    return $null
  }

  $embedId = $blipNode.GetAttribute("embed", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
  if (-not $embedId -or -not $RelsMap.ContainsKey($embedId)) {
    return $null
  }

  $target = Resolve-ZipPath -BasePath $SlidePath -Target $RelsMap[$embedId].Target
  $entry = $Zip.GetEntry($target)
  if (-not $entry) {
    return $null
  }

  $extension = [System.IO.Path]::GetExtension($target)
  $fileName = "{0}-image-{1:D2}{2}" -f $AssetPrefix, $ImageIndex, $extension
  $outputPath = Join-Path $AssetDir $fileName

  $inputStream = $entry.Open()
  try {
    $outputStream = [System.IO.File]::Create($outputPath)
    try {
      $inputStream.CopyTo($outputStream)
    }
    finally {
      $outputStream.Dispose()
    }
  }
  finally {
    $inputStream.Dispose()
  }

  $relPath = Split-Path -Leaf $AssetDir
  $altText = $PicNode.SelectSingleNode("./p:nvPicPr/p:cNvPr", $script:Ns)
  $label = if ($altText -and $altText.Attributes["descr"] -and $altText.Attributes["descr"].Value) {
    $altText.Attributes["descr"].Value
  }
  elseif ($altText -and $altText.Attributes["name"]) {
    $altText.Attributes["name"].Value
  }
  else {
    "Image $ImageIndex"
  }

  return [pscustomobject]@{
    Kind = "image"
    Label = $label
    RelativePath = ($relPath + "/" + $fileName)
  }
}

function Get-SlideBlocks {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$SlidePath,
    [string]$AssetDir,
    [string]$AssetPrefix
  )

  [System.Xml.XmlDocument]$slideDoc = Get-ZipXmlDocument -Zip $Zip -EntryName $SlidePath
  if (-not $slideDoc) {
    return @()
  }

  [System.Xml.XmlNamespaceManager]$script:Ns = New-NamespaceManager -Document $slideDoc
  $relsPath = ($SlidePath -replace "^(.+)/([^/]+)$", '$1/_rels/$2.rels')
  $relsMap = Get-RelationshipMap -Zip $Zip -RelsPath $relsPath
  $spTree = $slideDoc.SelectSingleNode("/p:sld/p:cSld/p:spTree", $script:Ns)
  if (-not $spTree) {
    return @()
  }

  $blocks = @()
  $imageIndex = 0

  foreach ($child in $spTree.ChildNodes) {
    if ($child.NodeType -ne [System.Xml.XmlNodeType]::Element) {
      continue
    }

    switch ($child.LocalName) {
      "sp" {
        $block = Get-ShapeTextBlock -ShapeNode $child
        if ($block) {
          $blocks += $block
        }
      }
      "graphicFrame" {
        $tableBlock = Get-TableBlock -GraphicFrameNode $child
        if ($tableBlock) {
          $blocks += $tableBlock
        }
      }
      "pic" {
        $imageIndex += 1
        $imageBlock = Export-ImageBlock -Zip $Zip -SlidePath $SlidePath -RelsMap $relsMap -PicNode $child -AssetDir $AssetDir -AssetPrefix $AssetPrefix -ImageIndex $imageIndex
        if ($imageBlock) {
          $blocks += $imageBlock
        }
      }
      "grpSp" {
        foreach ($nested in $child.ChildNodes) {
          if ($nested.NodeType -ne [System.Xml.XmlNodeType]::Element) {
            continue
          }

          if ($nested.LocalName -eq "sp") {
            $block = Get-ShapeTextBlock -ShapeNode $nested
            if ($block) {
              $blocks += $block
            }
          }
          elseif ($nested.LocalName -eq "pic") {
            $imageIndex += 1
            $imageBlock = Export-ImageBlock -Zip $Zip -SlidePath $SlidePath -RelsMap $relsMap -PicNode $nested -AssetDir $AssetDir -AssetPrefix $AssetPrefix -ImageIndex $imageIndex
            if ($imageBlock) {
              $blocks += $imageBlock
            }
          }
        }
      }
      default { }
    }
  }

  return $blocks
}

function Format-TextParagraphs {
  param([object[]]$Paragraphs)

  $lines = @()
  foreach ($paragraph in $Paragraphs) {
    $text = $paragraph.Text -replace "\n{2,}", "`n"
    if ($paragraph.IsBullet) {
      $indent = "  " * [Math]::Max(0, $paragraph.Level)
      $lines += ($indent + "- " + $text)
    }
    else {
      $lines += $text
    }
  }

  return ($lines -join "`n`n")
}

function Format-Table {
  param([object[]]$Rows)

  if ($Rows.Count -eq 0) {
    return $null
  }

  $columnCount = ($Rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
  $normalizedRows = @()
  foreach ($row in $Rows) {
    $normalized = @($row)
    while ($normalized.Count -lt $columnCount) {
      $normalized += ""
    }
    $normalizedRows += ,$normalized
  }

  $header = $normalizedRows[0]
  $separator = @()
  for ($i = 0; $i -lt $columnCount; $i++) {
    $separator += "---"
  }

  $lines = @(
    "| " + ($header -join " | ") + " |",
    "| " + ($separator -join " | ") + " |"
  )

  foreach ($row in $normalizedRows | Select-Object -Skip 1) {
    $lines += "| " + ($row -join " | ") + " |"
  }

  return ($lines -join "`n")
}

function Convert-PptxToMarkdown {
  param([System.IO.FileInfo]$PptxFile)

  $markdownPath = Join-Path $PptxFile.DirectoryName ($PptxFile.BaseName + ".md")
  $assetDir = Join-Path $PptxFile.DirectoryName ($PptxFile.BaseName + "_assets")

  if (Test-Path -LiteralPath $assetDir) {
    Remove-Item -LiteralPath $assetDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $assetDir | Out-Null

  $zip = [System.IO.Compression.ZipFile]::OpenRead($PptxFile.FullName)
  try {
    $slideEntries = Get-SlideEntries -Zip $zip
    $mdSections = @("# " + $PptxFile.BaseName, "", ("Slide Count: {0}" -f $slideEntries.Count), "")

    for ($i = 0; $i -lt $slideEntries.Count; $i++) {
      $slideNumber = $i + 1
      $blocks = Get-SlideBlocks -Zip $zip -SlidePath $slideEntries[$i] -AssetDir $assetDir -AssetPrefix ("slide-{0:D2}" -f $slideNumber)

      $titleBlock = $blocks | Where-Object { $_.Kind -eq "text" -and $_.IsTitle } | Select-Object -First 1
      $slideTitle = $null
      if ($titleBlock) {
        $slideTitle = ($titleBlock.Paragraphs | ForEach-Object { $_.Text } | Where-Object { $_ }) -join " "
      }
      elseif ($blocks.Count -gt 0 -and $blocks[0].Kind -eq "text") {
        $slideTitle = ($blocks[0].Paragraphs | ForEach-Object { $_.Text } | Where-Object { $_ }) -join " "
      }

      if ($slideTitle) {
        $mdSections += ("## Slide {0}: {1}" -f $slideNumber, $slideTitle)
      }
      else {
        $mdSections += ("## Slide {0}" -f $slideNumber)
      }
      $mdSections += ""

      foreach ($block in $blocks) {
        switch ($block.Kind) {
          "text" {
            if ($block.IsTitle) {
              continue
            }

            $formatted = Format-TextParagraphs -Paragraphs $block.Paragraphs
            if ($formatted) {
              $mdSections += $formatted
              $mdSections += ""
            }
          }
          "table" {
            $formatted = Format-Table -Rows $block.Rows
            if ($formatted) {
              $mdSections += $formatted
              $mdSections += ""
            }
          }
          "image" {
            $mdSections += ("![{0}](<{1}>)" -f $block.Label, $block.RelativePath)
            $mdSections += ""
          }
          default { }
        }
      }
    }

    $utf8Bom = [System.Text.UTF8Encoding]::new($true)
    [System.IO.File]::WriteAllText($markdownPath, ($mdSections -join "`n"), $utf8Bom)
  }
  finally {
    $zip.Dispose()
  }

  if ((Get-ChildItem -LiteralPath $assetDir -File | Measure-Object).Count -eq 0) {
    Remove-Item -LiteralPath $assetDir -Force
  }

  return $markdownPath
}

$resolvedInputDir = Resolve-Path -LiteralPath $InputDir
$pptxFiles = Get-ChildItem -LiteralPath $resolvedInputDir -Filter "*.pptx" | Sort-Object Name

if ($pptxFiles.Count -eq 0) {
  throw "No .pptx files found in $resolvedInputDir"
}

foreach ($pptxFile in $pptxFiles) {
  $result = Convert-PptxToMarkdown -PptxFile $pptxFile
  Write-Output "Created $result"
}
