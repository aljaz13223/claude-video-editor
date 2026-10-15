# ArtCraft v sistemu (nameščeno 2026-10-15)

Launcher: `%USERPROFILE%\AppData\Local\Programs\ArtCraft Launcher\artcraft-launcher.exe` (0.4.1, podpis Learning Machines Inc).
Aplikacije: `C:\Program Files\<App>\<app>.exe` (GUI) in `<app>-cli.exe` (headless + MCP).

| App | Verzija | Za kaj | CLI |
|---|---|---|---|
| PhotoCraft | 0.9.0 | urejanje slik (PSD, PNG, EXR …) | `photocraft-cli convert / info / run / batch / mcp / serve` |
| VectorCraft | 0.11.0 | vektorji, logotipi | `vectorcraft-cli` |
| FilmCraft | 0.8.0 | montaža, barve, zvok | `filmcraft-cli exec / run / import / export / render / probe / mcp` |
| LightCraft | 0.8.0 | foto knjižnica, RAW | `lightcraft-cli` |
| PdfCraft | 0.8.0 | PDF | `pdfcraft-cli` |
| EffectCraft | 0.10.0 | motion graphics (After Effects-style, JSX skripte) | `effectcraft-cli render / render-frame / script / set / mcp` |
| DesignCraft | 0.8.0 | layout, tisk | `designcraft-cli` |
| WordCraft | 0.7.0 | dokumenti | `wordcraft-cli` |
| DeckCraft | 0.7.0 | prezentacije | `deckcraft-cli` |
| GridCraft | 0.7.0 | tabele | `gridcraft-cli` |
| CADCraft | 0.7.0 | CAD | `cadcraft-cli` |
| SoundCraft | 0.7.0 | snemanje, mix zvoka | `soundcraft-cli convert / run / script / mcp` |
| FigCraft | 0.6.0 | UI dizajn, prototipi | `figcraft-cli` |

## MCP
Vsak `<app>-cli.exe mcp` je MCP strežnik na stdio (headless; z `--bridge`/`--connect` se poveže v odprto aplikacijo).
Vedno omeji dostop do datotek: `--automation-read-root "<your project folder>" --automation-write-root "<your project folder>"`.

## Uporaba pri montaži
- **EffectCraft**: intro/outro animacije, lower thirds, logo reveal (`script anim.jsx` → `render --out x.mov --prores 4444` z alfo).
- **FilmCraft**: `probe` za info o posnetku, `export --list-presets`, barvna korekcija.
- **SoundCraft**: `convert IN OUT --normalize`, mix in bounce glasbe/SFX.
- **PhotoCraft**: `batch` za thumbnaile, `convert` PSD → PNG.

## Znana napaka
Launcher pri namestitvi vrne Windows Installer error 1619. MSI v `AppData\Local\ArtCraft Launcher\downloads` je v redu: skopiraj ga v a folder of your own, preveri podpis (Learning Machines Inc) in zaženi `msiexec /i <msi> /passive`.
