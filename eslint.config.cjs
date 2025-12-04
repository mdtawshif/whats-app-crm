module.exports = [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
      },
      parser: require('@typescript-eslint/parser'),
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      prettier: require('eslint-plugin-prettier'),
    },
    rules: {
      'prettier/prettier': 'off',

      // semi: ['error', 'always'], // or 'never' if no semicolons
      // quotes: 'off', // disable native quotes rule, let prettier handle it
      // 'prettier/prettier': [
      //   'error',
      //   {
      //     printWidth: 80,
      //     tabWidth: 2,
      //     useTabs: false,
      //     semi: true,
      //     singleQuote: true,      // <-- MUST match your .prettierrc here
      //     trailingComma: 'all',
      //     bracketSpacing: true,
      //     arrowParens: 'always',
      //     endOfLine: 'lf',
      //   },
      // ],
      "no-console": "off",
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];
