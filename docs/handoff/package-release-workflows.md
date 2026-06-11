# Handoff: GitHub Release wheels for `steelseries_gg_py` and `arctis_nova_pro_hid`

**Audience:** an agent (or developer) working inside each *package* repo — **not** the Control Centre Pro app repo.

**Why this exists:** Control Centre Pro now ships a bundled, offline Python runtime with both packages pre-installed, and its **Settings → About** page lets users update those packages in place. The in-app update flow does **not** use `git` (end-user machines don't have it). Instead it:

1. Calls `GET https://api.github.com/repos/<owner>/<repo>/releases/latest`,
2. Reads `tag_name` as the latest version,
3. Finds the release's `*.whl` asset and downloads it,
4. Runs `python -m pip install --upgrade --force-reinstall --no-deps <wheel>` into the bundled interpreter.

For that to work, **each package repo must publish a GitHub Release with a built wheel attached** whenever a new version ships.

Repos in scope:
- `hardtekpt/steelseries_gg_py` — import name `steelseries_gg`
- `hardtekpt/arctis_nova_pro_hid` — import name `arctis_hid`

---

## The contract the app relies on

The app's package manager (`src/main/services/pythonPackages.ts` in the app repo) expects, per release:

| Requirement | Detail |
|---|---|
| **Tag format** | `vX.Y.Z` (the app strips a leading `v`). Must be parseable as a dotted numeric version so "newer than installed" comparison works. |
| **`releases/latest`** | The release must be **published** (not draft/prerelease) so the GitHub "latest" endpoint returns it. |
| **Exactly one `.whl` asset** | The app picks the first asset whose name ends in `.whl`. Attach one wheel per release. |
| **Version match** | The wheel's embedded version (and the package's `importlib.metadata` version once installed) should equal the tag's version, so the About page shows "Up to date" after updating. |
| **`--no-deps` install** | The app installs with `--no-deps` (deps already present in the bundled env). If a release introduces a **new** runtime dependency, call that out in the release notes — a `--no-deps` install won't pull it, and the bundled env (rebuilt only on app releases) may lack it until then. |

---

## Step 1 — Packaging metadata checklist

Confirm each repo builds a proper wheel with a correct distribution name and version:

- A `pyproject.toml` (preferred) or `setup.py` defines:
  - `name` — the **distribution** name (e.g. `steelseries_gg` / `arctis_hid`, or whatever `pip show` currently reports; keep it stable).
  - `version` — single source of truth; ideally derived from the tag (e.g. `hatch-vcs`/`setuptools-scm`) or bumped to match the tag before tagging.
  - The import package (`steelseries_gg` / `arctis_hid`) is included via `packages`/`find`.
- Building locally produces a wheel:
  ```bash
  python -m pip install --upgrade build
  python -m build --wheel        # -> dist/<name>-<version>-py3-none-any.whl
  ```
- `arctis_nova_pro_hid` note: it depends on a native HID backend (`hidapi`). The wheel itself can stay pure-Python (`py3-none-any`) as long as `hidapi` is a normal dependency with PyPI wheels — don't vendor native binaries into this wheel.

---

## Step 2 — Drop in the release workflow

Add `.github/workflows/release.yml` to **each** repo. Pushing a `vX.Y.Z` tag builds the wheel and publishes a Release with the wheel attached.

```yaml
name: Release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

permissions:
  contents: write   # create the Release and upload assets

jobs:
  release:
    runs-on: ubuntu-latest   # pure-python wheels are platform-independent
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Build wheel
        run: |
          python -m pip install --upgrade pip build
          python -m build --wheel

      - name: Create release and upload wheel
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "${{ github.ref_name }}" dist/*.whl \
            --title "${{ github.ref_name }}" \
            --generate-notes
```

Notes:
- If a release for the tag may already exist, replace `gh release create ... dist/*.whl` with `gh release create ... || true` followed by `gh release upload "${{ github.ref_name }}" dist/*.whl --clobber`.
- Keep the tag glob (`v[0-9]+.[0-9]+.[0-9]+`) so only version tags trigger releases.
- `ubuntu-latest` is fine because the wheels are `py3-none-any`. If a repo ever ships a platform-specific wheel, build a matrix and attach each.

---

## Step 3 — Verify (per repo)

1. Bump the package `version` to a test value (e.g. `0.0.1`), commit, then:
   ```bash
   git tag v0.0.1 && git push origin v0.0.1
   ```
2. Confirm the Actions run succeeds and a **published** Release `v0.0.1` appears with a single `*.whl` asset.
3. Confirm the API the app calls returns it:
   ```bash
   curl -s https://api.github.com/repos/<owner>/<repo>/releases/latest | jq '.tag_name, (.assets[].name)'
   ```
   Expect `"v0.0.1"` and one `...whl` name.
4. Confirm the wheel installs cleanly into a clean environment (no git):
   ```bash
   python -m venv /tmp/verify && /tmp/verify/bin/pip install <wheel-asset-url>
   /tmp/verify/bin/python -c "import importlib.metadata as m; print(m.version('<dist-name>'))"
   ```
   The printed version must equal the tag.

---

## After this is live

Once both repos publish releases as above, no further change is needed in the Control Centre Pro repo — the About page's **Check for updates** will surface new versions and the **Update** button will install them. (The bundled runtime that ships in the installer is still built from these repos in the app's own `release.yml`; releasing here keeps installed apps current between app releases.)
