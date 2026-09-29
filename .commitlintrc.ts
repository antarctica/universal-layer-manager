// Conventional Commits (https://www.conventionalcommits.org/en/v1.0.0/).
// Scopes are the changelog's grouping key — see cliff.toml.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Subject line budget: `type(scope): description` within 72 characters.
    'header-max-length': [2, 'always', 72],

    'type-enum': [
      2,
      'always',
      [
        'feat', // user-visible capability
        'fix', // defect repair
        'perf', // measurable speed or resource change
        'refactor', // behaviour-preserving restructure
        'test', // tests only
        'docs', // documentation only
        'build', // package builds and dependency manifests
        'ci', // GitHub Actions and repo tooling
        'chore', // housekeeping with no runtime effect
        'revert', // undoes an earlier commit
      ],
    ],

    // One package (or shared concern) per commit.
    'scope-enum': [
      2,
      'always',
      [
        'core', // packages/core
        'leaflet', // packages/leaflet
        'examples', // examples/
        'repo', // hooks, root config, README, CHANGELOG
        'deps', // lockfile and dependency bumps
      ],
    ],
    'scope-empty': [2, 'never'],
  },
};
