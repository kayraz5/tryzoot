# Migration metadata

These files are intentional migration inputs. They are kept under `tests/migration/`, which is outside the Vitest specification globs and the root `e2e/` Playwright test directory.

## Path and enum rules

- Every path is repository-relative and uses POSIX separators (`/`), including on Windows.
- `inventory.json` is the source of truth for specification, support, cleanup, and production-baseline records.
- The allowed specification classifications are `model`, `view`, `controller`, `api`, `integration-support`, and `playwright`.
- The allowed runners are `vitest:unit`, `vitest:supabase`, `vitest:integration-support`, `playwright:chromium`, `playwright:firefox`, `playwright:webkit`, and `playwright:supabase`.
- Vitest destinations must be under one of the five `allowedVitestDestinations` roots in `inventory.json`.
- A `playwright` specification must retain a destination under `e2e/`.
- Empty record arrays are intentional until the later inventory and baseline-capture tasks enumerate the repository.

## `inventory.json`

The inventory has these top-level fields:

- `schemaVersion`: integer metadata format version.
- `metadataType`: `migration-inventory`.
- `status`: capture state, initially `pending-enumeration`.
- `pathFormat`: `repository-relative-posix`.
- `allowedVitestDestinations`: closed list of permitted Vitest destination roots.
- `allowedClassifications`: closed list of specification classifications.
- `allowedRunners`: closed list of runner assignments.
- `playwrightRoot`: retained browser-test root, `e2e`.
- `assertionManifest` and `productionBaselineManifest`: paths to the companion manifests.
- `specifications`: one `SpecificationRecord` for every current Vitest or Playwright specification.
- `support`: one `SupportRecord` for every retained or moved reusable support module.
- `cleanup`: one `CleanupRecord` for every scoped generated or migration-only artifact.
- `productionBaseline`: the same production hash records captured in the companion production manifest, retained here for inventory completeness.

Each `SpecificationRecord` contains:

```json
{
  "source": "src/__tests__/example.spec.js",
  "destination": "tests/unit/model/example.spec.js",
  "classification": "model",
  "primarySubject": "src/model/example.js",
  "runner": "vitest:unit",
  "serviceGated": false,
  "sourceAssertions": ["suite:test case:assertion group"],
  "destinationAssertions": ["suite:test case:assertion group"],
  "rewrites": ["old/import.js -> new/import.js"],
  "defects": []
}
```

`source` and `destination` are exact file paths. `sourceAssertions` and `destinationAssertions` contain normalized assertion identities from `baseline-assertions.json`. `rewrites` records only path or configuration corrections required by relocation. `defects` records an observed production or test defect without weakening the specification.

Each `SupportRecord` contains `source`, `destination`, `consumers`, `directRunnerReference`, and `retained`. A support path must have at least one consumer or an explicit direct-runner reference. Root `e2e/` support remains retained in place.

Each `CleanupRecord` contains `path`, `kind`, `scope`, and `action`. Only records with `scope: "cleanup-artifact"` and `action: "remove"` authorize removal. Reusable support and fixtures are never cleanup-scoped.

Each production baseline record contains `path` and `sha256`. The path must be under `src/` or `api/`.

## `baseline-assertions.json`

The assertion manifest captures the pre-migration normalized test contract. Each record contains:

```json
{
  "source": "src/__tests__/example.spec.js",
  "destination": "tests/unit/model/example.spec.js",
  "runner": "vitest:unit",
  "testCases": [
    {
      "identity": "suite:test case",
      "assertionGroups": [
        {
          "identity": "suite:test case:assertion group",
          "kind": "toEqual"
        }
      ]
    }
  ]
}
```

`testCases` and `assertionGroups` are normalized identities used to compare source and destination assertions. Playwright records retain their `e2e/` source and destination paths.

## `baseline-production.json`

The production baseline records SHA-256 content hashes captured before migration:

```json
{
  "path": "src/App.vue",
  "sha256": "<64 lowercase hexadecimal characters>"
}
```

The manifest covers every tracked file under `src/` and `api/`. It contains no source content or environment values. An owner-approved production defect is recorded in the corresponding inventory record rather than by changing a hash.
