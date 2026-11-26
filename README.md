# Plate Calculator

A compact, client-only plate calculator for barbell warm-ups and matched dumbbell pairs. Vite, vanilla TypeScript and CSS; no runtime dependencies, backend, accounts, analytics or external requests. Inputs recalculate immediately and valid selections are remembered locally when storage is available.

[Open Plate Calculator](https://rpb33.github.io/plate-calculator/) · [GitHub repository](https://github.com/rpb33/plate-calculator)

## Local development

Use Node.js 22.12 or newer (Node 22 LTS recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Other commands:

```sh
npm test                 # Unit tests, including exhaustive optimization checks
npm run build           # TypeScript checks and production output in dist/
npm run preview         # Preview production build
npx playwright install chromium webkit
npm run test:e2e         # Chrome/Android and WebKit/iPhone browser + WCAG checks
```

Unit tests use a fixed inventory in `tests/fixtures/inventory.ts`. Browser checks compare the UI against the configured app inventory, so editing valid plate stock does not require changing test expectations.

Browser tests serve `dist/` at `/plate-calculator/`, verifying a real repository subpath. Build first. To use an existing Chrome installation locally, set `PLAYWRIGHT_CHROME_PATH` to its executable path. Automated checks complement, but do not replace, testing on physical iOS and Android devices.

## Edit your plate inventory

Replace the clearly marked **EXAMPLE INVENTORY** multiline CSV in [`src/inventory.ts`](src/inventory.ts), then rebuild. It is source configuration, not an app setting. Change the footer's example-inventory wording in `index.html` when real values are installed.

```csv
weightKg,diameterMm,color,quantity
25,50,red,2
5,30,blue,4
1.25,30,green,8
```

- `quantity` counts individual physical plates across your entire inventory.
- `weightKg` must be positive, at most 10000 kg, with up to three decimal places.
- `diameterMm` must be `30` or `50`; the selected diameter is used exclusively.
- `color` must be `red`, `green`, `blue`, `yellow`, `grey` or `black`.
- `quantity` must be a nonnegative safe integer. Zero-quantity rows are allowed.
- Multiple rows of the same weight, including different colors, are supported. Each row is a separate stock pool. Combine identical weight/diameter/color stock into one row so its plates can form complete groups.
- Malformed rows throw a developer error naming the CSV line and invalid field. Blank data rows and CRLF are supported; no quoted CSV fields are needed.

## How loading is calculated

The four independent stages request 50%, 70%, 90% and 100% of the **full target including the bar**, for 5, 3, 1–2 reps and the target set respectively. Inventory is available afresh for every stage.

Barbell mode uses two identical physical plates per increment and shows plates **per side**. Dumbbell mode reserves four identical physical plates per increment to load a matched pair, and shows plates **per end of one dumbbell**. Its target, bar and achieved weights always describe **one dumbbell**. For both modes the displayed total is `bar + 2 × plates on one end`.

The exact bounded knapsack solver keeps the best configuration at each reachable per-end weight, processing one inventory row at a time and enumerating its allowed counts. A new state map at each row prevents accidental stock reuse. It maximizes achieved total without exceeding the requested target, then minimizes physical plate count, then prefers heavier plates and original CSV order. This solves cases where greedy loading fails (for example, one 6 kg plate versus two 4 kg plates per side for a 16 kg total).

Inputs and inventory use integer grams. Stage requests and differences use integer hundredths of a gram so percentage calculations never round upward; comparison and optimization use integers throughout. Inputs accept a decimal point or comma, up to three decimal places, between 0 and 10000 kg (target must be positive). Supporting values preserve any fractional-gram stage request. A bar above the requested stage is “Not achievable”; an empty bar is otherwise valid. Runtime scales with reachable weight sums and available row counts; normal home-gym inventories are small.

## Install and use offline

Open [the live app](https://rpb33.github.io/plate-calculator/) once while online, then install it:

- **iPhone/iPad:** In Safari, open **Share → Add to Home Screen** and confirm. Enable **Open as Web App** if offered.
- **Android:** Use **Install app** when shown, or Chrome's menu → **Add to Home screen / Install app**.
- **Desktop:** Use the browser's install icon or the app's **Install app** button when available.

After its first successful online load, the complete calculator and selected inventory are cached. You can reopen and reload it offline; valid weights and equipment selections remain on that device. Clearing site data removes the offline cache and saved selections. HTTPS is required on a deployed host; localhost also supports PWA testing.

A new deployment downloads a complete new cache in the background. **Update app** appears when it is ready; selecting it reloads with the new version and inventory, preserving saved settings. Closing all app windows also allows a waiting update to activate. Caches are scoped to this repository so other apps on the same GitHub Pages domain are unaffected.

Service workers are enabled only in production builds. For a local PWA preview, run `npm run build` followed by `npm run preview`, open its URL, wait for the first load, then test offline in browser developer tools. `npm run dev` keeps Vite's normal uncached development behavior.

The manifest is `public/manifest.webmanifest`. Install icons derive from `public/favicon.svg`; regenerate them with `node scripts/generate-icons.mjs` after installing Playwright Chromium. The Vite build creates `dist/sw.js` with a content-derived cache version and the complete asset list, so inventory and asset changes are included automatically. No new dependencies are required.

## GitHub and deployment

The repository includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). On a push to `main` or a manual dispatch, it runs `npm ci`, unit tests, TypeScript checks, the production build and browser/accessibility tests, then deploys `dist/` using the official GitHub Pages actions. The workflow declares Pages permissions, deployment environment and concurrency. Vite's `base: './'` makes assets work under repository subpaths.

If the repository is not yet connected to GitHub:

1. Create an empty GitHub repository named `plate-calculator` (public for free GitHub Pages); do not add a README or `.gitignore` remotely.
2. Authenticate Git locally. From this project directory, connect and push the existing local commit (replace `YOUR_USERNAME`):

   ```sh
   git remote add origin https://github.com/YOUR_USERNAME/plate-calculator.git
   git push -u origin main
   ```

3. In the GitHub repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Open **Actions → Test and deploy to GitHub Pages → Run workflow**, select `main`, and run it. This also retries an initial run that started before Pages was enabled.
5. Wait for the `build` and `deploy` jobs to succeed. Open the deployment URL shown in the workflow, normally `https://YOUR_USERNAME.github.io/plate-calculator/`.

With GitHub CLI installed and authenticated, repository creation can alternatively use `gh repo create plate-calculator --public --source=. --remote=origin --push`. Enable Pages using `gh api --method POST repos/YOUR_USERNAME/plate-calculator/pages -f build_type=workflow`, then `gh workflow run deploy.yml`.

No repository or live deployment is implied by these example URLs. The app requires a static HTTP(S) host; opening `index.html` directly via `file://` is not supported.
