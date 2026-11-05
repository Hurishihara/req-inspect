import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import prettier from 'eslint-config-prettier'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const boundaryElements = [
  { type: 'domain', pattern: 'packages/core/src/domain/**' },
  { type: 'store', pattern: 'packages/core/src/store/**' },
  { type: 'capture', pattern: 'packages/core/src/capture/**' },
  { type: 'server', pattern: 'packages/core/src/server/**' },
  { type: 'support', pattern: 'packages/core/src/support/**' },
  { type: 'composition', pattern: 'packages/core/src/inspector.ts', mode: 'file' },
  { type: 'entry', pattern: 'packages/core/src/index.ts', mode: 'file' },
  { type: 'adapter', pattern: 'packages/express/src/**' },
  { type: 'dashboard', pattern: 'packages/dashboard/src/**' },
]

// Boundary rules are registered but disabled; they are enabled in a later task.
const boundaryRulesOff = Object.fromEntries(
  Object.keys(boundaries.rules).map((name) => [`boundaries/${name}`, 'off']),
)

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/core/dist/ui/**',
      '.superpowers/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          // Config files outside every tsconfig are linted through the default project.
          allowDefaultProject: ['packages/*/tsup.config.ts', 'packages/dashboard/vite.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'import-x': importX, boundaries },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
      'boundaries/elements': boundaryElements,
    },
    rules: {
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      '@typescript-eslint/method-signature-style': ['error', 'property'],
      '@typescript-eslint/consistent-type-imports': 'error',
      'import-x/no-cycle': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling']],
          'newlines-between': 'always',
        },
      ],
      ...boundaryRulesOff,
    },
  },
  {
    files: ['packages/dashboard/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
    plugins: { 'react-refresh': reactRefresh },
    rules: { 'react-refresh/only-export-components': 'warn' },
  },
  {
    files: ['**/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  prettier,
)
