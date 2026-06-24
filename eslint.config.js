import { defineConfig } from '@tofrankie/eslint'

export default defineConfig(
  {
    react: true,
    typescript: {
      overrides: {
        'ts/no-use-before-define': 'off',
      },
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  }
)
