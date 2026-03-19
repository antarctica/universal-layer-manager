import antfu from '@antfu/eslint-config';

export default antfu(
  {
    typescript: true,
    react: true,
    ignores: [
      '.github',
      'dist',
      'node_modules',
      'README.md',
    ],
  },
  {
    rules: {
      'react-refresh/only-export-components': 'off',
      'style/brace-style': ['error', '1tbs'],
      'style/arrow-parens': ['error', 'always'],
      'curly': ['error', 'all'],
      'antfu/consistent-list-newline': 'off',
      'no-console': 'off',
      'style/semi': ['error', 'always'],
      'style/member-delimiter-style': ['error', { multiline: { delimiter: 'semi' } }],
    },
  },
  {
    files: ['package.json'],
    rules: {
      'style/eol-last': 'off',
    },
  },
);
