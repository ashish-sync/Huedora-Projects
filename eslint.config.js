import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

const campActionSources = [
  'src/features/camps/utils/campExecutionActions.js',
  'src/features/camps/utils/campAssignmentActions.js',
  'src/features/camps/utils/campBulkActions.js',
  'src/features/camps/utils/campCancelRefuse.js',
  'src/features/camps/components/CampExecutionRowActions.jsx',
  'src/features/camps/components/CampAssignmentRowActions.jsx',
  'src/features/camps/constants/campLifecycle.js',
];

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: campActionSources,
    rules: {
      'no-undef': 'error',
    },
  },
];
