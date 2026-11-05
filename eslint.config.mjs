import { builtinModules } from 'node:module'

import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import prettier from 'eslint-config-prettier'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// `mode: 'file'` is deliberate: single files only match with it in eslint-plugin-boundaries 7.x,
// despite the deprecation warning.
const boundaryElements = [
  // Declared before `domain` so the public type file is its own element (first match wins).
  { type: 'domain-types', pattern: 'packages/core/src/domain/types.ts', mode: 'file' },
  { type: 'domain', pattern: 'packages/core/src/domain/**' },
  { type: 'store', pattern: 'packages/core/src/store/**' },
  { type: 'capture', pattern: 'packages/core/src/capture/**' },
  { type: 'server', pattern: 'packages/core/src/server/**' },
  { type: 'support', pattern: 'packages/core/src/support/**' },
  { type: 'composition', pattern: 'packages/core/src/inspector.ts', mode: 'file' },
  { type: 'entry', pattern: 'packages/core/src/index.ts', mode: 'file' },
  { type: 'dashboard', pattern: 'packages/dashboard/src/**' },
  // Every other package is an adapter, so a new one is covered without touching this config.
  { type: 'adapter', pattern: 'packages/*/src/**' },
]

const layerPolicies = [
  ['domain', ['domain', 'domain-types', 'support']],
  ['domain-types', []],
  ['store', ['store', 'domain', 'domain-types', 'support']],
  ['capture', ['capture', 'domain', 'domain-types', 'support']],
  ['server', ['domain', 'domain-types', 'store', 'support', 'server']],
  ['support', ['support']],
  ['composition', ['domain', 'domain-types', 'store', 'capture', 'server', 'support']],
  ['entry', ['composition', 'domain-types']],
].map(([from, to]) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: to } } },
}))

const coreSubpathPatterns = [
  {
    group: ['@req-inspect/core/*'],
    message: 'Import only from the @req-inspect/core entry point, never from its subpaths.',
  },
]

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'packages/core/dist/ui/**', '.superpowers/**', 'docs/**'],
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
      // Required by eslint-plugin-boundaries to resolve `.js` imports to `.ts`; import-x uses resolver-next.
      'import/resolver': { typescript: true },
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
      'boundaries/dependencies': ['error', { default: 'disallow', policies: layerPolicies }],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: { 'boundaries/no-unknown-files': 'error' },
  },
  {
    files: ['packages/core/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: builtinModules.map((name) => ({
            name,
            message: 'The domain layer must stay free of Node built-ins.',
          })),
          patterns: [{ group: ['node:*'], message: 'The domain layer must stay free of Node built-ins.' }],
        },
      ],
    },
  },
  {
    files: ['packages/!(core|dashboard)/src/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: coreSubpathPatterns }] },
  },
  {
    files: ['packages/dashboard/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@req-inspect/core',
              allowTypeImports: true,
              message: 'The dashboard may only import types from @req-inspect/core.',
            },
          ],
          patterns: coreSubpathPatterns,
        },
      ],
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
