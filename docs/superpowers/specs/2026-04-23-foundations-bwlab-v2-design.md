# Foundations — Design System bwlab v2 in claudecodeui

**Data**: 2026-04-23
**Sub-progetto**: 1 di 6 del redesign claudecodeui
**Stato**: spec

## Contesto

`claudecodeui` è una web UI React (Vite + Tailwind 3.4) per Claude Code CLI. Usa sistema token stile shadcn (`--primary`, `--background`, ...) con palette warm terracotta e theme switch `.dark` class su `<html>`.

Il "Nuovo Design bwlab v2" vive nel repo `astro-primereact` come Design System token-based: 3 palette accent (signal/heritage/lab), 2 colori brand Heritage (giallo `#F5D000` + rosso `#E30613`), tipografia Inter Tight + JetBrains Mono, switch runtime tramite `data-theme/accent/bg/font/density` su `<html>`. Primitives CSS pure (`.btn .card .badge .input .alert .field .switch .accordion`).

Questo spec copre il sub-progetto 1 **Foundations**: portare token + primitives del DS v2 dentro claudecodeui come base, senza toccare componenti UI esistenti. I sub-progetti successivi (Shell, Main content, Chat/Shell/Editor, Settings, Polish) useranno queste fondamenta.

## Obiettivo

Integrare DS v2 in claudecodeui in modo che:

- I token CSS v2 sono disponibili a livello globale.
- La palette attuale (warm terracotta) viene rimpiazzata dalla palette heritage (giallo + rosso) senza rewrite dei componenti shadcn esistenti.
- I font DS (Inter Tight + JetBrains Mono) sostituiscono i font attuali.
- Theme switch light/dark continua a funzionare come prima.
- Le primitives v2 (`.btn .card ...`) diventano disponibili per i sub-progetti successivi e per nuovo codice.
- Zero migrazione di componenti in questo step. Rollback in un `git revert`.

## Non-goal (scope lock)

- No rewrite componenti shadcn (`Button`, `Card`, `Input`, `Dialog`, ...).
- No migrazione Sidebar/Dashboard/Chat a primitives v2.
- No nuova UI Settings per switch runtime di accent/bg/font/density (arriverà nel sub-progetto Settings).
- No upgrade a Tailwind 4.
- No distribuzione DS come pacchetto npm (valutato per futuro; per ora copia file).

## Decisioni

| Decisione | Scelta | Note |
|---|---|---|
| Distribuzione DS | Copia file nel repo | Velocità, DS ancora in evoluzione. Migrare a pacchetto npm `@bwlab/design-system` quando DS stabile. |
| Coabitazione con shadcn | Compat shim (`shadcn-compat.css`) — HSL-triple duplicati dal DS v2 | Zero rewrite componenti, preserva supporto alpha (`bg-primary/10`). Sync manuale DS→shim. |
| Tailwind | Resta 3.4 | Upgrade a 4 è progetto separato. |
| `data-theme` default | Gestito da `ThemeContext` esistente (light/dark + system) | Nessun cambio UX theme. |
| `data-accent` default | `heritage` | Brand bwlab. Hard-coded su `<html>` in `index.html`. |
| `data-bg` default | `flat` | App-like, no distrazione su chat/shell/code. |
| `data-font` default | `inter` | Default DS. |
| `data-density` default | `normal` | Safe default. |
| Font loading | Google Fonts `<link>` in `index.html` | Coerente con astro-primereact. |

## Architettura

### File nuovi

```
src/styles/
├─ design-tokens.css        (copia 1:1 da astro-primereact/src/styles/)
├─ design-primitives.css    (copia 1:1 da astro-primereact/src/styles/)
└─ shadcn-compat.css        (nuovo — rimappa var shadcn → var v2)
```

### File modificati

- `src/index.css` — prepend import chain DS.
- `tailwind.config.js` — aggiunta `fontFamily` mapping ai token v2. Color entries restano invariate (HSL-triple via compat).
- `index.html` — `<html data-accent="heritage" data-bg="flat" data-font="inter" data-density="normal">` + link Google Fonts.
- `src/contexts/ThemeContext.jsx` — accanto a `classList.add('dark')` setta `setAttribute('data-theme', ...)`.

### Import chain (`src/index.css`)

```css
@import "./styles/design-tokens.css";
@import "./styles/design-primitives.css";
@import "./styles/shadcn-compat.css";
@tailwind base;
@tailwind components;
@tailwind utilities;
/* resto css esistente */
```

Ordine: token prima, primitives dopo (leggono token), compat dopo (rimappa shadcn var ai token v2), Tailwind ultimo (utility leggono le var compat-mapped).

### Compat shim (`src/styles/shadcn-compat.css`)

Shadcn + Tailwind richiedono che le var colore siano in formato HSL-triple (senza `hsl()`), per preservare l'alpha modifier (`bg-primary/50` → `hsl(var(--primary) / 0.5)`). Il codebase usa questa sintassi in 400+ punti.

Il DS v2 espone i colori in HEX. Il compat shim **duplica** i valori come HSL-triple, sincronizzati manualmente dal DS.

```css
:root,
html[data-theme="light"] {
  --background: 0 0% 98%;         /* #fafafa  — surface-0 light */
  --foreground: 240 14% 5%;       /* #0b0b0e  — fg-1 light */
  --card: 0 0% 100%;              /* #ffffff  — surface-1 */
  --card-foreground: 240 14% 5%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 14% 5%;
  --primary: 51 100% 48%;         /* #F5D000  — heritage-a */
  --primary-foreground: 240 7% 3%;/* #070708  — ink-950 */
  --secondary: 220 13% 97%;       /* #f5f6f8  — surface-2 */
  --secondary-foreground: 240 10% 18%;
  --muted: 220 13% 97%;
  --muted-foreground: 232 7% 35%; /* #54545e  — fg-3 */
  --accent: 355 94% 46%;          /* #E30613  — heritage-b */
  --accent-foreground: 0 0% 100%;
  --destructive: 3 100% 62%;      /* #FF453A  — state-danger */
  --destructive-foreground: 0 0% 100%;
  --border: 0 0% 0%;              /* border-1 è alpha su nero; tailwind userà alpha modifier proprio */
  --input: 0 0% 0%;
  --ring: 51 100% 48%;
  --radius: 0.5rem;
}

html[data-theme="dark"],
html.dark {
  --background: 240 9% 6%;        /* #0d0d10  — ink-900 */
  --foreground: 220 17% 94%;      /* #eceef2  — fg-1 dark */
  --card: 240 13% 9%;             /* #141418  — ink-850 */
  --card-foreground: 220 17% 94%;
  --popover: 240 13% 9%;
  --popover-foreground: 220 17% 94%;
  --primary: 51 100% 48%;
  --primary-foreground: 240 7% 3%;
  --secondary: 240 11% 12%;       /* #1a1a20 */
  --secondary-foreground: 220 17% 94%;
  --muted: 240 11% 12%;
  --muted-foreground: 232 10% 65%;
  --accent: 355 94% 46%;
  --accent-foreground: 0 0% 100%;
  --destructive: 3 100% 62%;
  --destructive-foreground: 0 0% 100%;
  --border: 0 0% 100%;            /* border chiaro su dark, alpha via tailwind */
  --input: 0 0% 100%;
  --ring: 51 100% 48%;
}
```

Note:
- Valori HSL-triple calcolati dagli HEX DS v2. Documentati con commento HEX di origine per il sync manuale.
- `--border` / `--input` sono definiti su nero (light) / bianco (dark). I componenti shadcn usano già `border-border/50` o simili, l'alpha modifier genera la trasparenza.
- Sia `html[data-theme="dark"]` che `html.dark` presenti: theme context setta entrambi, i componenti shadcn con `dark:*` usano `.dark` class.

### Sync script (opzionale)

Uno script `scripts/sync-bwlab-ds.sh` può copiare `design-tokens.css` + `design-primitives.css` dal DS e **segnalare** (non aggiornare) se `shadcn-compat.css` va revisionato. Aggiornamento HSL resta manuale perché richiede conversione HEX→HSL.

```bash
#!/usr/bin/env bash
set -euo pipefail
DS=/media/extra/Progetti/astrojs-primereact/CascadeProjects/windsurf-project/astro-primereact/src/styles
cp "$DS/design-tokens.css" src/styles/design-tokens.css
cp "$DS/design-primitives.css" src/styles/design-primitives.css
echo "DS synced. Verifica manuale shadcn-compat.css se DS ha cambiato surface-*/fg-*/border-*/accent-*."
```

### Tailwind config patch

`tailwind.config.js` **resta invariato** (`hsl(var(--primary) / <alpha-value>)` ecc), perché il compat shim fornisce HSL-triple.

Aggiungere font-family mapping:

```js
theme: {
  extend: {
    fontFamily: {
      sans: "var(--font-sans)",
      display: "var(--font-display)",
      mono: "var(--font-mono)",
    },
    // ...resto extend esistente
  }
}
```

### `index.html`

```html
<html lang="en" data-accent="heritage" data-bg="flat" data-font="inter" data-density="normal">
  <head>
    ...
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  </head>
</html>
```

### ThemeContext

Patch minimo: nel branch che aggiunge/rimuove `.dark` class, settare anche `document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')`. Nessun'altra modifica alla logica theme.

## Testing

### Automatico

- `bun run typecheck` — nessun nuovo errore.
- `bun run lint` — clean.
- `bun run build` — bundle produce. Verifica nel CSS finale che `--accent-a: #F5D000` sia presente.

### Manuale

1. `bun run dev` → app parte senza errori console.
2. Smoke-check: Dashboard, Chat, Shell, Settings, Git panel. Nessuna pagina rotta visivamente.
3. Palette primary passa da terracotta (arancione/rosa) a giallo heritage (`#F5D000`): visibile su bottoni primari, focus ring, link attivi.
4. Font passa a Inter Tight (UI) e JetBrains Mono (code/terminal).
5. Theme toggle light/dark → entrambi rendono coerenti, no contrast grossi.
6. Screenshot before/after di 3-4 viste chiave allegate al PR.

### Criteri accettazione

- [ ] Token v2 presenti nel bundle CSS finale.
- [ ] Font Inter Tight + JetBrains Mono renderizzati.
- [ ] Accent heritage giallo visibile su primary shadcn.
- [ ] Dark mode funzionante come prima (nessuna regressione theme).
- [ ] Zero regressioni UI visibili (palette cambiata è comportamento atteso).

## Rollback

Tutto vive in: 3 file nuovi (`design-tokens.css`, `design-primitives.css`, `shadcn-compat.css`), 1 script opzionale (`scripts/sync-bwlab-ds.sh`), 4 modifiche (`index.css`, `tailwind.config.js`, `index.html`, `ThemeContext.jsx`). Un commit singolo → `git revert <sha>` ripristina lo stato precedente.

## Aggiornamenti futuri al DS

Sync via `scripts/sync-bwlab-ds.sh` (vedi sopra). Aggiornamento `shadcn-compat.css` resta manuale (conversione HEX→HSL). Quando DS si stabilizza, migrare a pacchetto `@bwlab/design-system` versionato (fuori scope foundations).

## Open questions

Nessuna. Tutte le decisioni chiuse con l'utente durante il brainstorming.

## Prossimi sub-progetti (reference)

1. **Foundations** — questo spec.
2. **Shell globale** — App layout, Sidebar, toolbar.
3. **Main content pattern** — breadcrumb, filtri, lista card (riferimento screenshot `bwlab Preferiti`).
4. **Chat / Shell / Editor** — armonizzazione componenti core.
5. **Settings / Wizard / Panel** — form + modal + UI per switch runtime accent/bg/density.
6. **Polish** — empty states, toast, onboarding, loading.
