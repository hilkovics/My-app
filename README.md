# Plánovač

Osobná mobilná aplikácia (iOS/Android, Expo), ktorá spája **kalendár, úlohy s pripomienkami, poznámky a návyky**.
Dáta sú uložené len lokálne v zariadení (SQLite). Udalosti z Google, Outlook či iCloud kalendára sa zobrazujú
cez systémový kalendár telefónu, takže netreba žiadny server ani prihlasovanie.

## Hlavná myšlienka

Všetko je jeden typ záznamu **Item** (`event` | `task` | `note`). Záznam sa dá jedným ťuknutím zmeniť na iný typ
(poznámka → úloha → udalosť), prepojiť s inými záznamami alebo s udalosťou z telefónu a pridať k nemu
checklist, štítky, opakovanie a upozornenia. **Pripomienka** je upozornenie pripojené ku ktorémukoľvek záznamu s časom.

## Funkcie

| Záložka | Čo robí |
| --- | --- |
| **Dnes** | Karta **Plán dňa** (prstenec, zaťaženie voči kapacite, upozornenia), program dňa (vlastné udalosti, udalosti z telefónu, naplánované úlohy), úlohy na dnes vrátane oneskorených, aktivity, pripnuté poznámky, denník |
| **Kalendár** | Mesiac, týždeň a deň. **Ťuknutie na udalosť otvorí rovno poznámky k tomuto termínu** (podržanie = úprava udalosti). **Time-blocking:** vyber neplánovanú úlohu a ťukni na čas v kalendári. Ťuknutie na prázdny čas vytvorí udalosť |
| **Úlohy** | Prepínač **Zoznam / Nástenka / Projekty**. Zoznam: Inbox, Dnes, Naplánované, Hotové a rýchle pridávanie po slovensky; opakované úlohy sa po splnení posunú na ďalší termín. **Nástenka (Kanban)** so stavmi Na urobenie / Rozpracované / Čaká na… / Hotové. **Projekty** s progresom úloh |
| **Poznámky** | Hľadanie, filtrovanie podľa štítkov, pripnutie, denník (jedna poznámka na deň), checklisty |
| **Pokrok** | **Aktivity** (hra na nástroji, beh, mixovanie hudby… aj návyky), **Ciele**, **Fokus** (časovač sústredenej práce) a jeho **Štatistiky** |

### Plán dňa (čas, náročnosť a kapacita)

Návrh podľa pokynov „Vizuálne zobrazenie úloh a času“: ťuknutím na kartu **Plán dňa** na obrazovke Dnes.

- **Odhad trvania** úlohy (5 min – 3 h; aj v rýchlom pridávaní: „na 90 min“). Úloha bez odhadu sa počíta ako ~30 min.
- **Náročnosť** záznamu: 🔥 hlboká práca / rutina (predvolená) / ☕ pauza. Hlboká práca je sýta s hrubým okrajom,
  rutina tlmená polopriehľadná, pauza šedozelená. Stav nie je len farba: pribudne aj ikona a text.
- **Rozvrh podľa dĺžky:** karty sú naskladané za sebou a ich výška je striktne úmerná trvaniu (80 px na hodinu:
  15 min = 20 px, 60 min = 80 px). Bloky do 15 min sú tenké prúžky. Čiara **kapacity** (predvolene 8 h, v Nastaveniach)
  oddeľuje bloky, ktoré sa už nezmestia: dostanú červený okraj a ⚠. Pauzy kapacitu nespotrebúvajú.
- **Prstenec dňa:** 24-hodinový kruh (polnoc hore, 15° na hodinu) s výsekmi úloh a udalostí, šedým oblúkom spánku
  (nastaviteľný), bodkou „teraz“, vyblednutými minulými časťami, tenkým prstencom priebehu dňa a vnútorným prstencom
  skutočne odpracovaného času z fokusu. Úlohy bez času sa navrhnú do prvého voľného času (čiarkovaný výsek).
  Ťuknutím na výsek alebo kartu sa otvorí detail bloku (náročnosť, odhad, ▶ Fokus).
- **Audit vyhorenia:** viac než 2 hlboké bloky za sebou bez pauzy (pauza = blok „pauza“ alebo medzera aspoň 15 min;
  rutinné bloky pauzou nie sú) ukážu upozornenie na Dnes aj v pláne dňa. Preplnené dni majú červený krúžok v mesačnom kalendári.
- **Plný deň:** pri pridaní úlohy do dňa, v ktorom nie je miesto (rýchle pridanie, nová úloha, nástenka, projekt,
  plánovanie do času v kalendári, „Do tohto dňa“ v pláne), vyskočí dialóg: skrátiť odhad inej úlohy o 15 min,
  presunúť na najbližší voľný deň, alebo pridať aj tak. Udalosti sa nikdy neblokujú.
- **Režim sústredenia:** ▶ Fokus pri bloku spustí Pomodoro na jeho dĺžku, ostatné bloky (aj výseky prstenca) sa
  stlmia a ostane rozsvietená len aktívna karta s odpočítavaním, pauzou a ukončením.
- Logika je v čistých funkciách (`src/features/plan/layout.ts`), ktoré pre každý blok vracajú `dimensions`,
  `visual_intensity` a `radial_position`, ako žiada špecifikácia.

### Projekty, nástenka, ciele a šablóny

- **Stav úlohy:** Na urobenie → Rozpracované → Čaká na… (s poznámkou kto/čo) → Hotové. Na **nástenke** sa karta
  presúva šípkami ◀ ▶, podržaním otvoríš výber stavu; v hlavičke stĺpca je „+“ na rýchle pridanie úlohy.
  Stav sa dá meniť aj v detaile úlohy a zaškrtnutie úlohy ju vždy presunie do Hotové (opakovaná úloha sa
  posunie na ďalší termín a vráti do Na urobenie).
- **Projekty** zoskupujú úlohy a poznámky: progres (hotové/všetky), odpočet do termínu („o 42 dní“), počet
  úloh po termíne, vlastný zoznam aj nástenka. Záznam k projektu priradíš v jeho detaile (čipy Projekt).
- **Ciele** (Pokrok → Ciele): *z projektov* (podiel hotových úloh vo všetkých projektoch cieľa) alebo *z aktivity*
  (napr. „Nabehať 50 km do 30. 11.“, metrika km / minúty / počet ×) s porovnaním voči lineárnemu plánu
  („Ideš podľa plánu“ / „Zaostávaš“).
- **Šablóny** (Nastavenia → Šablóny, alebo „Zo šablóny“ pri vytváraní): úloha, poznámka alebo celý projekt
  s úlohami, checklistom a termínmi relatívne k vytvoreniu; v názve funguje `{datum}`. Dodávajú sa vzory
  (Týždenná revízia, Porada, Nákupný zoznam, Balenie na cestu, Koncert / vystúpenie), vlastnú šablónu
  vytvoríš aj z existujúcej úlohy, poznámky či projektu („Uložiť ako šablónu“).
- **Opakované šablóny** (denne / týždenne / mesačne) vytvoria záznam samy, keď príde termín (pri otvorení
  aplikácie). Po dlhšej neprítomnosti sa vytvorí len posledný zmeškaný výskyt, nie hromada kópií.

### Aktivity

- Aktivitu vytvoríš zo šablóny (🎸 Hudobný nástroj, 🏃 Beh, 🎧 Mixovanie hudby, ✓ Návyk) alebo vlastnú.
  Meraná aktivita sleduje čas a voliteľne **km** (tempo min/km) a **hodnotenie ★**. Návyk je aktivita
  na odškrtávanie s denným cieľom a vybranými dňami (pôvodné návyky sa preniesli automaticky).
- Záznam: **▶ Štart** (časovač s pauzou, po Stop doplníš km, hodnotenie a poznámku) alebo **Pridať ručne**.
- **Týždenný cieľ** (počet ×, minúty alebo km) so **sériou týždňov 🔥**.
- **Ročná mapa dní** (štvorček za každý deň, tmavší = viac aktivít), **týždenný mix** za 12 týždňov
  (stĺpce rozdelené podľa aktivít, s legendou a súčtami) a pri každej aktivite vlastná mapa, graf po
  týždňoch a **denník** záznamov.
- Na obrazovke Dnes: odškrtávanie návykov, rýchle ▶ pre aktivity a bežiaci časovač.

### Fokus (sústredená práca)

- **Stopky** bežia, kým ich nezastavíš; **Pomodoro** (25/50/90 min) skončí samo, pošle notifikáciu a ponúkne prestávku.
- Pauza, pokračovanie, čas sa ukladá do databázy, takže časovač prežije aj zatvorenie aplikácie.
- Čas priradíš k **úlohe alebo udalosti** (▶ Spustiť fokus priamo v detaile) a ku **štítku / predmetu**
  (štítok sa prevezme z úlohy). V detaile úlohy vidíš, koľko si na nej odpracoval.
- **Štatistiky:** graf po dňoch (týždeň/mesiac) s čiarou denného cieľa, spolu, priemer, najlepší deň,
  **séria dní so splneným cieľom 🔥** a **kedy pracuješ najlepšie** (rozloženie podľa hodín za 30 dní).
- Obrazovka Dnes ukazuje bežiaci časovač a dnešný pokrok voči cieľu. Záznamy kratšie ako 1 minúta sa zahodia.

### Poznámky k udalostiam

Ťukni na udalosť (napr. prednášku) v kalendári alebo na obrazovke Dnes a otvoria sa poznámky k tomuto termínu.
Funguje to pre vlastné udalosti aj pre udalosti z kalendára v telefóne. Pri opakovanej udalosti má každý termín
vlastnú poznámku (napr. „Prednáška Matematika – 9. 11.“) a pod ňou je zoznam poznámok z ostatných termínov.
Poznámka sa vytvorí až keď začneš písať, dostane štítok podľa názvu udalosti a termín s poznámkou má v kalendári 📝.
Podržaním prsta na udalosti sa otvorí jej úprava.

Ďalej: fulltextové hľadanie vo všetkom, prepojenia medzi záznamami, poznámky a úlohy k udalostiam z telefónu,
kopírovanie udalosti do kalendára v telefóne, lokálne notifikácie s tlačidlami **Odložiť 10 min** a **Hotovo**,
export a obnova zálohy (JSON), export udalostí do `.ics`, svetlý aj tmavý režim.

### Rýchle pridávanie (príklady)

```
zajtra 15:00 zubár #zdravie pripomeň hodinu vopred
každý pondelok o 18 joga na 90 min
12.11. 18:30-20:00 kino
každý pracovný deň 7:30 lieky pripomeň
dnes písať report !2 #práca
```

Rozpozná sa: `dnes/zajtra/pozajtra`, dni v týždni (`v piatok`, `vo štvrtok`), dátum `12.11.` alebo `12.11.2027`,
čas `15:00`, `o 9`, `15h`, rozsah `15:00-16:30`, trvanie `na 30 min`, opakovanie `každý deň/týždeň/mesiac/rok`,
`každý pondelok`, `každý pracovný deň`, priorita `!1`–`!3`, štítky `#štítok`, upozornenie `pripomeň 15 min vopred`.

## Spustenie

```bash
npm install
npx expo start          # potom naskenuj QR kód v aplikácii Expo Go
npm run web             # rýchly náhľad v prehliadači (bez notifikácií a kalendára telefónu)
```

Notifikácie a prístup ku kalendáru telefónu treba skúšať na reálnom zariadení. Pre produkčné zostavenie
použi EAS (`npx eas-cli@latest build`).

## Kontroly

```bash
npm test                # logika: opakovanie, parser, repozitáre nad SQLite (node:sqlite)
npm run typecheck
npx expo lint
```

## Štruktúra

```
src/
  app/                      # obrazovky (expo-router)
    (tabs)/                 # Dnes, Kalendár, Úlohy, Poznámky, Návyky
    item/[id].tsx           # detail a úprava záznamu (autosave)
    item/new.tsx            # rýchle pridanie
    item/link.tsx           # prepojenie záznamov
    external/[id].tsx       # udalosť z kalendára telefónu + vlastné poznámky k nej
    habit/[id].tsx          # úprava návyku a história
    search.tsx, settings.tsx
  db/                       # schéma a migrácie, typy, hooky (useLiveQuery), zbernica zmien
  features/
    items/repository.ts     # CRUD, konverzia typov, úlohy, tagy, prepojenia, checklist, upozornenia
    calendar/               # rozvinutie opakovaní, rozloženie dňa, kalendár telefónu
    notifications/          # výpočet časov upozornení + plánovanie cez expo-notifications
    plan/                   # plán dňa: rozmery, náročnosť, prstenec, kapacita, audit vyhorenia
    projects/               # projekty, ciele, progres a odpočty
    templates/              # šablóny, opakované vytváranie, vzory
    activities/             # aktivity a záznamy, štatistiky (mapa dní, mix, ciele, série), prevod starých návykov
    focus/                  # sedenia, ovládač časovača (notifikácie), štatistiky
    quickadd/parse.ts       # slovenský parser rýchleho pridávania
    backup/                 # JSON záloha, .ics export
    settings/
  components/               # UI prvky, mesačná mriežka, časová os dňa/týždňa, výber dátumu
  lib/                      # dátumy, opakovanie (podmnožina RRULE), pomocné funkcie
  i18n/sk.ts                # všetky texty
test/                       # node:test testy
```

## Nápady na ďalšie verzie

- pripomienky podľa polohy (príchod/odchod)
- hlasové poznámky s prepisom
- šablóny (porada, nákupný zoznam, cesta)
- widgety na plochu
- ranný prehľad a týždenná revízia
- drag & drop pri time-blockingu a zmene dĺžky bloku
- šifrovaná záloha do iCloud / Google Drive
