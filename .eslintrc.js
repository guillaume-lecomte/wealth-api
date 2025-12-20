module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    'import',
    'prettier',
  ],
  extends: [
    'plugin:@typescript-eslint/recommended', // Au lieu de recommended-type-checked
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [
    '.eslintrc.js',
    'dist',
    'node_modules',
    'coverage',
    '*.config.js',
  ],
  rules: {
    // ========== TypeScript - Mode Souple ==========
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn', // Warn au lieu de error
    '@typescript-eslint/no-unused-vars': [
      'warn', // Warn au lieu de error
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    
    // Règles assouplies
    '@typescript-eslint/ban-types': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-namespace': 'off',
    
    // Désactivées
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    
    // ========== Naming Conventions - Simplifié ==========
    '@typescript-eslint/naming-convention': [
      'warn',
      {
        selector: 'default',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'enumMember',
        format: ['UPPER_CASE', 'PascalCase'],
      },
    ],
    
    // ========== Import/Export - Allégé ==========
    'import/order': [
      'warn', // Warn au lieu de error
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-duplicates': 'warn',
    'import/no-cycle': 'warn',
    'import/no-self-import': 'warn',
    'import/no-unresolved': 'off',
    
    // ========== ESLint Core - Minimal ==========
    'no-console': 'off', // Autorisé partout
    'no-debugger': 'warn',
    'no-alert': 'warn',
    'no-var': 'error', // Toujours interdit
    'prefer-const': 'warn',
    'prefer-template': 'off',
    'no-nested-ternary': 'off',
    'no-else-return': 'off',
    'consistent-return': 'off',
    
    // ========== Prettier ==========
    'prettier/prettier': [
      'warn', // Warn au lieu de error
      {
        endOfLine: 'auto',
      },
    ],
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
  overrides: [
    // Tests : tout autorisé
    {
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
    // Scripts et configs
    {
      files: ['*.js', '*.config.ts', 'scripts/**'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off',
      },
    },
  ],
};
