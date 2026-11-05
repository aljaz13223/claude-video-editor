---
name: motion-workflow
description: Stiliziran motion video v 6 korakih s kontrolnimi točkami — trening stila iz referenčnih slik, test stila (3 slike), test animacije, storyboard, končni edit, iteracija. Uporabi, ko Aljaž reče "naredi video v tem stilu", "nauči se stila", "motion grafike v stilu …", "storyboard", ali da referenčne slike / Pinterest posnetke za stil.
---

# motion-workflow

Vir: 100x Engineers, "Claude Edited This Video (And I'll Teach You How)" (transkript v `F:\claude system\transcripcije`, povzetek v `00-SISTEM/znanje-iz-transkripcij.md` §15).
Bistvo: **ne skači naravnost v edit.** Vsak korak je kontrolna točka; Aljaž potrdi, šele nato naslednji. To prihrani tokene in da boljši rezultat.

## Vedno najprej preberi
- `00-SISTEM/PRAVILA-SPLOSNA.md` (pravila iz feedbacka imajo prednost)
- `<stranka>/BRAND.md`, če gre za stranko; `00-SISTEM/stili/README.md` (že narejeni stili)
- `00-SISTEM/GLASBA-DNEVNIK.md` (vedno nova glasba)

## 1. Viri
Vse v eno mapo: scenarij (besedilo), talking head, voiceover, logotip, fotke. Če je posnetek daljši od 1–2 min, ga razdeli na kose (scene ali In–Out) in delaj kos za kosom.

## 2. Trening stila (brez urejanja!)
- 15–20 referenčnih slik **istega** stila (Pinterest, Cosmos, ali `00-SISTEM/stili`). Vsebina slik ni pomembna, pomemben je slog.
- Prompt: »Najprej se nauči stila. Ne urejaj še. Opiši, kaj razumeš: paleta (hex), oblike in elementi, teksture, tipografija, gibanje.«
- Rezultat zapiši kot stil: ime, opis, paleta, pisave, elementi, teksture, gibanje, prepovedano. V Takeframe: zavihek **Workflow → 2. Style** (shrani se v projekt).
- Čakaj na »potrjeno«.

## 3. Test stila
3 statične slike v tem stilu iz 3 različnih vrstic scenarija. Pokaži jih (frame-i). Če niso konsistentne, so krive reference — zamenjaj jih, ne popravljaj z besedami.

## 4. Test animacije
Animiraj prvo sliko iz koraka 3 točno po njeni vrstici scenarija (3–5 s). Potrdi gibanje, krivulje, tempo, preden gradiš celoto.

## 5. Storyboard
Dva načina:
- Claude iz scenarija predlaga storyboard (vrstica → kaj je na ekranu → gibanje → zvok), Aljaž reže in dodaja; ali
- Aljaž napiše svoj storyboard (npr. »tekst pride pred mene«, »tekst gre za mene«), Claude ga kritizira in predlaga izboljšave.
Nekaj krogov, dokler ni potrjen. Pravila: vsaka scena svoj tip gibanja, tekst berljiv (~1 s/besedo + 1 s), hook v 2–3 s, rez na glasbo.

## 6. Edit
»Uporabi potrjen storyboard, scenarij in stil in naredi končni video.« Opus 5.5, effort medium (high za zahtevne animacije). 60 s reel ≈ 20–90 min.
Po gradnji: izriši ključne frame-e in jih preglej (prekrivanja, odrezane črke, berljivost, varno območje), zvok −14 LUFS, govor nad glasbo.

## 7. Iteracija
Prvi osnutek je samo osnutek. Vsak feedback popravi in ga zapiši kot merljivo pravilo v `PRAVILA-SPLOSNA.md` ali `<stranka>/PRAVILA-EDITA.md`.

## Dodatno
- Tekst **za govorcem**: potrebuje masko osebe (segmentacija) — v Takeframe še ni; do takrat v After Effects/EffectCraft (Roto Brush).
- Urejanje v Premiere/After Effects: FilmCraft/EffectCraft prek MCP (naš ekvivalent Premiere MCP-ja in ae-builder skilla).
