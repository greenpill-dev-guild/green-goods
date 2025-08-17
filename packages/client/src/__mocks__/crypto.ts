// Mock crypto for testing

// Store original crypto if it exists
const originalCrypto = global.crypto;

// Mock crypto implementation
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => `mock-uuid-${Math.random().toString(36).substr(2, 9)}`,
    subtle: {
      digest: (_algorithm: string, data: any) => {
        // Simple mock hash
        const input =
          data instanceof ArrayBuffer ? new TextDecoder().decode(data) : data.toString();
        const hash = btoa(input).substring(0, 16);
        return Promise.resolve(new TextEncoder().encode(hash));
      },
    },
    getRandomValues: (array: any) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  },
  writable: true,
});

export const resetCryptoMocks = () => {
  if (originalCrypto) {
    Object.defineProperty(global, "crypto", {
      value: originalCrypto,
      writable: true,
    });
  }
};
