export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        indexedDB: 'readonly',
        self: 'readonly',
        caches: 'readonly',
        clients: 'readonly',
        IDBKeyRange: 'readonly',
        CustomEvent: 'readonly',
        URL: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        Promise: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-alert': 'error',
      'eqeqeq': ['warn', 'always'],
      'no-console': 'off'
    },
    ignores: ['supabase-umd.js', 'node_modules/**']
  }
];
