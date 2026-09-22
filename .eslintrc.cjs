module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: ['airbnb', 'airbnb-typescript', 'airbnb/hooks', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: ['src/tests/**', 'vite.config.ts'] },
    ],
    'import/extensions': 'off',
    'import/prefer-default-export': 'off',
    'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['message'] }],
    'no-continue': 'off',
    'no-restricted-syntax': 'off',
    'no-void': ['error', { allowAsStatement: true }],
    'react/function-component-definition': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/require-default-props': 'off',
  },
  overrides: [
    {
      files: ['src/fit/parser/fitWorker.ts'],
      env: {
        browser: false,
        worker: true,
      },
      rules: {
        'no-restricted-globals': 'off',
      },
    },
    {
      files: ['src/tests/**/*.{ts,tsx}'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
