const tseslint = require('typescript-eslint');
const { LintGolem } = require('@magik_io/lint_golem');

module.exports = tseslint.config(
  ...new LintGolem({
    rootDir: __dirname,
    tsconfigPaths: ['tsconfig.json'],
    disabledRules: [
      'n/no-unpublished-import',
      'n/no-unpublished-require',
      '@typescript-eslint/no-require-imports',
      '@typescript-eslint/no-var-requires',
      'n/hashbang'
    ]
  }).config
)
