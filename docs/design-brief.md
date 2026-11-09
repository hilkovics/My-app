# Plánovač: zadanie pre návrh vzhľadu

> **Stav:** podľa tohto zadania vznikol návrh „Impulz“ (`design_handoff_planovac_impulz`) a je implementovaný v aplikácii; popis je v `README.md`, sekcia „Vzhľad“.

Kompletný inventár obrazoviek, prvkov, vizuálnych polí a stavov osobnej mobilnej aplikácie **Plánovač**.
Obsah je spísaný podľa skutočného kódu (stav k vetve `ccr-aec6776b-4pt5be`), nie podľa predstáv.
Dnešný vzhľad je funkčný, ale zámerne jednoduchý: dizajnér ho môže zmeniť celý. Všetko, čo sa nesmie zmeniť
(správanie, dáta), je v kapitole 2.

---

## 1. Čo aplikácia je

- **Osobný plánovač pre jedného používateľa** (iOS a Android, aj webový náhľad). Dáta sú len v zariadení, žiadne
  prihlasovanie ani účet.
- Spája: **kalendár** (vlastný + udalosti z telefónu, napr. Google/Outlook), **úlohy a pripomienky**, **poznámky**,
  **projekty a ciele**, **aktivity** (hra na nástroji, beh, mixovanie hudby, návyky), **meranie sústredenej práce**
  a **plán dňa** (kapacita, náročnosť, prstenec).
- Jazyk rozhrania: **slovenčina**. Svetlý aj tmavý režim podľa systému.
- Používa sa prevažne **jednou rukou, v krátkych dávkach**: rýchle pridanie, pozretie dňa, odškrtnutie.
- Hlavná myšlienka: všetko je jeden typ záznamu (**úloha / udalosť / poznámka**), ktorý sa dá meniť na iný typ,
  prepájať a zaradiť do projektu.

### Čo má byť pocitovo
Pokojná, prehľadná, „dospelá“ aplikácia. Dáta (čas, progres, zaťaženie) sú hrdinom, ozdoby sú vedľa. Žiadny tlak
(streaky a upozornenia na vyčerpanie majú byť povzbudzujúce, nie vyčítavé).

---

## 2. Obmedzenia, ktoré dizajn musí rešpektovať

### Technické
- **React Native (Expo)**: dizajn sa implementuje z RN primitív. Okrajové veci (blur, zložité gradienty, vlastné fonty)
  sú drahé alebo nedostupné. Preferuj plné farby, priehľadnosť, okraje, zaoblenie, tiene.
- **Spodná lišta je natívna** (iOS/Android): 5 záložiek, ikony len z **SF Symbols (iOS)** a **Material Symbols (Android)**,
  farba vybranej záložky a pozadie sa dajú nastaviť. Na webe je vlastná lišta.
- **Obsah má maximálnu šírku 800 px** (web/tablet), vycentrovaný.
- Ikony a emoji: používateľ si pri projektoch, aktivitách, cieľoch a šablónach **vyberá emoji** ako ikonu (zoznamy v kap. 6).
- Dlhé slovenské texty (napr. „Zaostávaš za plánom (podľa plánu by si mal mať 25,8 km)“): navrhni aj pre 2 riadky.

### Prístupnosť (nutné)
- **Stav nikdy len farbou**: náročnosť = farba + ikona + text, preťaženie = farba + ⚠ + text, hotové = prečiarknutie.
- Kontrast textu aspoň 4,5 : 1 (v kóde sa text na farebnej výplni vyberá automaticky biely/tmavý).
- Dotykové plochy aspoň 44 × 44 px (dnes niektoré ikony a šípky na karte nástenky sú menšie, treba zlepšiť).
- Každý ovládací prvok má textový popis pre čítačky obrazovky (existuje, nesmie sa stratiť).
- Grafy majú vždy textovú alternatívu (zoznam hodnôt) a legendu.

### Správanie, ktoré sa nemení
Dlhé podržanie = alternatívna akcia (úprava udalosti, výber stavu, odčítanie návyku). Ťuknutie na udalosť otvára
**poznámky k termínu**, nie jej úpravu. Úlohy sa presúvajú na nástenke tlačidlami ◀ ▶ (nie ťahaním).

---

## 3. Dnešné dizajnové tokeny (východisko; dá sa celé nahradiť)

### Farby (svetlý / tmavý)
| Token | Svetlý | Tmavý | Použitie |
|---|---|---|---|
| text | `#111214` | `#F4F5F7` | hlavný text |
| textSecondary | `#60646C` | `#A4A8B0` | popisy, metaúdaje |
| background | `#FFFFFF` | `#0B0B0C` | pozadie obrazovky |
| backgroundElement | `#F2F3F5` | `#1C1D20` | karty, polia |
| backgroundSelected | `#E3E5EA` | `#2C2E33` | vybrané, sekundárne tlačidlá, prázdna bunka |
| border | `#DFE1E6` | `#2E3035` | hairline okraje |
| accent | `#2F6FEB` | `#5B8DEF` | primárna akcia, vybraté |
| danger | `#D93636` | `#F06262` | chyba, preťaženie, po termíne |
| success | `#2E9E5B` | `#4CC27E` | splnené, v pláne, pauza |
| warning | `#C9820A` | `#E8A93A` | riziko vyčerpania, zaostávanie |

### Farby záznamov (výber používateľa, 8)
`#2F6FEB #2E9E5B #D93636 #C9820A #8B5CF6 #0EA5A4 #DB2777 #6B7280`

### Kategorická paleta pre aktivity, projekty a grafy (8 slotov, pevné poradie, overená pre farboslepých)
| Slot | Svetlý | Tmavý |
|---|---|---|
| 1 modrá | `#2a78d6` | `#3987e5` |
| 2 oranžová | `#eb6834` | `#d95926` |
| 3 aqua | `#1baf7a` | `#199e70` |
| 4 žltá | `#eda100` | `#c98500` |
| 5 ružová | `#e87ba4` | `#d55181` |
| 6 zelená | `#008300` | `#008300` |
| 7 fialová | `#6250d6` | `#9085e9` |
| 8 červená | `#e34948` | `#e66767` |

Pravidlá: farba patrí entite (aktivite/projektu), nikdy poradiu; nový odtieň sa nevymýšľa (9. položka = „Ostatné“, sivá
`#8a8f98` / `#6b7079`). Ak dizajnér zmení paletu, musí znova overiť rozlíšiteľnosť susedných farieb (CVD, ΔE ≥ 8) a kontrast.

### Sekvenčná škála pre mapu dní (4 stupne + prázdny)
Svetlý: `#9ec5f4 #5598e7 #256abf #104281`, prázdny = `backgroundSelected`. Tmavý: `#184f95 #256abf #3987e5 #86b6ef`.

### Písmo (dnes systémové)
| Štýl | Veľkosť / riadok | Váha | Použitie |
|---|---|---|---|
| subtitle | 32 / 44 | 600 | názov obrazovky |
| title | 48 / 52 | 600 | (rezerva) |
| default | 16 / 24 | 500 | telo |
| smallBold | 14 / 20 | 700 | popisky, hlavičky kariet |
| small | 14 / 20 | 500 | metaúdaje |
| mono | 12 | 700/500 | kód |
| špeciálne | 64/72 (časovač), 48/56 (časovač aktivity), 32/38 (suma v prstenci), 22/28 (dlaždica štatistiky), 11 (osi grafov) | | |

### Rozmery
Medzery: 2, 4, 8, 16, 24, 32, 64. Zaoblenie: 6 (prúžok), 10 (pole, tlačidlo), 16 (karta), 999 (čip). Hairline = 1 fyzický px.
Plávajúce tlačidlo (FAB): kruh 56 px, vpravo dole, nad spodnou lištou.

---

## 4. Mapa navigácie

```
Spodná lišta (5 záložiek)
├─ Dnes
├─ Kalendár
├─ Úlohy        [Zoznam | Nástenka | Projekty]
├─ Poznámky
└─ Pokrok       [Aktivity | Ciele | Fokus | Štatistiky]

Z hlavičiek záložiek:  🔍 Hľadať   ⚙ Nastavenia  (Pokrok má len ⚙)

Obrazovky nad záložkami (zásobník)
 Záznam:     Nový záznam (modál) · Detail záznamu · Prepojiť (modál) · Poznámky k termínu · Udalosť z telefónu
 Plán dňa:   Plán dňa (+ spodný panel bloku, dialóg „Deň je plný“)
 Projekty:   Detail projektu · Úprava projektu
 Ciele:      Detail cieľa · Úprava cieľa
 Aktivity:   Detail aktivity · Úprava aktivity · Záznam aktivity (modál)
 Fokus:      Výber úlohy pre fokus (modál)
 Šablóny:    Zoznam šablón · Úprava šablóny
 Ostatné:    Hľadať · Nastavenia
```

Vstupné body, ktoré nie sú na lište: karta „Plán dňa“ na Dnes → Plán dňa; ťuknutie na udalosť → Poznámky k termínu;
oznámenia → Detail záznamu.

---

## 5. Obrazovky (poradie zhora nadol)

Pri každej: **účel · prvky · stavy · akcie**. „Stavy“ sú to, čo treba navrhnúť okrem bežného zobrazenia.

### 5.1 Dnes
**Účel:** prehľad dňa a rýchle akcie.
**Hlavička:** „Dnes“, podnadpis dátum („utorok, 10. 11. 2026“), akcie 🔍 ⚙. FAB „+“ (nový záznam).
**Obsah zhora:**
1. **Karta Plán dňa**: malý prstenec (116 px) + „Plán dňa“, „6 h 45 min z 8 h“, stav („zostáva 1 h 15 min“ zelená /
   „Deň je plný“ oranžová / „Preplnený deň: +45 min“ červená), upozornenie „⚠ Riziko vyčerpania“, bežiaci fokus.
2. **Program dňa**: karta s riadkami: čas (90 px, `9:00–11:00` / „Celý deň“), farebný zvislý pruh, názov, podriadok
   (typ / kalendár / miesto), ikony 📝 (má poznámku) a 🔁 (opakuje sa).
3. **Fokus dnes**: karta s ukazovateľom „1 h 45 min z 3 h“ (alebo „⏱ Fokus beží · názov“).
4. **Úlohy na dnes**: riadky úloh (kruhový checkbox, názov, dátum, štítky, projekt, stav).
5. **Aktivity**: bežiaci časovač aktivity (karta so Stop), návyky ako čipy („💧 Voda 1/2 · 🔥 3“), rýchle ▶ čipy
   pre meranú aktivitu („▶ 🎸 Gitara“).
6. **Pripnuté poznámky** + tlačidlo „Denník“ (poznámka na dnešný deň).
**Stavy:** prázdny program („Dnes nemáš nič naplánované.“), žiadne úlohy, žiadne aktivity (sekcia sa skryje),
bežiaci fokus, preplnený deň, riziko vyčerpania.

### 5.2 Kalendár
**Účel:** deň/týždeň/mesiac, plánovanie úloh do času.
**Hlavička:** „Kalendár“, 🔍 ⚙, FAB „+“ (nová udalosť na vybraný deň).
**Ovládanie:** prepínač **Mesiac | Týždeň | Deň**; riadok ‹ názov obdobia [Dnes] ›.
**Mesiac:** mriežka týždňov (po–ne): číslo dňa v kruhu; dnes = obrys v akcentovej farbe; vybraný = plný akcent;
mimo mesiaca = tlmený; **až 3 farebné bodky** (udalosti); **červený krúžok** = preplnený deň. Pod mriežkou karta
vybraného dňa: dátum, „Otvoriť deň“, zoznam výskytov (riadky ako v Dnes).
**Týždeň / Deň (časová os):**
- pruh **Neplánované úlohy** (vodorovne posuvné čipy; po výbere text „Ťukni do kalendára, kam úlohu naplánovať“ + „Zrušiť“);
- hlavička dní (po 2, st 4 …, dnes = plný kruh); riadok pre celodenné udalosti;
- stĺpec hodín (7:00 … ), čiary po hodinách a polhodinách (každý polhodinový slot sa dá ťuknúť);
- bloky: **udalosť** = plná farba, **úloha v čase** = obrys + prázdna výplň + „☐“, **termín úlohy** = čiarkovaný obrys,
  **udalosť z telefónu** = farba kalendára; 📝 pri termíne s poznámkou; 🔥 hlboká práca (hrubší tmavší okraj),
  ☕ pauza (zelená priehľadná, čiarkovaný okraj); prekrývajúce sa bloky vedľa seba; čas v bloku od výšky ~40 px;
- červená **čiara „teraz“**.
**Stavy:** prázdny deň („Žiadne udalosti.“), režim plánovania úlohy (sloty zvýraznené), preplnený deň → dialóg (5.17).

### 5.3 Úlohy
**Hlavička:** „Úlohy“, 🔍 ⚙. Prepínač **Zoznam | Nástenka | Projekty**.
**Zoznam:** pole rýchleho pridania („Nová úloha… (napr. „zajtra 9:00 report !2 #práca“)“) s **živým náhľadom**
rozpoznaného (dátum, opakovanie, priorita, štítky, 🔔); prepínač **Inbox | Dnes | Naplánované | Hotové**; riadky úloh.
**Nástenka (Kanban):** čipy filtra projektov („Všetky projekty“, „🎤 Koncert“…); 4 vodorovne posuvné **stĺpce**
(~272 px): Na urobenie · Rozpracované · Čaká na… · Hotové, v hlavičke počet a „+“ (okrem Hotové). **Karta:** názov
(max 3 riadky, ! priorita), meta (termín, ⏳ koho čaká, projekt), šípky ◀ ▶ dole. Podržanie = výber stavu. V stĺpci
inline pole na rýchle pridanie.
**Projekty:** „+ Nový projekt“, čipy „Zo šablóny“, karty projektov (5.12), zbalená sekcia „Hotové a archivované (n) ▼“.
**Stavy:** prázdny zoznam („Nič tu nie je.“), prázdny stĺpec („Prázdne“), žiadne projekty.

### 5.4 Poznámky
**Hlavička:** „Poznámky“, 🔍 ⚙, FAB „+“.
**Obsah:** pole hľadania + tlačidlo „Denník dnes“; vodorovné čipy štítkov („Všetky“, „#práca 3“); zoznam poznámok:
bodka (farba), názov, náhľad textu (~90 znakov), štítky, „📅 po 9. 11. 10:00“ (poznámka k termínu), „📁 projekt“,
„☑ 2/5“, ikona 📌.
**Stavy:** prázdne („Zatiaľ žiadne poznámky.“), filter bez výsledku.

### 5.5 Pokrok
**Hlavička:** „Pokrok“, ⚙. Prepínač **Aktivity | Ciele | Fokus | Štatistiky**.

**5.5.1 Aktivity**
- (ak beží) **karta bežiaceho časovača**: „Beží · 🎸 Gitara“, veľký čas (48), Pauza/Pokračovať, Stop (po Stop sa otvorí 5.15).
- **Karty aktivít** (poradie podľa používateľa), každá: farebný štvorček, ikona (emoji), názov, podriadok
  („40 min tento týždeň · 1/3× · 🔥 1 týždeň“), ukazovateľ týždenného cieľa, tlačidlá „Štart“ a „Pridať ručne“.
  **Návyk (odškrtávací)**: podriadok („🔥 3 dni v rade · 87 % úspešnosť 30 dní“) + **pás 7 dní** (po–ne štvorce 34 px,
  v nich ✓ alebo počet; nenaplánované dni tlmené; dnes mierne zväčšený); ťuknutie +1, podržanie −1.
  Archivovaná = stlmená.
- „+ Nová aktivita“.
- Karta **Rok v aktivitách**: mapa dní (53 týždňov × 7, bunka 12 px / medzera 2 / zaoblenie 3, popisky mesiacov a dní
  po–st–pi, vodorovne posuvná, posledný týždeň vpravo), legenda „menej ▢▢▢▢▢ viac“, text po ťuknutí na deň
  („so 7. 11.: 🎸 Gitara 45 min · 🏃 Beh 28 min, 5,2 km“).
- Karta **Týždenný mix (12 týždňov)**: skladané stĺpce podľa aktivít, osi s dátumom každý 3. týždeň, **legenda**,
  tabuľka „Spolu za 12 týždňov“ (farebný štvorček, názov, čas).
**Stavy:** žiadne aktivity, bežiaci časovač, žiadny nameraný čas v mixe.

**5.5.2 Ciele**
- Karty cieľov: ikona, názov, podriadok („10 km / 50 km · termín o 7 dní“ / „1/5 úloh hotových“), %, ukazovateľ,
  stav plánu („Ideš podľa plánu“ zelená / „Zaostávaš za plánom (podľa plánu by si mal mať 25,8 km)“ oranžová /
  „Cieľ splnený 🎉“).
- „+ Nový cieľ“. **Stav:** prázdny („Cieľ je väčšia vec, napríklad „Zahrať koncert“ …“).

**5.5.3 Fokus (časovač)**
- **Nečinný:** prepínač Pomodoro | Stopky; čipy 25/50/90 min (alebo „Beží, kým ho nezastavíš.“); „Na čom pracuješ“:
  čip „Vybrať úlohu alebo udalosť…“ (+ ✕), čipy štítkov („Bez štítku“, „#práca“…), pole „Nový štítok / predmet…“; veľké „Štart“.
- **Beží:** štítok („Pomodoro · 25 min“ / „Stopky“, „pozastavené“), **veľký čas 64**, ukazovateľ priebehu (Pomodoro),
  predmet, Pauza/Pokračovať + Stop.
- **Prestávka:** „☕ Prestávka“, odpočet, „Ukončiť prestávku“, „Ďalšie Pomodoro“.
- **Dokončené Pomodoro:** „Pomodoro hotové 🎉“ + „☕ Prestávka 5 min“.
- **Dnes:** ukazovateľ „1 h 45 min z 3 h · zostáva 1 h 15 min“ + zoznam záznamov (čas, predmet, trvanie, ✕ vymazať).
**Stavy:** nečinný, beží, pozastavený, prestávka, hotovo, žiadne záznamy („Dnes ešte žiadna sústredená práca.“).

**5.5.4 Štatistiky**
- prepínač Týždeň | Mesiac, ‹ obdobie ›; **4 dlaždice** (Spolu, Priemer za deň, Najlepší deň + dátum, Séria 🔥 + „dní so splneným cieľom“);
- graf **Sústredená práca po dňoch** (stĺpce, čiara cieľa „cieľ 3 h“, po ťuknutí hodnota nad grafom, dnes zvýraznený),
  text „Dni so splneným cieľom: 2“;
- čipy **Denný cieľ** (1 h … 6 h);
- graf **Kedy pracujem najlepšie (30 dní)**: 24 stĺpcov po hodinách + veta „Najviac sa sústredíš medzi 9:00 – 11:00.“
**Stavy:** bez dát („Zatiaľ málo dát.“).

### 5.6 Plán dňa (obrazovka)
**Účel:** čas ako obmedzený zdroj: kapacita, náročnosť, prstenec.
**Prvky zhora:**
1. navigácia dňa ‹ dátum [Dnes] ›;
2. (ak beží fokus) **karta režimu sústredenia**: „Režim sústredenia · Sústredíš sa na“, názov, **veľký odpočet 44**, Pauza/Ukončiť;
3. (ak hrozí) **varovná karta**: „⚠ Riziko vyčerpania – 3 náročné bloky po sebe bez pauzy (9:00–13:30, spolu 4 h 30 min). Vlož medzi ne pauzu.“;
4. **Prstenec dňa** (220–300 px) so stredovým textom (suma 32, „z 8 h“, stav);
5. **legenda** (Hlboká práca, Rutina, Pauza, Spánok, Navrhnuté miesto, Skutočne odpracované);
6. karta **kapacity**: „Naplánované 6 h 45 min z 8 h“, „7 h 35 min voľného času“ / „+45 min nad kapacitu“, ukazovateľ;
7. **Rozvrh podľa dĺžky**: stĺpec kariet, výška úmerná trvaniu (**80 px = 1 h**), čiara „kapacita“ (červená čiarkovaná);
8. **Úlohy bez dňa**: riadky (názov, odhad / „~30 min (bez odhadu)“) + čipy „Do tohto dňa“ a „Otvoriť“.
**Prstenec – vrstvy** (podrobne v kap. 8): sivý podklad, oblúk spánku, výseky blokov, vonkajší červený obrys preplnených,
tenký prstenec priebehu dňa, vnútorný akcentový prstenec skutočnej práce, bodka „teraz“, hodinové značky 0/6/12/18.
**Karta bloku:** výška podľa trvania; do 15 min tenký prúžok bez odsadenia (názov len ak sa zmestí); ikona náročnosti
(🔥/☕), ⚠ pri preplnenom; druhý riadok (od ~42 px): `9:00–11:00 · 2 h`, „~30 min bez odhadu“, „navrhnuté miesto“.
**Stavy:** prázdny deň („Na tento deň nie je nič naplánované.“), preplnený, plný, riziko vyčerpania, **režim sústredenia**
(ostatné karty a výseky ~12 % krytia, aktívna rozsvietená so žiarou), minulý deň (všetko vyblednuté), budúci deň,
blok bez miesta v kruhu („nezmestí sa do kruhu“).

### 5.7 Nový záznam (modál)
Prepínač **Úloha | Udalosť | Poznámka**; „Zo šablóny“ (čipy šablón daného typu); **veľké pole rýchleho pridania**
(„Čo treba? „zajtra 15:00 zubár pripomeň hodinu vopred““) s autofokusom; pod ním **karta s rozpoznaným** (názov + súhrn)
alebo nápoveda syntaxe; viacriadkové pole „Poznámka“; tlačidlá **Vytvoriť** a **Vytvoriť a upraviť**.
Nápoveda: *dnes/zajtra/v piatok/12.11., 15:00 alebo o 9, 15:00–16:30, na 30 min, každý pondelok, !1–!3, #štítok,
pripomeň 15 min vopred*.

### 5.8 Detail záznamu (najdlhšia obrazovka)
**Hlavička:** názov podľa typu („Úloha“/„Udalosť“/„Poznámka“), vpravo 🗑 (červená).
**Polia zhora (podľa typu):**
- prepínač typu; (poznámka k termínu) tlačidlo „Patrí k udalosti: …“;
- riadok názvu (pri úlohe kruhový checkbox + veľké pole názvu);
- (úloha/udalosť) riadok „▶ Spustiť fokus“ + „Odpracované: 1 h 5 min“;
- **udalosť:** čip „Celý deň“, Začiatok, Koniec (výber dátumu a času, 5.18);
- **úloha:** Termín, Blok v kalendári („10. 11. 9:00–11:00“ + „Zrušiť blok“ / „Nenaplánované…“), **Stav** (4 čipy) +
  pole „Čaká na (koho / čo)“, **Priorita** (Žiadna, !, !!, !!!);
- **Náročnosť** (🔥 Hlboká práca / Rutina / ☕ Pauza), **Odhad** (Bez odhadu, 5 min … 3 h);
- **Opakovanie** (Nie, Denne, Týždenne, Mesačne, Ročne) + „Každých N“ s − / + + dni v týždni;
- **Upozornenia** (V čase, 5, 15, 30 min, 1 h, 2 h, Deň, Týždeň vopred; viac naraz);
- Poznámka (viacriadkové), Štítky, **Projekt** (čipy), Farba (8 + „—“) a „📌 Pripnúť“;
- (udalosť) sekcia „Poznámky k udalosti“ (zoznam poznámok všetkých termínov);
- **Checklist** (kruhový checkbox, text, ✕, pole „Pridať položku…“);
- **Prepojené** (riadky záznamov s ✕, „Prepojiť so záznamom“), (ak je) „📱 Prepojené s udalosťou v kalendári telefónu“;
- tlačidlá „Skopírovať do kalendára v telefóne“ (udalosť), „Uložiť ako šablónu“ (úloha/poznámka);
- päta: „Vytvorené … · upravené …“.
**Správanie:** automatické ukladanie (bez tlačidla Uložiť). **Návrh:** obrazovka je dnes príliš dlhý zoznam čipov;
sem patrí najväčšie zlepšenie (zoskupenie, zbaliteľné sekcie, rozumné predvolené zobrazenie).

### 5.9 Poznámky k termínu
Karta udalosti (názov 24, dátum a čas, miesto 📍, kalendár 📱, tlačidlo „Upraviť udalosť“); **veľké pole poznámky**
(autofokus, „Píš poznámky k tomuto termínu…“), pod ním „Ukladá sa automaticky.“ + „Checklist, štítky…“; sekcia
„Poznámky z ďalších termínov“ (riadky). **Stavy:** nová (poznámka sa vytvorí až pri písaní: „Poznámka sa uloží, keď začneš písať.“).

### 5.10 Udalosť z telefónu
Karta (názov, dátum, čas, miesto, kalendár, popis); „Moje poznámky a úlohy“ (zoznam / „Zatiaľ nič.“);
„Poznámky k tomuto termínu“, „Pridať úlohu k udalosti“.

### 5.11 Prepojiť / Hľadať / Výber pre fokus
Pole hľadania (autofokus) + zoznam výsledkov (názov, typ · dátum · štítky). Stav „Nič sa nenašlo.“ **Hľadať**: riadky ako
v zoznamoch. **Výber pre fokus**: dva oddiely „Dnes a v Inboxe“ / „Výsledky“; ťuknutie vyberie a zavrie.

### 5.12 Projekty
- **Karta projektu** (v zozname a na cieli): farebný štvorček, ikona, názov, podriadok („🎯 cieľ · termín o 42 dní“),
  % vpravo, ukazovateľ, „1/5 úloh · 2 úlohy po termíne“ / „bez úloh“.
- **Detail projektu:** hlavička „🎤 Koncert“ + ⚙; karta progresu („1/5 úloh · 20 %“, „termín o 42 dní“, ukazovateľ,
  cieľ, popis); pole rýchleho pridania úlohy; prepínač **Zoznam | Nástenka**; zoznam alebo nástenka projektu;
  tlačidlá „Nová poznámka“, „Uložiť ako šablónu“, „Označiť ako hotový / Znovu otvoriť“; „Pridať zo šablóny“ (čipy).
- **Úprava projektu:** Názov, Ikona (14 emoji), Farba (8), Popis, Cieľ (čipy + „Bez cieľa“), Termín, Uložiť,
  Archivovať, Vymazať.
**Stavy:** bez úloh, po termíne, hotový (stlmený), archivovaný.

### 5.13 Ciele
- **Detail cieľa:** karta cieľa (5.5.2), „Projekty cieľa“ (karty projektov / „Zatiaľ žiadne projekty…“), „Archivovať“.
- **Úprava cieľa:** Názov, Ikona (10), prepínač **Z projektov | Z aktivity**; pri aktivite: výber aktivity, „Meria sa“
  (Minúty / Km / Počet ×), Cieľová hodnota, Od, Do; Uložiť, Vymazať.

### 5.14 Aktivity
- **Detail aktivity:** hlavička „🎸 Gitara“ + ⚙; „Štart“ a „Pridať ručne“; karta **týždenného cieľa** („1/3×“, „🔥 2 týždne
  v rade“, ukazovateľ); **Rok v aktivitách** (jej mapa); graf **Po týždňoch** (stĺpce + čiara cieľa); **Denník**
  (riadok: farebný pruh, dátum a čas, hlavná hodnota „40 min · 5,2 km · 5:23 /km · ★★★★“, poznámka max 2 riadky).
- **Úprava aktivity:** „Začni zo šablóny“ (🎸 Hudobný nástroj, 🏃 Beh, 🎧 Mixovanie hudby, ✓ Návyk), Názov, Ikona
  (18 emoji), Farba (8), Typ (Meraný čas | Odškrtnutie), (meraný) „Sledovať vzdialenosť (km)“ a „Hodnotenie ★“,
  (odškrtnutie) Dni po–ne + Cieľ za deň (− N ×  +), Týždenný cieľ (Bez cieľa / Počet × / Minúty / Km + − N +),
  Uložiť, Archivovať, Vymazať.

### 5.15 Záznam aktivity (modál)
Názov aktivity, Dátum a čas, Trvanie (min), (ak km) Vzdialenosť s **živým tempom** („Tempo: 5:23 /km“),
(ak ★) Hodnotenie ★ až ★★★★★, Poznámka („Čo si cvičil/a, trasa, projekt…“), Uložiť, Vymazať. Otvára sa aj po **Stop**
(režim „Dokončiť záznam“, autofokus na km).

### 5.16 Šablóny
- **Zoznam:** karty (ikona, názov, typ, „🔁 každý týždeň“), tlačidlá „Použiť“ a „Upraviť“; „+ Nová šablóna“,
  „Obnoviť vzory“. Vzory: 🗓️ Týždenná revízia, 🤝 Porada, 🛒 Nákupný zoznam, 🧳 Balenie na cestu, 🎤 Koncert / vystúpenie.
- **Úprava:** Názov šablóny, Ikona (12), (nová) Typ (Úloha | Poznámka | Projekt), Názov záznamu (+ nápoveda `{datum}`), Text,
  Štítky, (úloha) Priorita a Termín (Bez termínu / V deň vytvorenia / Za N dní), Checklist (viacriadkové),
  (projekt) Termín projektu v dňoch a Úlohy projektu (riadok = úloha, „Názov | 7“, „- položka“ = checklist),
  **Opakované vytváranie** (Nie/Denne/Týždenne/Mesačne, dni, „Začať od“, „Ďalšie vytvorenie: nedeľa, 15. 11. 2026“),
  Uložiť, Vytvoriť teraz, Vymazať.

### 5.17 Spodné panely a dialógy
- **Dialóg „Deň je plný · utorok, 10. 11. 2026“:** „zostáva 3 h 15 min · 9 h 40 min voľného času · pridávaš 4 h“;
  „Skrátiť odhad inej úlohy“ (riadky `Písať report · 2 h` + tlačidlo `→ 1 h 45 min`); „Teraz sa zmestí.“; tlačidlá
  Pridať / „Presunúť na stredu, 11. 11. 2026“ / „Pridať aj tak“ / Zrušiť.
- **Výber stavu úlohy:** názov, 4 čipy stavov, pole „Čaká na…“ (len pri Čaká), Zrušiť / Uložiť.
- **Panel bloku v pláne dňa** (dolný): názov s ikonou náročnosti, čas · trvanie · značky, Náročnosť (3 čipy), Odhad (čipy),
  „Fokus“, „Otvoriť“, Zrušiť; pri udalosti z telefónu len informácia.
- **Potvrdenia** (dnes natívne okno): „Naozaj vymazať?“, „Vymazať tento záznam práce?“, „Obnovenie nahradí všetky
  súčasné dáta. Pokračovať?“; **oznámenia** (dnes natívne okno): „Šablóna uložená.“, „Skopírované do kalendára.“, „Záloha obnovená.“.
  → Navrhni jednotný **toast/snackbar** a vzhľad potvrdzovacieho dialógu.

### 5.18 Výber dátumu a času (rozbaliteľný panel v poliach)
Pole s hodnotou („sobota, 7. 11. 2026, 14:30“ / „Bez dátumu“); po ťuknutí panel: čipy Dnes, Zajtra, O týždeň, Bez dátumu;
‹ mesiac ›; mesačná mriežka; pole Čas („napr. 14:30“) + čipy 8:00, 12:00, 18:00; „Hotovo“.

### 5.19 Nastavenia
Sekcie: **Upozornenia** (stav „Povolené / Nepovolené“ + „Povoliť“; predvolené upozornenie čipmi), **Kalendáre v telefóne**
(popis, „Povoliť prístup ku kalendáru“, potom riadky: farebný štvorček, názov, zdroj, prepínač; „Kalendár na kopírovanie
udalostí“ čipy), **Kapacita dňa** (4 h … 10 h; „Spánok od“ 21–1; „do“ 5–9), **Prvá zobrazená hodina dňa** (5–9),
**Šablóny** (tlačidlo), **Dáta** (Exportovať zálohu JSON, Exportovať udalosti .ics, Obnoviť zo zálohy, poznámka
„Všetky dáta sú uložené len v tomto zariadení.“).
**Stavy:** nepodporované na webe („Na tejto platforme nie je dostupné.“), povolenie zamietnuté.

### 5.20 Systémové oznámenia (mimo aplikácie)
- Pripomienka záznamu: **názov** + čas („dnes 14:00“); akcie **Odložiť 10 min**, **Hotovo**; ťuknutie otvorí záznam.
- Koniec Pomodora: „Pomodoro hotové 🎉 – Daj si prestávku.“; koniec prestávky: „Prestávka skončila – Späť do práce 💪“.
- Žiadosti o povolenie (oznámenia, kalendár): vlastný vysvetľujúci text pred systémovým oknom (dnes chýba).

---

## 6. Komponenty (knižnica)

Každý treba navrhnúť vrátane stavov: **predvolený · stlačený · vypnutý · vybraný · zameraný (klávesnica) · chybný**
a vo **svetlom aj tmavom** režime.

| Komponent | Varianty a poznámky |
|---|---|
| **Hlavička obrazovky** | názov (32) + podnadpis + akcie vpravo; v zásobníku natívna hlavička s tlačidlom späť |
| **Sekcia** | nadpis veľkými písmenami (12, rozostup) + voliteľná akcia vpravo |
| **Karta** | zaoblenie 16, vnútorné odsadenie 16; varianty: bežná, s obrysom (varovanie/fokus), stlmená (archív) |
| **Tlačidlo** | primárne, sekundárne, nebezpečné, textové; veľkosť bežná a malá; s ikonou; vypnuté |
| **Tlačidlo-ikona** | 22 px ikona + dotykový rozsah; farba, vypnuté |
| **FAB** | kruh 56, „+“, tieň |
| **Čip** | pill; stavy nevybraný / vybraný (výplň akcentom alebo vlastnou farbou); varianty: text, emoji, farebný štvorček (výber farby), s číslom |
| **Prepínač (segmented)** | 2–4 segmenty; aktívny „zdvihnutý“; musí zvládnuť 4 popisky na 390 px |
| **Zaškrtávacie políčko** | kruh 22, vybrané = plná farba + ✓; farba podľa záznamu; pole stavu úlohy |
| **Pole (input)** | bežné, veľké (názov), viacriadkové (min. 100–260), s nápovedou, s chybou |
| **Pole s výberom dátumu** | 5.18 |
| **Riadok záznamu** | úloha (checkbox) / udalosť a poznámka (bodka); názov, podriadok (dátum · štítky · projekt · ☑), ikony 🔁 📌; stavy: hotová (prečiarknutá), po termíne (červený podriadok), rozpracovaná „▶“, čaká „⏳“ |
| **Riadok výskytu v dni** | čas · farebný pruh · názov/podriadok · ikony |
| **Ukazovateľ (meter)** | 8 px, výplň akcent, podklad svetlejší odtieň toho istého odtieňa; stavy podľa závažnosti (akcent → varovanie → nebezpečenstvo) |
| **Prázdny stav** | text; navrhni ilustráciu/ikonu a primárnu akciu |
| **Dlaždica štatistiky** | štítok, hodnota 22, podtext |
| **Mesačná mriežka** | 5.2 (bunky ≥ 38–46 px) |
| **Časová os** | 5.2 |
| **Karta nástenky** | 5.3 |
| **Karta bloku plánu** | 5.6 |
| **Prstenec dňa** | veľký (220–300) a kompaktný (116) |
| **Mapa dní** | 5.5.1 |
| **Stĺpcový graf** (jedna séria + čiara cieľa) | stĺpec ≤ 24 px, zaoblený 4 px len hore, základňa hairline |
| **Skladaný stĺpcový graf** | medzera 2 px medzi segmentmi, legenda, tooltip po ťuknutí |
| **Karta projektu / cieľa / aktivity** | 5.12, 5.5.2, 5.5.1 |
| **Dialóg / spodný panel** | 5.17 (vrátane pozadia, zaoblenia, tieňa) |
| **Toast / snackbar** | NOVÝ (dnes natívne okno) |
| **Spodná lišta** | 5 záložiek; vybraná / nevybraná; značka (badge) – zatiaľ nepoužitá |

### Ikony
Dnes (SF Symbols / Material Symbols): `plus, magnifyingglass, gearshape, checkmark, xmark, chevron.left/right, calendar,
note.text, checklist, flame, sun.max, pin.fill, repeat, bell, link, trash, book, iphone, play.fill, pause.fill, stop.fill,
timer, chart.bar.fill`. Záložky: Dnes = slnko, Kalendár = kalendár, Úlohy = checklist, Poznámky = poznámka, Pokrok = stĺpcový graf.
Navrhni jednotný štýl (hrúbka, plná/obrysová pre vybrané), prípadne vlastnú sadu.
**Emoji ako ikony používateľa:** projekty `📁 🎤 🎸 💻 🏠 ✈️ 📚 🎓 💼 🛠️ 🎯 🌱 🎬 🏃`; aktivity `🎸 🎹 🥁 🎻 🎤 🎧 🎛️ 🏃 🚴 🏊 🧘 🏋️ 📚 ✍️ 💧 💊 ✓ ⭐`;
ciele `🎯 🎤 🏃 🎸 📚 💪 🌍 💼 🏆 🌱`; šablóny `📋 🗓️ 🤝 🛒 🧳 🎤 📝 ☑️ 📊 🏋️ 🧹 💡`. Textové značky v rozhraní: 🔥 ☕ 📝 📅 📁 📍 📱 ⏳ ⏱ ⚠ 🔁 🔔 📌 ★.

---

## 7. Vizuálne kódovanie (čo čo znamená)

| Význam | Dnešné kódovanie | Pozn. |
|---|---|---|
| **Typ záznamu** | úloha = kruhový checkbox; udalosť/poznámka = farebná bodka; udalosť v kalendári = plný blok, úloha = obrys | |
| **Farba záznamu** | vlastná z 8, inak akcent | identita, nie náročnosť |
| **Náročnosť** | 🔥 hlboká = plná sýta výplň + hrubý (3 px) tmavší okraj + biely/tmavý text · rutina = polopriehľadná výplň (~18 %) + 1 px okraj · ☕ pauza = zelená priehľadná výplň (~18 %) | stav = farba + ikona + text |
| **Stav úlohy** | Na urobenie / ▶ Rozpracované / ⏳ Čaká na … / Hotové (prečiarknuté, hotové stĺpec dole) | |
| **Priorita** | „!“ „!!“ „!!!“ červeným písmom pred názvom | |
| **Po termíne** | podriadok červený; dátumový termín až po skončení dňa | |
| **Preplnené (nad kapacitu)** | červený okraj karty + ⚠; červený oblúk mimo prstenca; červený krúžok dňa v mesiaci; červený text „+45 min nad kapacitu“ | |
| **Navrhnuté miesto** | čiarkovaný okraj / čiarkovaný výsek | úloha bez vlastného času |
| **Bez odhadu** | „~30 min bez odhadu“ | |
| **Riziko vyčerpania** | oranžový obrys karty + ⚠ text | |
| **Ukazovateľ cieľa** | akcentová výplň; text plánu zelený (v pláne) / oranžový (zaostáva) | |
| **Plán vs. skutočnosť** | vonkajší prstenec = plán, vnútorný akcentový = skutočne odpracované | |
| **Minulé časti** | vyblednuté (≈30 % krytia) | prstenec |
| **Režim sústredenia** | ostatné ≈12 % krytia, aktívna 100 % + žiara | |
| **Návyk dňa** | štvorec: prázdny / čiastočný (55 % farby) / splnený (plný + ✓ alebo číslo); nenaplánovaný 30 % | |
| **Archív / hotové** | 45–55 % krytia | |
| **Poznámka k termínu** | 📝 pri termíne | |
| **Pripnuté** | 📌 | |
| **Opakuje sa** | 🔁 | |

---

## 8. Dátové vizualizácie – pravidlá

- **Jedna os**, nikdy dvojitá. Mriežka a osi **hairline, plné**, ustúpené do pozadia.
- Značky **tenké**: stĺpec max 24 px, zaoblený 4 px len na voľnom konci; čiara 2 px; bod ≥ 8 px; výplň plochy ~10 %.
- Medzi dotýkajúcimi sa výplňami **2 px medzera** v farbe pozadia (nie obrys).
- **Legenda vždy pri ≥ 2 sériách**; hodnoty sa nepíšu na každý bod (po ťuknutí nad grafom + tabuľka).
- **Text nikdy nenosí farbu série**: farba je v značke vedľa textu; text je v textových farbách.
- Farba patrí entite, nie poradiu; max 8 + „Ostatné“.
- **Prstenec dňa – špecifikácia:** 24 h, polnoc hore, 15° = 1 h, smer hodín; hrúbka ≈ 10 % veľkosti (13 % v kompaktnom);
  vrstvy zvonka dnu: červený obrys preplnených · prstenec blokov (hlboká sýta, rutina ~50 %, pauza zelená ~55 %,
  navrhnuté čiarkované) · tenký prstenec priebehu dňa (sivý, zaoblené konce) · akcentový prstenec skutočnej práce (4 px);
  oblúk spánku sivý ~28 %; hodinové značky 0, 6, 12, 18 mimo kruhu (vo veľkom); bodka „teraz“ na prstenci; oddeľovače po 90°.
- **Rozvrh podľa dĺžky:** 80 px = 1 h (15 min = 20 px), bez medzier, čiara kapacity.
- **Mapa dní:** 5 stupňov (0 = prázdna), mierka podľa denného cieľa alebo 90. percentilu.

---

## 9. Stavy a spätná väzba (zhrnutie)

| Situácia | Dnes | Treba navrhnúť |
|---|---|---|
| Prázdne zoznamy | len text | ilustrácia/ikona + jedna odporúčaná akcia |
| Načítavanie | prázdna obrazovka | kostry (skeleton) alebo jemný indikátor |
| Chyba (databáza, import) | natívne okno / konzola | chybová obrazovka a text |
| Potvrdenie akcie | natívne okno | toast s „Späť“ (undo) |
| Mazanie | natívne potvrdenie | jednotný potvrdzovací dialóg |
| Povolenia | systémové okno bez vysvetlenia | vysvetľujúca obrazovka pred žiadosťou |
| Offline / web | „Na tejto platforme nie je dostupné.“ | vzhľad nedostupných funkcií |
| Úspešné splnenie (cieľ, séria, Pomodoro) | emoji v texte | jemná oslava (nie rušivá) |
| Dlhé podržanie | bez nápovedy | objaviteľnosť (napr. jednorazový tip) |

---

## 10. Čo ešte chýba a treba navrhnúť od nuly

- **Ikona aplikácie** (iOS, Android adaptívna – popredie, pozadie, monochromatická), **splash obrazovka**, favicon.
  Dnes sú predvolené zástupné obrázky.
- **Onboarding** (prvé spustenie): čo aplikácia je, vysvetlenie povolení (oznámenia, kalendár), rýchle pridávanie
  vetou, ukážka vzorových šablón.
- **Ikona oznámenia** (Android, malá monochromatická) a vzhľad akcií v oznámení.
- **Ilustrácie / ikony prázdnych stavov** (8–10 kusov: dnes, úlohy, nástenka, poznámky, projekty, ciele, aktivity, štatistiky).
- **Toast/snackbar** a **jednotný dialóg**.
- **Kostry načítavania.**
- **Vzhľad vybratého spodného panelu bloku** a **režimu sústredenia** ako celej obrazovky (dnes len stlmenie).
- **Widgety** (do budúcna): Dnes (program + úlohy), Plán dňa (prstenec), Fokus (časovač).
- **Tablet / široké okno** (web): dnes len vycentrovaný stĺpec 800 px; zvážiť dvojstĺpec (zoznam + detail).

---

## 11. Otvorené otázky pre dizajn

1. Je správny model **5 záložiek**? Možno zlúčiť/zjednodušiť (napr. Úlohy + Kalendár), alebo presunúť Poznámky a Pokrok.
2. Ako zjednodušiť **detail záznamu** (kap. 5.8): zbaliteľné sekcie, pokročilé polia pod „Viac“, rýchle akcie hore?
3. **Hlavný vstupný bod rýchleho pridania**: FAB na každej záložke, alebo trvalé pole nad lištou?
4. Má mať **Plán dňa** vlastnú záložku (dnes je to karta na Dnes → obrazovka)?
5. Ako zobraziť **kapacitu a preťaženie** tak, aby to motivovalo a nevyčítalo?
6. Má byť **prstenec** hlavným prvkom obrazovky Dnes, alebo zostať ako karta?
7. Jednotný jazyk **ikon**: emoji (hravé, ale nekonzistentné medzi platformami) vs. vlastná sada.
8. **Tmavý režim** ako prvotriedny (dnes len odvodený z rovnakých tokenov).
9. Typografia: systémové písmo vs. jedno vlastné písmo (náklady, licencia, podpora diakritiky).
10. Hustota: dnes pohodlná; aká má byť „kompaktná“ pre dlhé zoznamy a mesačný pohľad?

---

## 12. Vzorové dáta na mockupy

Deň **utorok 10. 11. 2026**, kapacita 8 h, spánok 23:00–7:00.

| Čas | Záznam | Typ / náročnosť | Trvanie |
|---|---|---|---|
| 9:00–11:00 | Písať report | úloha, 🔥 hlboká | 2 h |
| 11:00–12:30 | Návrh architektúry | úloha, 🔥 hlboká | 1 h 30 min |
| 12:30–13:30 | Revízia kódu | úloha, 🔥 hlboká | 1 h |
| 13:30–14:00 | Obed | ☕ pauza | 30 min |
| 14:00–14:15 | Zavolať | úloha, rutina | 15 min |
| 14:30–16:30 | Admin | úloha, rutina | 2 h |
| 18:00–19:30 | Joga | udalosť, opakuje sa každý týždeň, 📝 | 1 h 30 min |
| celý deň | Výlet | udalosť (celodenná) | |

- **Projekt** 🎤 *Koncert* (termín o 42 dní, 1/5 úloh, 20 %): Vybrať repertoár, Nacvičiť skladby (checklist 0/3),
  Pripraviť techniku a zvuk, Generálka, Pozvať ľudí.
- **Cieľ** 🎯 *Nabehať 50 km do 30. 11.*: 10 / 50 km, „Ideš podľa plánu“; 🎯 *Zahrať koncert* (z projektov): 1/5 úloh.
- **Aktivity:** 🎸 Gitara (cieľ 3× týždenne, 1/3×, 🔥 1 týždeň, ★★★★★, poznámka „Wonderwall – akordy a rytmus“);
  🏃 Beh (cieľ 15 km, 5,2/15 km, tempo 5:23 /km); 🎧 Mixovanie hudby (cieľ 180 min); 💧 Voda (návyk, 2×/deň).
- **Poznámky:** „Prednáška Matematika – 9. 11.“ (štítok `#Prednáška-Matematika`, 📅 po 9. 11. 10:00),
  „Nápady na víkend“ (📌, `#osobné`, checklist 0/1).
- **Fokus:** 5 min z 3 h dnes; Pomodoro 25 min na „Návrh architektúry“.
- **Štatistiky (týždeň 9.–15. 11.):** Spolu 8 h 35 min, Priemer 2 h 52 min, Najlepší deň 3 h 20 min (ut 10. 11.), Séria 🔥 2.
