module.exports = [
  {
    // Määritellään kieliasetukset ja globaalit muuttujat
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    },
    // Säännöt ja muut asetukset
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single']
    }
  }
];