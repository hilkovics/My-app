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
| **Dnes** | Program dňa (vlastné udalosti, udalosti z telefónu, naplánované úlohy), úlohy na dnes vrátane oneskorených, dnešné návyky, pripnuté poznámky, denník |
| **Kalendár** | Mesiac, týždeň a deň. **Ťuknutie na udalosť otvorí rovno poznámky k tomuto termínu** (podržanie = úprava udalosti). **Time-blocking:** vyber neplánovanú úlohu a ťukni na čas v kalendári. Ťuknutie na prázdny čas vytvorí udalosť |
| **Úlohy** | Inbox, Dnes, Naplánované, Hotové. Rýchle pridávanie po slovensky. Opakované úlohy sa po splnení posunú na ďalší termín |
| **Poznámky** | Hľadanie, filtrovanie podľa štítkov, pripnutie, denník (jedna poznámka na deň), checklisty |
| **Návyky** | Denné odškrtávanie (aj viackrát za deň), vybrané dni v týždni, séria 🔥, úspešnosť za 30 dní, mesačná história |

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
    habits/                 # repozitár a štatistiky (séria, úspešnosť)
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
