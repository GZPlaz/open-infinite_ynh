# OpenInfinite

An open-source, self-hostable generator of printable math worksheets with answer keys and worked solutions. It covers the same ground as Kuta Software's Infinite series: Pre-Algebra, Algebra 1 & 2, Geometry, Precalculus and Calculus.

Everything happens **in the browser**: problem generation, step-by-step solutions, figures, page layout and PDF export. The server only hands out static files, so a Raspberry Pi running nginx is plenty. This repository is also a ready-to-install **YunoHost package**.

![Answer key view with worked solutions](doc/screenshots/answer-key.png)

## Features

| Area | What you get |
| --- | --- |
| **Topics** | 24 topic generators in 6 subjects (see below). Each has Easy / Medium / Hard tiers and its own options, e.g. integer vs. fractional answers, negative numbers, rounding vs. exact (radical/π) form, units, special cases. |
| **Formats** | Free response or multiple choice. Distractors are built from typical mistakes (sign errors, forgetting to distribute, wrong formula…). |
| **Layout** | 1, 2 or 3 columns; work space under each problem (none → XL); Name / Date / Period / Score fields; title and subtitle; US Letter or A4; text size; page numbers. |
| **Editing** | Regenerate everything (new seed) or a single problem; reorder by drag-and-drop or ↑/↓; edit any question, answer, choice or solution step by hand (LaTeX between `$…$`); delete; undo/redo. |
| **Answer key** | One click between the student sheet and the key: answers in red, the correct choice circled, optional worked solutions, solved graphs/figures (number lines, transformed triangles). |
| **Export** | Browser printing with exact page breaks and no UI chrome; client-side **PDF** (jsPDF + html2canvas); **LaTeX** (.tex with TikZ figures, compiles with pdflatex); **JSON** worksheet files. |
| **Storage** | Autosave plus a "My worksheets" library in the browser (localStorage). JSON files move worksheets between devices. Nothing is stored on the server. |
| **Offline** | A service worker caches the app shell, so it keeps working without a network once loaded. |

### Topics

| Subject | Topics |
| --- | --- |
| Pre-Algebra | Order of operations · Operations with fractions and mixed numbers · Two-step equations |
| Algebra 1 | Multi-step linear equations · Multi-step and compound inequalities (with number-line graphs) · Systems of equations (elimination / substitution) · Adding, subtracting and multiplying polynomials · Factoring (trinomials, GCF, difference of squares) · Properties of exponents · Simplifying radicals |
| Algebra 2 | Quadratic formula (rational, irrational and complex roots) · Matrix operations (sums, products, determinants, inverses) |
| Geometry | Pythagorean theorem · Right-triangle trigonometry · Area and perimeter · Volume and surface area · Angle relationships · Distance, midpoint and slope · Transformations on the coordinate plane |
| Precalculus | Arithmetic and geometric sequences and series · Vectors |
| Calculus | Limits · Derivatives (power, product, quotient, chain rules; optional trig/exp/log) · Integrals (power rule, definite, u-substitution) |

## How it works

```
app/src/engine/          pure TypeScript, no DOM: runs in browsers and in the test-suite
  types.ts               TopicGenerator / ProblemContent contracts
  rng.ts                 seeded PRNG: every problem keeps the 32-bit seed it came from
  fraction.ts            exact rational arithmetic (answer keys never see floating-point drift)
  polynomial.ts, radical.ts, tex.ts
  diagram.ts             figures as primitives → SVG on screen, TikZ in LaTeX
  worksheet.ts           sections, seeds, deduplication, multiple-choice assembly
  topics/<subject>/*.ts  topic generators; every `export const x = defineTopic(...)` is picked up automatically
  topics/packs/*.ts      curriculum order of the topic picker (optional: unlisted topics are appended)
  export/                JSON and LaTeX
app/src/components/      React UI; worksheet/Worksheet.tsx paginates into real pages

manifest.toml, conf/, scripts/, doc/, tests.toml   the YunoHost package (repository root)
tools/                   release archive, manifest sync, nginx test harness
```

A topic generator is a pure function of a seeded RNG, a difficulty and its options:

```ts
export interface TopicGenerator {
  id: string;                    // saved in worksheet files
  subject: SubjectId;
  title: string;
  description: string;
  instruction: string | ((options: OptionValues) => string);   // "Solve each equation."
  options: readonly OptionDef[]; // checkboxes / selects shown in the UI
  multipleChoice: boolean;       // true when generate() always returns ≥ 3 distractors
  defaultCount: number;
  generate(ctx: { rng: Rng; difficulty: Difficulty; options: OptionValues }): ProblemContent;
}

export interface ProblemContent {
  question: RichText;            // text with inline LaTeX: "Solve $2x + 3 = 7$."
  answer: RichText;
  steps?: RichText[];            // worked solution, one line per step
  distractors?: RichText[];      // wrong answers for multiple choice
  diagram?: Diagram;             // figure for the question
  answerDiagram?: Diagram;       // figure for the key (e.g. a graphed solution)
  check?: Record<string, unknown>; // machine-checkable facts for the tests
}
```

Generators build each problem backwards from its answer. For example, `topics/algebra1/linear-multistep.ts` picks an equation shape and its coefficients, picks the solution (an integer, or a fraction whose denominator divides the net coefficient), then solves for the one remaining constant. Rejection sampling enforces the options: signs, sizes, and "no solution / all real numbers" cases. `topics/algebra2/quadratic-formula.ts` builds rational roots from linear factors, or draws coefficients with the right discriminant. It then simplifies `(-b ± √D) / 2a` completely (radical, common factor, sign, `i` for complex roots).

**Pagination.** Every block (header, section heading, row of problems) is first rendered into an invisible column at the page's content width. The measured heights are then packed into fixed-size pages. The screen preview, browser printing and the PDF export all use these same pages, so page breaks always match.

**PDF.** Each page is rasterised by html2canvas at 2× and placed full-bleed on a jsPDF page. Both libraries are loaded only when you export. For vector output, use *Print → Save as PDF* or the LaTeX export.

## How the answer keys are verified

Answer keys are the product, so they are tested end to end against the *rendered* strings, not the generator's internal values:

- `tests/evaluator.ts` is a small evaluator for the LaTeX subset the generators emit (fractions, radicals, powers, `±`, trig, `e`, `ln`, absolute values, complex numbers).
- `tests/verify.ts` checks every problem kind independently. Solutions are substituted back into the question. Factorisations and simplifications are compared numerically at sample points. Derivatives are checked by numeric differentiation and integrals by Simpson's rule. Areas come from the shoelace formula on the figure's vertices. Transformations are re-applied with rotation matrices.
- `tests/topics.test.ts` fuzzes **every topic × difficulty × option variant** (120 seeds each by default; `FUZZ_SEEDS=600 npm test` for a deep run). It also renders every question, answer, step and distractor with KaTeX (any parse error fails the test), checks that multiple-choice options are distinct, and rejects formatting slips such as `+ -3`, `1x`, `x^{1}` or `· -2`.
- `e2e/smoke.mjs` drives the production build in headless Chromium: it adds all topics, paginates, edits, drags and drops, undoes, prints, exports PDF/LaTeX/JSON, re-imports, reloads, and checks the phone layout.

The LaTeX export has also been compiled with pdflatex for every topic, difficulty and format.

## Development

Requires Node.js 22.12 or newer (CI uses 22.22).

```sh
cd app
npm ci
npm run dev          # http://localhost:5173
npm test             # unit tests + answer-key fuzzing
npm run typecheck
npm run build        # → app/dist (static files)
npm run e2e          # end-to-end test of app/dist in headless Chromium (set CHROMIUM_PATH if needed)
```

To add a topic, create `app/src/engine/topics/<subject>/<name>.ts` exporting `defineTopic({...})`, register it in `topics/index.ts`, and give its problems a `check` that `tests/verify.ts` can verify. The fuzz test picks it up automatically.

## Self-hosting

### YunoHost

The repository root is the YunoHost package (packaging v2, helpers 2.1, YunoHost ≥ 12). Install it from the `main` branch:

```sh
sudo yunohost app install https://github.com/GZPlaz/open-infinite_ynh/tree/main
```

or paste `https://github.com/GZPlaz/open-infinite_ynh/tree/main` into *Applications → Install → Install custom app* in the webadmin. You will be asked for a domain, a path (default `/openinfinite`), who may access it (default: visitors) and the default paper size for new worksheets.

> **Branch names.** YunoHost reads only the part of the default branch name before the first `/`, so a repository whose default branch is e.g. `claude/some-feature` fails with *"Could not fetch source files, is the URL correct?"*. Install from `…/tree/main` (as above), or make `main` the default branch on GitHub so the plain repository URL works too.

| Script | Action |
| --- | --- |
| `install` | Downloads the pre-built release archive pinned in `manifest.toml` (sha256-checked), unpacks it to `/var/www/$app`, writes `config.json` from the settings, sets permissions (`$app:www-data`, 750/640) and adds the nginx config. No Node.js, no build. |
| `upgrade` | Fills in settings introduced by newer versions (`ynh_app_setting_set`), replaces the files with the new release (`--full_replace`, since bundle names are content-hashed), rewrites `config.json` and the nginx config. |
| `backup` / `restore` | The app directory and its nginx config. There is no server-side user data. |
| `change_url` | Moves the nginx config. Asset URLs are relative and nginx injects `<base href>` for the new path, so no files change. |
| `remove` | Removes the nginx config; YunoHost removes the directory, system user and permissions (manifest resources). |

`conf/nginx.conf` serves the app with an SPA fallback for client-side routes; a `<base href="__PATH__/">` injected with `sub_filter`, so deep links resolve assets from the app root; `Cache-Control: no-cache` on `index.html`, `sw.js` and `config.json`; one-year `immutable` caching for the content-hashed bundles and KaTeX fonts; and `gzip_static on`, so the `.gz` files produced at build time are served instead of compressing on every request.

YunoHost packaging v2 reads `manifest.toml`. `manifest.json` is an exact JSON mirror of it, generated by `tools/sync_manifest.py` (CI checks that they match). Edit the TOML and regenerate the JSON. Administration notes are in [doc/ADMIN.md](doc/ADMIN.md).

Package tests:

- `tools/test-nginx.sh /openinfinite` and `tools/test-nginx.sh /` render `conf/nginx.conf` the way `ynh_config_add_nginx` does, serve the real build through nginx and check redirects, the base tag, deep links, `gzip_static`, cache headers and 404s (runs in CI).
- The scripts are linted with shellcheck in CI.
- `tests.toml` declares the default [package_check](https://github.com/YunoHost/package_check) scenarios with the non-default A4 paper size.

### Any static web server

`app/dist` (or a release archive) is a set of static files that works from any sub-path. For client-side routing on deep links, serve `index.html` for unknown paths and add `<base href="/your/path/">`. The YunoHost nginx config does both and is a good template.

## Releasing

1. Bump `version` in `app/package.json` and push a tag `vX.Y.Z`, or create the release in the GitHub UI (which pushes the tag).
2. `.github/workflows/release.yml` builds a reproducible `openinfinite-X.Y.Z.tar.gz` and attaches it to the release, creating the release if needed. It then points `manifest.toml` (and `manifest.json`) at the new archive and its sha256, on the default branch.

If a release exists without its archive, run *Actions → Release → Run workflow* with its tag. `tools/build-release.sh --update-manifest` does the same build locally. The archive is byte-for-byte reproducible, so CI and local builds of the same commit share a checksum. The manifest also declares `autoupdate.strategy = "latest_github_release"` for the YunoHost catalog's auto-updater.

## License

MIT — see [LICENSE](LICENSE). Kuta Software and Infinite Algebra are trademarks of their owners; OpenInfinite is an independent project and is not affiliated with them.
