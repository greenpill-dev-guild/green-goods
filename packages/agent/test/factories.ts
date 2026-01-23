import type { InboundMessage, User } from '../src/types';

export function createMockMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: 'msg-123',
    platform: 'telegram',
    sender: { platformId: 'user-123', displayName: 'Test User' },
    content: { type: 'text', text: 'test message' },
    locale: 'en',
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    platform: 'telegram',
    platformId: 'user-123',
    privateKey: '0x' + 'a'.repeat(64),
    address: '0x' + '1'.repeat(40),
    role: 'gardener',
    createdAt: Date.now(),
    ...overrides,
  };
}

export function createTestWallet() {
  const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Hardhat test account
  return { privateKey, address };
}