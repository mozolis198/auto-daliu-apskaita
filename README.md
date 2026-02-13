# Auto Dalių Apskaita - Barkodais Valdoma Sistema

Pagrindinė web programėlė autoriaus dalių inventoriaus valdymui naudojant barkodus.

## 🎯 Pagrindinės Funkcijos

✅ **Barkodskaitytuvas** - Nuskaitykite barkodus tiesiogiai iš srauto  
✅ **Detalių Katalogo** - Pilnas dalių sąrašas su kategorijomis  
✅ **Automobilio Suderimė** - Nurodykite kokiam auto/markei/modeliui tinka detalė  
✅ **Kiekių Valdymas** - Operacijos su atsargomis (+/-, tiksli reikšmė)  
✅ **Greitoji Paieška** - Raskite detales pagal barkodiniu arba pavadinimą  
✅ **Kainu Sekimas** - Stebėkite pardavimo ir savikainų  
✅ **Kategorijų Sistema** - Organizuokite detales pagal tipą

## 📋 Reikalavimai

- Node.js 16 ar naujesnis
- npm 8 ar naujesnis
- SQLite (sukuriama automatiškai)

## 🚀 Diegimas ir Paleidimas

### 1️⃣ Sukurkite priklausomybes
```bash
npm install
```

### 2️⃣ Paleisti abejus serverius (dev režime)
```bash
npm run dev
```

Tai pradės:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173

### 3️⃣ Atidarykite aplikaciją
Nukreipkite savo naršyklę į: **http://localhost:5173**

---

## 💻 Pradžia

### Barkodskaitytuvas
1. Eikite į **"Barkodskaitytuvas"** skirtuką
2. Maksimaliai padidinę barkodskaitytuvo laukelį (debesėlyje ar nuolatinį susitelkindami)
3. Nuskaitykite barkodą iš produkto arba daugiausiai eigos
4. Jei barkodas yra sistemoje, bus rodomos detalės
5. Jei nėra - forma pasiūlys sukurti naują detalę

### Paieška
1. Eikite į **"Paieška"** skirtuką
2. Pasirinkite paieškos tipą:
   - **📦 Barkodiniu** - Paieška pagal detalės barkodiniu
   - **🔢 OE Numeris** - Paieška pagal fabrikinio (OE) numerį
   - **📝 Pavadinimas** - Paieška pagal detalės pavadinimą
3. Įveskite paieškos žodį ir spustelėkite **"Ieškoti"** arba paspauskite Enter
4. Sistema parodyti visas atitinkančias detales
5. Spustelėkite **"Pasirinkti"** prie reikalingos detalės

### Detalių Sąrašas
1. Eikite į **"Sąrašas"** skirtuką
2. Peržiūrėkite visas saugomos detales
3. Naudokite:
   - **➕/➖** - Didinti/mažinti kiekį
   - **✏️ Redaguoti** - Keisti visą informaciją (pavadinimas, automobilio info)
   - **Filtras** - Ieškoti pagal pavadinimo arba barkodiniu
   - **Rikiavimas** - Rūšiuoti pagal pavadinimas, kiekis ar kainas

### Automobilio Informacijos Pridėjimas
1. Kurianti naują detalę barkodskaitytuvo skirtuke, spauskite prisigrupusią seciją: **"🚗 Automobilio Suderinamumas"**
2. Išpildykite:
   - **Markė** - pvz. Toyota, BMW, Volkswagen
   - **Modelis** - pvz. Camry, 320, Golf
   - **Nuo metų** - Kurie metais pradeda tikti
   - **Iki metų** - Kurie metais baigia tikti
3. Šie laukeliai **nėra būtini** - jei detalė tinka visiem automobiliam, palikite tuščius
4. Atnaujinkite egzistuojančios detalės automobilio info:
   - Spustelėkite **✏️ Redaguoti** ant detalės
   - Pakeiskite automobilio duomenis
   - Spustelėkite **✓ Išsaugoti**

---

## 🏗️ Projekto Struktūra

```
.
├── server/                 # Express backend
│   ├── index.js           # Pagrindinė serverio aplikacija
│   ├── package.json       # Backend priklausomybės
│   └── parts.db           # SQLite duomenų bazė
│
├── client/                # React frontend
│   ├── src/
│   │   ├── App.jsx        # Pagrindinė aplikacija
│   │   ├── components/    # React komponentai
│   │   │   ├── BarcodeScanner.jsx
│   │   │   ├── BarcodeLookup.jsx
│   │   │   └── PartsList.jsx
│   │   ├── main.jsx       # Įvesties taškas
│   │   └── index.css      # Globaliniai stiliai
│   ├── index.html         # HTML šablonas
│   ├── vite.config.js     # Vite konfigūracija
│   └── package.json       # Frontend priklausomybės
│
└── package.json           # Root monorepo konfigūracija
```

---

## 🛠️ API Endpoints

### Detalės
- `GET /api/parts` - Gauti visas detales
- `GET /api/parts/barcode/:barcode` - Rasti detalę pagal barkodiniu
- `GET /api/parts/oe/:oe_number` - Rasti detales pagal OE/fabrikinio numerį
- `GET /api/parts/name/:name` - Rasti detales pagal pavadinimą
- `POST /api/parts` - Sukurti naują detalę
- `PUT /api/parts/:id` - Atnaujinti detalės informaciją (pavadinimas, kaina, automobilio info, OE numeris)
- `PUT /api/parts/:id/quantity` - Atnaujinti kiekį

### Kategorijos
- `GET /api/categories` - Gauti visas kategorijas
- `POST /api/categories` - Sukurti naują kategoriją

### Grįžtamasis
- `GET /health` - Sveikatinio serverio patikrinimas

---

## 📝 Detalės Duomenys

Kiekviena detalė turi:
- **Barkodinį** - Unikali identifikacija naudojama greitam paieškos
- **OE/Fabrikinis Numeris** - Originalios sudetės numeris - naudojamas filtram ir paieško
- **Pavadinimą** - Detalės aprašymas
- **Kategoriją** - Tipas (filtrai, alyvos ir t.t.)
- **Kiekį** - Aktualaus esamų savų
- **Kainą** - Pardavimo kaina (€)
- **Savikainę** - Įsigijimo kaina (€)
- **Aprašymą** - Papildomi pastabos
- **Automobilio informaciją**:
  - **Markė** - pvz. Toyota, BMW, Audi
  - **Modelis** - pvz. Camry, 320, A4
  - **Nuo metų** - Kokiais metais pradeda tikti
  - **Iki metų** - Kokiais metais baigia tikti

### Automobilio Suderimės Pavyzdžiai
- "Alyvos filtras" - Toyota Camry 2015-2023
- "Oro filtras" - BMW 320 2010-2018
- "Stabdžių trinkelės" - Audi A4 nuo 2012m.
- "Ritinys" - Volkswagen Golf iki 2015m.
---

## 🔌 Barkodskaitytuvas

Sistema nepalaiko tiesioginio kameravimo - naudojant vieno iš šių:

1. **USB Barkodskaitytuvo** - Tipiški USB įrenginiai
2. **Mobilaus Telefono** - Jeigu naudojate web versiją skaitmenimis

USB skaitymos nurode barkodinį kaip standartini tekstą - nebus problemos!

---

## 🐛 Trikčiai ir Sprendimai

### "Negali prisijungti prie DB"
```bash
# Iterartū server aplankę ir trinkelkite parts.db
rm server/parts.db
# Paleiskite iš naujo - DB bus sukurta
npm run dev
```

### "Frontend negali rasti backend'o"
- Patikrinkite, ar backend bėga `localhost:3001`
- Patikrinkite `client/vite.config.js` proxy
- Žiūrėbite konsolės klaidas naršyklėje (F12)

### Serveris nesileista
```bash
# Patikrinkite portą 3001 ar jis naudojamas
# Windows:
netstat -ano | findstr :3001

# Linux/Mac:
lsof -i :3001
```

---

## 📦 Naudoti Technologijos

- **Frontend**: React 18, Vite, JSBarcode
- **Backend**: Express.js, SQLite3, CORS
- **Kalbos**: JavaScript (ES6+), HTML5, CSS3

---

## 📄 Licencija

Šis projektas yra nemokamas / Open Source projektas.

---

## 💡 Būsimi Patobulinimai

- 📱 Mobilios versijos optimizacija
- 🔄 Eksportas/Importas CSV
- 📊 Išsamios ataskaitos
- 👥 Keliavartoklė parama (prisijungimas)
- 📸 Produkto nuotraukos
- 🔐 Duomenų kopijos (backup)

---

**Sėkmingai naudotis! 🎉**
