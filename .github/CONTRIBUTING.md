# Contributing to Universal Layer Manager

Thanks for taking the time to contribute! All types of contributions are welcome.

## Code of Conduct

Everyone taking part in this project is expected to follow the [Code of Conduct](https://github.com/antarctica/universal-layer-manager/blob/main/.github/CODE_OF_CONDUCT.md).

## Questions, bugs and ideas

Search the [existing issues](https://github.com/antarctica/universal-layer-manager/issues) first. If yours isn't there, [open a new issue](https://github.com/antarctica/universal-layer-manager/issues/new/choose) using the question, bug or feature request template.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Run `npm install`.
3. Make your changes, with tests for any new behaviour.
4. Check that `npm test` and `npm run lint` pass.
5. Open a pull request.

## Commit messages

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
type(scope): description
```

A scope is required. It names the package that changed: `core`, `leaflet`, `maplibre`, `arcgis`, `openlayers`, `examples`, `repo`, or `deps`.

| Type | Use for | In the changelog |
| --- | --- | --- |
| `feat` | User-visible capability | Added |
| `fix` | Defect repair | Fixed |
| `perf` | Measurable speed or resource change | Changed |
| `revert` | Undoes an earlier commit | Changed |
| `refactor`, `test`, `docs`, `build`, `ci`, `chore` | Internal work | Not shown |

`feat` and `fix` that remove or drop something land under Removed. Mark a breaking change with `!` before the colon.

## Releases

The changelog is drafted from the commit messages:

```bash
npm run changelog:preview   # print the pending section
npm run changelog:draft     # prepend it to CHANGELOG.md
npm run version:next        # print the next version
```

Edit the drafted section before tagging. `@ulm/core`, `@ulm/leaflet`, `@ulm/maplibre`, `@ulm/arcgis` and `@ulm/openlayers` ship on the same tag, `vX.Y.Z`. `v1.0.1` and `v1.0.2` already belong to the previous single package. If `npm run version:next` prints one of those, tag the next free version instead.
