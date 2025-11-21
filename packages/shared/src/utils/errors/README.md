# Contract Error Parsing

User-friendly error parsing for Green Goods contract errors, especially UserOperation failures.

## Problem

When a smart account transaction fails, users see cryptic error codes like `0x8cb4ae3b` instead of helpful messages. This utility translates contract revert errors into clear, actionable messages.

## Usage

### Basic Parsing

```typescript
import { parseContractError } from "@green-goods/shared/utils/errors";

try {
  await client.sendTransaction({...});
} catch (error) {
  const parsed = parseContractError(error);
  
  console.log(parsed.name);    // "NotGardenerAccount"
  console.log(parsed.message); // "You are not a member of this garden"
  console.log(parsed.action);  // "Please join the garden before submitting work"
  console.log(parsed.isKnown); // true
}
```

### Quick Toast Integration

```typescript
import { parseAndFormatError } from "@green-goods/shared/utils/errors";
import { toastService } from "@green-goods/shared/toast";

try {
  await submitWork();
} catch (error) {
  const { title, message } = parseAndFormatError(error);
  toastService.error({ title, message });
}
```

### Check Specific Errors

```typescript
import { isNotGardenerError, isAlreadyGardenerError } from "@green-goods/shared/utils/errors";

try {
  await joinGarden();
} catch (error) {
  if (isAlreadyGardenerError(error)) {
    // User is already a member - treat as success
    console.log("Already a gardener, continuing...");
    return;
  }
  
  if (isNotGardenerError(error)) {
    // Show garden join prompt
    showJoinPrompt();
  }
}
```

## Supported Errors

### GardenAccount Errors

| Error Code | Name | User Message |
|------------|------|--------------|
| `0x8cb4ae3b` | NotGardenerAccount | You are not a member of this garden |
| `0x30cd7471` | NotGardenOwner | Only the garden owner can perform this action |
| `0x5d91fb09` | NotGardenOperator | Only garden operators can perform this action |
| `0x5d4c2485` | InvalidInvite | Invalid or expired garden invite |
| `0x42375a1e` | AlreadyGardener | You are already a member of this garden |
| `0x3c6e2a8f` | TooManyGardeners | This garden has reached its maximum member capacity |

### ActionRegistry Errors

| Error Code | Name | User Message |
|------------|------|--------------|
| `0x82b42900` | NotActionOwner | Only the action owner can modify this action |
| `0x8baa579f` | InvalidAction | Invalid action configuration |

### WorkApprovalResolver Errors

| Error Code | Name | User Message |
|------------|------|--------------|
| `0x48f5c3ed` | InvalidAttestation | Invalid work attestation |
| `0x5d91fb10` | NotAuthorizedApprover | You are not authorized to approve work in this garden |

## How It Works

### Error Extraction

The parser handles multiple error formats:

```typescript
// Direct hex code
"0x8cb4ae3b"

// UserOperation revert
"UserOperation reverted during simulation with reason: 0x8cb4ae3b"

// Error object
{ message: "Transaction reverted: 0x8cb4ae3b", code: "CALL_EXCEPTION" }

// Named revert
"The contract function 'NotGardenerAccount' reverted"
```

### Error Registry

Errors are registered with:
- **Signature**: 4-byte function selector (first 4 bytes of keccak256 hash)
- **Name**: Contract error name
- **Message**: Human-readable explanation
- **Action** (optional): Suggested next step for user

### Adding Custom Errors

```typescript
import { registerErrorSignature } from "@green-goods/shared/utils/errors";

// Register a new error
registerErrorSignature(
  "0xabcd1234",
  "CustomError",
  "Something custom went wrong",
  "Try this specific action"
);
```

## Integration Examples

### Work Submission Provider

```typescript
// packages/shared/src/providers/work.tsx

import { parseAndFormatError } from "../utils/errors";

const workMutation = useMutation({
  mutationFn: submitWork,
  onError: (error) => {
    const { title, message, parsed } = parseAndFormatError(error);
    
    toastService.error({
      title: parsed.isKnown ? title : "Work submission failed",
      message: parsed.isKnown ? message : "Please try again later",
      description: parsed.action,
    });
  },
});
```

### Garden Join Hook

```typescript
// packages/shared/src/hooks/garden/useAutoJoinRootGarden.ts

import { parseAndFormatError, isAlreadyGardenerError } from "../../utils/errors";

const joinGarden = async () => {
  try {
    await client.sendTransaction({...});
  } catch (error) {
    // Treat "already a member" as success
    if (isAlreadyGardenerError(error)) {
      console.log("User already in garden");
      setOnboarded(true);
      return;
    }
    
    // Show parsed error to user
    const { title, message } = parseAndFormatError(error);
    toast.error({ title, message });
    throw error;
  }
};
```

## Error Code Reference

To find error codes for new contract errors:

1. **From Solidity source:**
   ```solidity
   // In contract:
   error NotGardenerAccount();
   
   // Calculate selector:
   bytes4 selector = bytes4(keccak256("NotGardenerAccount()"));
   // Result: 0x8cb4ae3b
   ```

2. **From failed transaction:**
   - Check transaction revert reason in block explorer
   - Look for hex code in error message
   - Use `cast sig` to decode: `cast sig "0x8cb4ae3b"`

3. **From contract ABI:**
   ```typescript
   import { keccak256, toHex } from "viem";
   
   const selector = keccak256(toHex("NotGardenerAccount()")).slice(0, 10);
   console.log(selector); // "0x8cb4ae3b"
   ```

## Testing

```typescript
import { describe, it, expect } from "vitest";
import { parseContractError } from "@green-goods/shared/utils/errors";

describe("Error Parsing", () => {
  it("handles NotGardenerAccount error", () => {
    const parsed = parseContractError("0x8cb4ae3b");
    
    expect(parsed.name).toBe("NotGardenerAccount");
    expect(parsed.isKnown).toBe(true);
    expect(parsed.action).toBeDefined();
  });
});
```

## Best Practices

1. **Always parse errors before showing to users**
   ```typescript
   // ❌ Bad
   toast.error({ message: String(error) });
   
   // ✅ Good
   const { title, message } = parseAndFormatError(error);
   toast.error({ title, message });
   ```

2. **Use specific checks for critical errors**
   ```typescript
   // ✅ Good - handle AlreadyGardener gracefully
   if (isAlreadyGardenerError(error)) {
     return; // Silent success
   }
   ```

3. **Provide context in error logs**
   ```typescript
   // ✅ Good - include parsed error in debug logs
   const { parsed } = parseAndFormatError(error);
   debugError("Operation failed", error, {
     errorName: parsed.name,
     errorMessage: parsed.message,
   });
   ```

4. **Register app-specific errors early**
   ```typescript
   // In app initialization
   registerErrorSignature(
     "0x12345678",
     "MyCustomError",
     "Custom error message",
     "Custom action"
   );
   ```

## Future Improvements

- [ ] Add more contract errors as they're deployed
- [ ] Support i18n for error messages
- [ ] Add error analytics/tracking
- [ ] Generate error registry from contract ABIs automatically
- [ ] Add error recovery suggestions based on context

## Reference

- Implementation: `packages/shared/src/utils/errors/contract-errors.ts`
- Tests: `packages/shared/src/utils/errors/__tests__/contract-errors.test.ts`
- Integration: `packages/shared/src/providers/work.tsx`

