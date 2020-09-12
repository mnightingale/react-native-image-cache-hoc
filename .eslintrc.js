module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  parser: 'babel-eslint',
  plugins: ['react', 'react-native'],
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-native/all'],
  parserOptions: {
    sourceType: 'module',
  },
  settings: {
    react: {
      version: '16',
    },
  },
  rules: {
    indent: ['error', 2, { SwitchCase: 1 }],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'no-var': 'error',
  },
};
