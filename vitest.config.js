// EDITOR: STEVEN
import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.js'

// Server-only secrets read by api/ functions. Unit tests never need real values.
const SERVER_SECRETS = [
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'ORS_API_KEY',
]

// Variables used only by Supabase-gated tests.
const GATE_ONLY = [
  'E2E_SUPABASE_EMAIL',
  'E2E_SUPABASE_PASSWORD',
  'E2E_SUPABASE_HOST_EMAIL',
  'E2E_SUPABASE_HOST_PASSWORD',
  'E2E_SUPABASE_WRITES',
]

// Blank test values override local secrets; tests stub required values explicitly.
const blank = (names) => Object.fromEntries(names.map((name) => [name, '']))

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            include: ['tests/unit/**/*.spec.js'],
            exclude: [
              ...configDefaults.exclude,
              'tests/integration/**',
              'e2e/**',
              '**/*.supabase.spec.js',
            ],
            env: blank([
              'VITE_SUPABASE_URL',
              'VITE_SUPABASE_ANON_KEY',
              'VITE_DEV_PANEL',
              ...SERVER_SECRETS,
              ...GATE_ONLY,
            ]),
            setupFiles: ['./tests/setup/unit.setup.js'],
          },
        },
        {
          // Supabase-gated unit tests use the read-only preflight and same-origin GET boundary.
          extends: true,
          test: {
            name: 'supabase',
            include: ['tests/unit/**/*.supabase.spec.js'],
            exclude: [...configDefaults.exclude, 'tests/integration/**', 'e2e/**'],
            env: blank(SERVER_SECRETS),
            globalSetup: ['./tests/setup/supabase.globalSetup.js'],
            setupFiles: ['./tests/setup/supabase.setup.js'],
          },
        },
        {
          // Integration-support tests share the unit network boundary and blank environment.
          extends: true,
          test: {
            name: 'integration-support',
            include: ['tests/integration/**/*.spec.js'],
            exclude: [...configDefaults.exclude, 'e2e/**'],
            env: blank([
              'VITE_SUPABASE_URL',
              'VITE_SUPABASE_ANON_KEY',
              'VITE_DEV_PANEL',
              ...SERVER_SECRETS,
              ...GATE_ONLY,
            ]),
            setupFiles: ['./tests/setup/unit.setup.js'],
          },
        },
      ],
    },
  }),
)
