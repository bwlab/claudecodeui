# Foundations DS bwlab v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrare Design System bwlab v2 in claudecodeui (token, primitives, font, accent heritage) mantenendo compatibilità totale coi componenti shadcn esistenti.

**Architecture:** Copia `design-tokens.css` + `design-primitives.css` da `astro-primereact`, aggiunge `shadcn-compat.css` che rimappa var shadcn a HSL-triple (preservando alpha modifier `bg-primary/50`), configura `<html data-accent="heritage" ...>`, carica Inter Tight + JetBrains Mono da Google Fonts, estende `ThemeContext` per settare anche `data-theme`. Nessun rewrite di componenti UI. Tutto in un commit, rollback via `git revert`.

**Tech Stack:** React 18, Vite, Tailwind 3.4, CSS custom properties, bun runtime.

**Spec:** `docs/superpowers/specs/2026-04-23-foundations-bwlab-v2-design.md`

**Branch:** `redesign` (già creato, head `06aba8f`).

**Note su testing:** codebase senza vitest/jest. Verifica via `bun run typecheck` + `bun run lint` + `bun run build` + smoke manuale (dev server + screenshot). Plan non include unit test per evitare setup test framework fuori scope foundations.

**Note su husky:** il pre-commit hook richiede `npx` in PATH. Prepend `PATH="/home/lmassa/.nvm/versions/node/v20.19.0/bin:$PATH"` prima di ogni `git commit`.

---

## File Structure

**Create:**
- `src/styles/design-tokens.css` — copia 1:1 da `astro-primereact/src/styles/design-tokens.css`
- `src/styles/design-primitives.css` — copia 1:1 da `astro-primereact/src/styles/design-primitives.css`
- `src/styles/shadcn-compat.css` — shim: rimappa var shadcn → valori HSL-triple calcolati dai HEX v2
- `scripts/sync-bwlab-ds.sh` — script manuale per ri-sincronizzare i CSS dal DS

**Modify:**
- `src/index.css` — prepend 3 `@import` prima di `@tailwind`
- `tailwind.config.js` — aggiunge `fontFamily.sans/display/mono` mappati ai token v2
- `index.html` — attributi `data-accent/bg/font/density` su `<html>` + `<link>` Google Fonts
- `src/contexts/ThemeContext.jsx` — aggiunge `setAttribute('data-theme', ...)` accanto a `classList.add/remove('dark')`

---

### Task 1: Copia file DS sorgente

**Files:**
- Create: `src/styles/design-tokens.css`
- Create: `src/styles/design-primitives.css`

- [ ] **Step 1: Copia i due CSS dal repo astro-primereact**

```bash
DS=/media/extra/Progetti/astrojs-primereact/CascadeProjects/windsurf-project/astro-primereact/src/styles
cp "$DS/design-tokens.css" src/styles/design-tokens.css
cp "$DS/design-primitives.css" src/styles/design-primitives.css
```

- [ ] **Step 2: Verifica che i file contengano i valori chiave attesi**

Run:
```bash
grep -E "heritage-a:|surface-0:|font-display:" src/styles/design-tokens.css | head -5
```

Expected output include almeno:
```
  --heritage-a: #F5D000;
  --surface-0: #fafafa;
  --font-display: "Inter Tight", "Nobile", system-ui, sans-serif;
```

Se manca qualcosa, fermati e segnala: il DS sorgente è cambiato e questo plan va aggiornato.

- [ ] **Step 3: Non committare ancora**

Procedi al Task 2. Commit unico a fine plan.

---

### Task 2: Crea script di sync opzionale

**Files:**
- Create: `scripts/sync-bwlab-ds.sh`

- [ ] **Step 1: Scrivi lo script**

```bash
#!/usr/bin/env bash
# Sync Design System bwlab v2 da astro-primereact a claudecodeui.
# Copia design-tokens.css e design-primitives.css.
# shadcn-compat.css resta manuale: se DS cambia i valori HEX delle surface/fg/
# accent, aggiornare a mano le HSL-triple in src/styles/shadcn-compat.css.

set -euo pipefail

DS="/media/extra/Progetti/astrojs-primereact/CascadeProjects/windsurf-project/astro-primereact/src/styles"
DEST="$(cd "$(dirname "$0")/.." && pwd)/src/styles"

if [[ ! -d "$DS" ]]; then
  echo "ERRORE: DS non trovato in $DS" >&2
  exit 1
fi

cp "$DS/design-tokens.css" "$DEST/design-tokens.css"
cp "$DS/design-primitives.css" "$DEST/design-primitives.css"

echo "DS sync completato."
echo "Ricordati di verificare shadcn-compat.css se sono cambiate le surface-*/fg-*/accent-*."
```

- [ ] **Step 2: Rendi eseguibile**

```bash
chmod +x scripts/sync-bwlab-ds.sh
```

- [ ] **Step 3: Verifica che parta**

```bash
./scripts/sync-bwlab-ds.sh
```

Expected: output `DS sync completato.` + `Ricordati di verificare shadcn-compat.css...`. Nessun errore. I due file in `src/styles/` restano identici (idempotente).

---

### Task 3: Crea shadcn-compat.css con HSL-triple

**Files:**
- Create: `src/styles/shadcn-compat.css`

- [ ] **Step 1: Scrivi il file**

```css
/* ==========================================================================
   shadcn-compat.css
   Rimappa le variabili shadcn (primary, background, ...) ai valori del
   Design System bwlab v2 mantenendo il formato HSL-triple (senza hsl()),
   così Tailwind può usare l'alpha modifier: hsl(var(--primary) / 0.5).

   I valori HSL-triple sono duplicati manualmente dai HEX di design-tokens.css.
   Se design-tokens.css cambia i valori, aggiornare a mano questo file.
   Commento accanto ad ogni var indica il HEX di origine.
   ========================================================================== */

:root,
html[data-theme="light"] {
  --background: 0 0% 98%;          /* #fafafa  — surface-0 light */
  --foreground: 240 14% 5%;        /* #0b0b0e  — fg-1 light */
  --card: 0 0% 100%;               /* #ffffff  — surface-1 */
  --card-foreground: 240 14% 5%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 14% 5%;
  --primary: 51 100% 48%;          /* #F5D000  — heritage-a (yellow) */
  --primary-foreground: 240 7% 3%; /* #070708  — ink-950 */
  --secondary: 220 13% 97%;        /* #f5f6f8  — surface-2 */
  --secondary-foreground: 240 10% 18%;
  --muted: 220 13% 97%;
  --muted-foreground: 232 7% 35%;  /* #54545e  — fg-3 */
  --accent: 355 94% 46%;           /* #E30613  — heritage-b (red) */
  --accent-foreground: 0 0% 100%;
  --destructive: 3 100% 62%;       /* #FF453A  — state-danger */
  --destructive-foreground: 0 0% 100%;
  --border: 0 0% 0%;               /* alpha via tailwind modifier */
  --input: 0 0% 0%;
  --ring: 51 100% 48%;
  --radius: 0.5rem;
}

html[data-theme="dark"],
html.dark {
  --background: 240 9% 6%;         /* #0d0d10  — ink-900 */
  --foreground: 220 17% 94%;       /* #eceef2  — fg-1 dark */
  --card: 240 13% 9%;              /* #141418  — ink-850 */
  --card-foreground: 220 17% 94%;
  --popover: 240 13% 9%;
  --popover-foreground: 220 17% 94%;
  --primary: 51 100% 48%;
  --primary-foreground: 240 7% 3%;
  --secondary: 240 11% 12%;        /* #1a1a20  — ink-800 */
  --secondary-foreground: 220 17% 94%;
  --muted: 240 11% 12%;
  --muted-foreground: 232 10% 65%;
  --accent: 355 94% 46%;
  --accent-foreground: 0 0% 100%;
  --destructive: 3 100% 62%;
  --destructive-foreground: 0 0% 100%;
  --border: 0 0% 100%;             /* alpha via tailwind modifier */
  --input: 0 0% 100%;
  --ring: 51 100% 48%;
}
```

- [ ] **Step 2: Verifica sintassi HSL-triple**

```bash
grep -cE "^\s+--[a-z-]+: [0-9]+ [0-9.]+% [0-9.]+%" src/styles/shadcn-compat.css
```

Expected: output ≥ 30 (almeno 15 var × 2 blocchi = 30 match).

---

### Task 4: Aggiorna src/index.css (import chain + rimozione token shadcn obsoleti)

**Files:**
- Modify: `src/index.css`

**Problema del cascade:** `src/index.css` contiene già un blocco `@layer base { :root { ... } .dark { ... } }` con le var shadcn in HSL-triple terracotta (linee ~25-45 per `:root`, ~87-119 per `.dark`). Dato che `@layer base` ha priorità di cascade più alta di `:root` top-level, il compat shim verrebbe shadowato. Vanno **rimosse chirurgicamente** le var shadcn dai due blocchi, mantenendo invece `--nav-*`, `--safe-area-*`, `--mobile-nav-*`, `--header-*`, `--radius` e i `@supports` (non toccati dal DS).

- [ ] **Step 1: Prepend i 3 import all'inizio del file**

Apri `src/index.css`. Le prime 3 righe sono:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Sostituiscile con:
```css
@import "./styles/design-tokens.css";
@import "./styles/design-primitives.css";
@import "./styles/shadcn-compat.css";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Rimuovi dal blocco `:root` in `@layer base` le sole var shadcn**

Dentro `@layer base { :root { ... } }` (blocco principale circa linee 24-75), **rimuovi** queste righe:

```css
    --background: 30 25% 97%;
    --foreground: 25 20% 12%;
    --card: 30 20% 99%;
    --card-foreground: 25 20% 12%;
    --popover: 30 20% 99%;
    --popover-foreground: 25 20% 12%;
    --primary: 17 48% 54%;
    --primary-foreground: 30 25% 98%;
    --secondary: 28 20% 93%;
    --secondary-foreground: 25 20% 15%;
    --muted: 28 18% 94%;
    --muted-foreground: 20 10% 48%;
    --accent: 28 20% 93%;
    --accent-foreground: 25 20% 15%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 30 25% 98%;
    --border: 28 18% 88%;
    --input: 28 18% 88%;
    --ring: 17 48% 54%;
    --radius: 0.5rem;
```

**Mantieni** invece `--nav-*`, `--safe-area-*`, `--mobile-nav-*`, `--header-*` e il blocco `@supports` per iOS legacy. Queste var non fanno parte del DS v2 ed alimentano logica nav/PWA propria di claudecodeui.

- [ ] **Step 3: Rimuovi dal blocco `.dark` in `@layer base` le sole var shadcn**

Dentro `@layer base { ... .dark { ... } }` (blocco circa linee 87-119), **rimuovi** queste righe:

```css
    --background: 25 15% 8%;
    --foreground: 30 20% 92%;
    --card: 25 15% 11%;
    --card-foreground: 30 20% 92%;
    --popover: 25 15% 11%;
    --popover-foreground: 30 20% 92%;
    --primary: 17 48% 60%;
    --primary-foreground: 25 15% 10%;
    --secondary: 25 12% 18%;
    --secondary-foreground: 30 20% 92%;
    --muted: 25 12% 18%;
    --muted-foreground: 25 12% 62%;
    --accent: 25 12% 18%;
    --accent-foreground: 30 20% 92%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 30 20% 92%;
    --border: 25 12% 18%;
    --input: 25 10% 35%;
    --ring: 17 48% 60%;
```

**Mantieni** le `--nav-*` dark overrides.

- [ ] **Step 4: Aggiungi `html[data-theme="dark"]` duplicato ai nav override**

Per coerenza (il toggle setta sia `.dark` class sia `data-theme`), assicurati che i nav override si applichino anche a `html[data-theme="dark"]`. Trasforma il selector del blocco `.dark` interno (quello che ora contiene solo `--nav-*`) in:

```css
  .dark,
  html[data-theme="dark"] {
    /* Nav design tokens — dark overrides */
    --nav-glass-bg: 25 15% 8% / 0.55;
    /* ...resto invariato */
  }
```

Questo è un refactor minimo e indolore: altri componenti useranno `.dark:*` (shadcn) nativamente e funzionano già.

- [ ] **Step 5: Verifica**

```bash
head -10 src/index.css
grep -cE "^\s+--(background|foreground|primary|secondary|muted|accent|destructive|border|input|ring|card|popover):" src/index.css
```

Expected:
- `head -10` mostra i 3 `@import` prima di `@tailwind`.
- `grep -c` dà `0` (le var shadcn sono solo nel compat shim ora, non in index.css).

```bash
grep -cE "^\s+--(nav-|safe-area-|mobile-nav-|header-|radius)" src/index.css
```

Expected: ≥ 10 (le var non-shadcn sono preservate).

---

### Task 5: Aggiorna tailwind.config.js con fontFamily mapping

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Trova il blocco `theme.extend`**

Run:
```bash
grep -n "extend:" tailwind.config.js
```

Expected: una riga tipo `    extend: {` dentro `theme:`.

- [ ] **Step 2: Aggiungi fontFamily come primo figlio di `extend`**

Inserisci questo blocco come prima entry dentro `extend: {`:

```js
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
```

Esempio risultato atteso (intorno alla riga `extend: {`):

```js
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        // ...resto invariato
```

**Non cambiare** le entry `colors` esistenti: il compat shim fornisce HSL-triple compatibili con la sintassi `hsl(var(--x))` attuale.

- [ ] **Step 3: Verifica sintassi**

```bash
bun run typecheck
```

Expected: nessun errore. `tailwind.config.js` non è in TS ma typecheck valida solo `src/`. Lo step serve per fallire presto se qualcosa rompe JSX tipizzato.

---

### Task 6: Aggiorna index.html (data-* + Google Fonts)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Leggi l'header attuale**

```bash
head -20 index.html
```

Nota l'attuale `<html ...>` e la `<head>`.

- [ ] **Step 2: Aggiungi attributi data-* su `<html>`**

Sostituisci il tag di apertura `<html ...>` con:

```html
<html lang="en" data-accent="heritage" data-bg="flat" data-font="inter" data-density="normal">
```

(Se `lang` era diverso, mantieni l'originale e aggiungi solo i 4 data-*.)

- [ ] **Step 3: Aggiungi preconnect + Google Fonts nella `<head>`**

Inserisci subito dopo `<meta charset="UTF-8">` (o come prima risorsa in `<head>`):

```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

- [ ] **Step 4: Verifica**

```bash
grep -E 'data-accent|Inter\+Tight|JetBrains' index.html
```

Expected: almeno 3 match (attributo data-accent, family Inter Tight, family JetBrains Mono).

---

### Task 7: Estendi ThemeContext con setAttribute data-theme

**Files:**
- Modify: `src/contexts/ThemeContext.jsx`

- [ ] **Step 1: Apri il file e individua i 2 branch della `useEffect` principale**

Il blocco `if (isDarkMode) { ... } else { ... }` gestisce add/remove di `.dark`. Vogliamo aggiungere in entrambi il set di `data-theme`.

- [ ] **Step 2: Aggiungi setAttribute nel branch `if (isDarkMode)`**

Trova questa riga:
```js
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
```

Aggiungi subito sopra:
```js
      document.documentElement.setAttribute('data-theme', 'dark');
```

Risultato:
```js
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
```

- [ ] **Step 3: Aggiungi setAttribute nel branch `else`**

Trova:
```js
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
```

Aggiungi subito sopra:
```js
      document.documentElement.setAttribute('data-theme', 'light');
```

Risultato:
```js
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
```

- [ ] **Step 4: Verifica**

```bash
grep -c "setAttribute('data-theme'" src/contexts/ThemeContext.jsx
```

Expected: `2`.

---

### Task 8: Verifiche automatiche (typecheck + lint + build)

**Files:** nessuna modifica.

- [ ] **Step 1: typecheck**

```bash
bun run typecheck
```

Expected: exit 0, nessun errore. Se errori pre-esistenti su altre aree: documentali, ma non bloccano foundations (devono essere gli stessi di `main`/`feature/claude-tasks-viewer`).

- [ ] **Step 2: lint**

```bash
bun run lint
```

Expected: exit 0 o errori solo pre-esistenti su file non toccati. Nessun nuovo errore su `src/contexts/ThemeContext.jsx`.

- [ ] **Step 3: build**

```bash
bun run build
```

Expected: build completa senza errori. Bundle CSS finale in `dist/`.

- [ ] **Step 4: Verifica che i token v2 siano nel bundle finale**

```bash
grep -E "heritage-a|#F5D000|Inter Tight" dist/assets/*.css | head -5
```

Expected: almeno 2 match (valori DS presenti nel CSS finale).

---

### Task 9: Smoke test manuale in dev

**Files:** nessuna modifica.

- [ ] **Step 1: Avvia dev server**

```bash
bun run dev
```

Aspetta che sia pronto (`VITE ready in ... ms`, server su porta indicata).

- [ ] **Step 2: Apri l'app in Chrome/Firefox**

Apri l'URL dev (default `http://localhost:5173` o simile stampato).

- [ ] **Step 3: Verifica base**

Controlla in browser:
- Nessun errore rosso in console DevTools.
- Font UI è **Inter Tight** (DevTools → Elements → seleziona `<body>` → Computed → `font-family`).
- Aprire DevTools → Elements → `<html>` — deve avere attributi `data-accent="heritage"`, `data-bg="flat"`, `data-font="inter"`, `data-density="normal"` + `data-theme="light"` o `"dark"` (a seconda della preferenza).

- [ ] **Step 4: Smoke-check di 4 pagine**

Naviga e verifica che rendano senza layout rotti:
1. Dashboard / home app
2. Chat (una conversazione aperta)
3. Shell (terminale)
4. Settings

Nessuna deve essere bianca/rotta. Il cambio palette (giallo heritage invece di terracotta) è atteso.

- [ ] **Step 5: Verifica alpha modifier ancora funziona**

Ispeziona un elemento con classe `bg-primary/10` (es. icon container su onboarding o settings). Computed `background-color` deve essere `hsla(51 100% 48% / 0.1)` o equivalente con giallo trasparente.

Se l'alpha modifier è rotto (si vede `#000` o colore solido): il compat shim non è stato letto. Verifica import chain in `src/index.css`.

- [ ] **Step 6: Toggle tema light → dark → light**

Clicca il toggle theme (solitamente in header o settings). Verifica:
- Background e foreground cambiano (light/dark).
- Font resta Inter Tight.
- Giallo primary resta visibile e leggibile in entrambi i mode.
- In DevTools, `<html>` mostra `data-theme` che swappa tra `"dark"` e `"light"`, e `class` include/rimuove `dark`.

- [ ] **Step 7: Screenshot before/after**

Cattura screenshot di Dashboard + Chat + Settings + un toggle dark. Salvali localmente per il PR (non committarli nel repo).

- [ ] **Step 8: Stop dev server**

`Ctrl+C` nel terminale.

---

### Task 10: Commit finale

**Files:** nessuna modifica codice.

- [ ] **Step 1: git status**

```bash
git status --short
```

Expected:
```
?? scripts/sync-bwlab-ds.sh
?? src/styles/design-primitives.css
?? src/styles/design-tokens.css
?? src/styles/shadcn-compat.css
 M index.html
 M src/contexts/ThemeContext.jsx
 M src/index.css
 M tailwind.config.js
```

- [ ] **Step 2: git diff veloce per sanity check**

```bash
git diff src/contexts/ThemeContext.jsx src/index.css tailwind.config.js index.html
```

Leggi e verifica che le modifiche siano solo quelle dei Task 4-7.

- [ ] **Step 3: Stage file specifici**

```bash
git add src/styles/design-tokens.css src/styles/design-primitives.css src/styles/shadcn-compat.css \
        scripts/sync-bwlab-ds.sh \
        src/index.css tailwind.config.js index.html src/contexts/ThemeContext.jsx
```

- [ ] **Step 4: Commit**

```bash
PATH="/home/lmassa/.nvm/versions/node/v20.19.0/bin:$PATH" git commit -m "$(cat <<'EOF'
feat(redesign): integra Design System bwlab v2 (foundations)

Foundations del redesign claudecodeui su DS bwlab v2:
- copia design-tokens.css + design-primitives.css da astro-primereact
- aggiunge shadcn-compat.css: rimappa var shadcn a HSL-triple
  derivate dai HEX del DS, preserva alpha modifier (bg-primary/10 ecc)
- index.html: attributi data-accent/bg/font/density + Google Fonts
  (Inter Tight + JetBrains Mono)
- tailwind.config.js: fontFamily sans/display/mono sui token v2
- ThemeContext: setta data-theme oltre a class dark
- scripts/sync-bwlab-ds.sh per ri-sync manuale del DS

Zero rewrite componenti. Palette primary: terracotta → giallo heritage.
Rollback via git revert di questo commit.

Spec: docs/superpowers/specs/2026-04-23-foundations-bwlab-v2-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit creato. Se husky pre-commit fallisce con `npx: not found`, verifica che il PATH sia davvero prependato (la riga sopra lo fa).

- [ ] **Step 5: Verifica log**

```bash
git log --oneline -3
```

Expected: ultimo commit è quello sopra, penultimo è `06aba8f docs(redesign): spec foundations ...`.

---

## Self-Review

**Spec coverage:**
- ✔ Decisione "copia file nel repo" → Task 1
- ✔ "Compat shim HSL-triple" → Task 3
- ✔ `data-accent/bg/font/density` default → Task 6
- ✔ Google Fonts → Task 6
- ✔ ThemeContext setAttribute → Task 7
- ✔ Tailwind config resta su `hsl(var(--*))`, aggiunge fontFamily → Task 5
- ✔ Import chain in `src/index.css` → Task 4
- ✔ Script sync opzionale → Task 2
- ✔ Criteri accettazione (font, accent visibile, dark mode, zero regressioni) → Task 9
- ✔ Rollback via single commit → Task 10

**Placeholder scan:** nessun "TBD"/"TODO"/"implement later". Ogni step contiene comando o codice completo.

**Type consistency:** i nomi var (`--primary`, `--accent-a`, `--surface-0`, ecc) sono coerenti fra spec, compat shim (Task 3) e token reference. `data-theme` è il nome usato sia nel DS v2 sia nel setAttribute del Task 7. `setAttribute('data-theme', 'dark'|'light')` accanto a `classList.add/remove('dark')` — i due sistemi coesistono come progettato.

---

## Execution Handoff

Piano completo, salvato in `docs/superpowers/plans/2026-04-23-foundations-bwlab-v2.md`. Due opzioni esecuzione:

1. **Subagent-Driven (raccomandato)** — dispatch subagent fresco per task, review fra un task e l'altro.
2. **Inline Execution** — esecuzione in questa sessione con checkpoint.

Quale approccio?
