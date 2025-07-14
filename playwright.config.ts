import { defineConfig, devices } from '@playwright/test';

// Environment configuration (focused on localhost as requested)
const environments = {
  local: {
    client: 'https://localhost:3001', // HTTPS because of mkcert plugin
    indexer: 'http://localhost:8080/v1/graphql',
    chain: 'base-sepolia', // Using deployed contracts on Base Sepolia
  }
};

const currentEnv = environments.local;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // Enhanced retry for flaky blockchain interactions
  workers: process.env.CI ? 2 : undefined, // Optimized for CI performance
  
  // Enhanced reporting for better monitoring
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],
  
  use: {
    baseURL: currentEnv.client,
    
    // Accept self-signed certificates from mkcert
    ignoreHTTPSErrors: true,
    
    // Performance and monitoring enhancements
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    
    // Blockchain-specific timeouts
    navigationTimeout: 30000, // Allow time for wallet connections
    actionTimeout: 15000, // Allow time for blockchain transactions
    
    // Test environment context
    extraHTTPHeaders: {
      'X-Test-Environment': 'e2e',
    },
  },

  // Projects focused on mobile browsers (PWA focus)
  projects: [
    // Desktop Chrome for development
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Mobile browsers - primary focus for PWA
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific viewport for PWA testing
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        // iOS Safari for PWA compatibility
      },
    },
    
    // Tablet for responsive testing
    {
      name: 'tablet',
      use: { 
        ...devices['iPad Pro'],
      },
    },
  ],

  // For manual testing without automatic service startup
  // Comment out webServer if services are already running
  webServer: process.env.SKIP_WEBSERVER ? undefined : [
    {
      // Use npm/pnpm based on availability
      command: process.env.npm_execpath?.includes('pnpm') ? 'pnpm dev:indexer' : 'npm run dev:indexer',
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      command: process.env.npm_execpath?.includes('pnpm') ? 'pnpm dev:app' : 'npm run dev:app',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // Allow time for Vite to start
      env: {
        NODE_ENV: 'test',
        VITE_CHAIN_ID: '84532', // Base Sepolia
        VITE_ENVIO_INDEXER_URL: currentEnv.indexer,
      },
    },
  ],

  // Global setup and teardown for test data management
  globalSetup: require.resolve('./tests/global-setup'),
  globalTeardown: require.resolve('./tests/global-teardown'),
}); 