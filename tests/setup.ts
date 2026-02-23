import { vi } from 'vitest';

// Mock chrome API globally for all tests
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
  },
  tabs: {
    query: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
} as any;
