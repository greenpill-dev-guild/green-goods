# Gardener Smart Accounts

## Overview

Green Goods uses custom Kernel v3 smart accounts (GardenerAccount) for user authentication and on-chain profile management. Each user has their own smart contract wallet that stores profile information and interacts with the Green Goods protocol.

## Architecture

### Components

1. **GardenerAccount.sol** - Custom Kernel v3 smart account contract
2. **Garden.sol (TBA)** - Token Bound Account for garden management (unchanged)
3. **Indexer** - Envio indexer for querying gardener data
4. **Client** - React hooks and UI for profile management

### Separation of Concerns

- **GardenerAccount**: User profile storage ONLY (name, bio, location, image, socials)
- **Garden (TBA)**: Permission management (operators, gardeners) - remains authoritative
- **Indexer**: Fast off-chain queries via GraphQL

## Profile Fields

### On-Chain Storage

Each GardenerAccount stores the following profile data:

| Field | Type | Max Length | Description |
|-------|------|------------|-------------|
| `name` | string | 50 chars | Display name |
| `bio` | string | 280 chars | Short bio/description |
| `location` | string | 100 chars | Geographic location |
| `imageURI` | string | - | IPFS/Arweave/HTTPS avatar URI |
| `socialLinks` | string[] | 5 links | Social media URLs (must be HTTPS) |
| `contactInfo` | string | - | Optional contact (telegram/email) |
| `profileUpdatedAt` | uint256 | - | Last update timestamp |

### Validation Rules

**String Lengths:**
- Name: ≤50 characters (reverts with `NameTooLong`)
- Bio: ≤280 characters (reverts with `BioTooLong`)
- Location: ≤100 characters (reverts with `LocationTooLong`)

**Social Links:**
- Maximum 5 links (reverts with `TooManySocialLinks`)
- Must start with `https://` (reverts with `InvalidURL`)
- Empty strings allowed

**Image URI:**
- Must start with `ipfs://`, `ar://`, or `https://` (reverts with `InvalidURL`)
- Empty string allowed

**Rate Limiting:**
- Maximum 1 update per 5 minutes (reverts with `RateLimited`)
- Applies to ALL update functions (setProfile, updateName, etc.)

## Gas Costs

All profile updates are **gasless** (sponsored by Pimlico paymaster):

| Operation | Gas Cost | User Cost |
|-----------|----------|-----------|
| First profile update | ~150k gas | $0 (sponsored) |
| Full profile update | ~100-150k gas | $0 (sponsored) |
| Single field update | ~30-50k gas | $0 (sponsored) |

Users do not need to hold ETH to update their profiles.

## API Reference

### Smart Contract Functions

#### Write Functions (Owner Only)

```solidity
// Update entire profile
function setProfile(
    string calldata _name,
    string calldata _bio,
    string calldata _location,
    string calldata _imageURI,
    string[] calldata _socialLinks,
    string calldata _contactInfo
) external onlyOwner

// Update individual fields (gas efficient)
function updateName(string calldata _name) external onlyOwner
function updateBio(string calldata _bio) external onlyOwner
function updateLocation(string calldata _location) external onlyOwner
function updateImage(string calldata _imageURI) external onlyOwner
function updateSocialLinks(string[] calldata _links) external onlyOwner
function updateContact(string calldata _contact) external onlyOwner

// Transfer ownership (recovery)
function transferOwnership(address newOwner) external onlyOwner
```

#### Read Functions

```solidity
// Get complete profile
function getProfile() external view returns (
    string memory _name,
    string memory _bio,
    string memory _location,
    string memory _imageURI,
    string[] memory _socialLinks,
    string memory _contactInfo,
    uint256 _updatedAt
)

// Individual field getters
function name() external view returns (string memory)
function bio() external view returns (string memory)
function location() external view returns (string memory)
function imageURI() external view returns (string memory)
function socialLinks(uint256 index) external view returns (string memory)
function contactInfo() external view returns (string memory)
function profileUpdatedAt() external view returns (uint256)
function owner() external view returns (address)
```

### React Hook: `useGardenerProfile()`

```typescript
import { useGardenerProfile } from '@/hooks/gardener/useGardenerProfile';

function ProfileEditor() {
  const {
    // Query state
    profile,
    isLoading,
    error,
    refetch,
    
    // Full profile update
    updateProfile,
    isUpdating,
    
    // Individual field updates
    updateName,
    updateBio,
    updateLocation,
    updateImage,
    
    // Individual loading states
    isUpdatingName,
    isUpdatingBio,
    isUpdatingLocation,
    isUpdatingImage,
  } = useGardenerProfile();
  
  // Update entire profile
  const handleSubmit = () => {
    updateProfile({
      name: "Alice",
      bio: "Regenerative farmer",
      location: "Portland, OR",
      imageURI: "ipfs://Qm...",
      socialLinks: ["https://twitter.com/alice"],
      contactInfo: "@alice",
    });
  };
  
  // Update single field (more gas efficient)
  const handleNameChange = (newName: string) => {
    updateName(newName);
  };
}
```

### GraphQL Query (Indexer)

```graphql
query GetGardenerProfile($address: String!) {
  Gardener(id: $address) {
    id
    chainId
    owner
    name
    bio
    location
    imageURI
    socialLinks
    contactInfo
    profileUpdatedAt
    createdAt
    gardens
  }
}
```

## Events

### AccountDeployed

Emitted when a new GardenerAccount is created:

```solidity
event AccountDeployed(
    address indexed account,
    address indexed owner,
    uint256 timestamp
);
```

**Indexer Action:** Creates new Gardener entity

### ProfileUpdated

Emitted on any profile update:

```solidity
event ProfileUpdated(
    address indexed account,
    string name,
    string bio,
    string location,
    string imageURI,
    uint256 timestamp
);
```

**Indexer Action:** Updates Gardener entity with new profile data

**Note:** `socialLinks` and `contactInfo` are NOT in the event (gas optimization). If needed, they can be queried from contract state.

## Usage Guide

### For Users

#### Creating Your Profile

1. Sign up with passkey → GardenerAccount automatically deployed
2. Navigate to Profile → Gardener Profile tab
3. Fill in your profile information
4. Click "Save Profile" → Transaction is gasless (no ETH needed)
5. Profile is stored on-chain and indexed within seconds

#### Updating Your Profile

- **Full Update:** Use the main form to update all fields at once
- **Single Field:** Use individual update functions for gas efficiency
- **Rate Limit:** You can update once every 5 minutes

#### Image Upload

1. Click "Upload Image" button
2. Select image file (JPEG, PNG, etc.)
3. Image is uploaded to IPFS via Storacha
4. IPFS hash is saved in your profile

### For Developers

#### Deploying Contracts

```bash
# Deploy to testnet (Base Sepolia)
cd packages/contracts
node script/deploy.js core --network baseSepolia --broadcast

# GardenerAccount logic will be deployed automatically
# Address saved to deployments/84532-latest.json
```

#### Upgrading GardenerAccount Logic

```bash
# Upgrade GardenerAccount implementation
node script/upgrade.js gardener-account --network baseSepolia --broadcast

# This deploys new logic; existing accounts continue working
# New accounts use updated logic automatically
```

#### Indexer Configuration

After deploying, update indexer config with GardenerAccount address:

```yaml
# packages/indexer/config.yaml
networks:
  - id: 84532
    contracts:
      - name: GardenerAccount
        address: "0x..." # From deployment artifacts
```

Then regenerate indexer code:

```bash
cd packages/indexer
bun codegen
bun dev
```

## Migration Guide

### For New Users

New signups automatically use GardenerAccount:
- Passkey registration deploys GardenerAccount with custom logic
- No action required from users
- Profile can be set immediately (gasless)

### For Existing Users

Existing smart accounts continue working:
- No breaking changes
- Profile features unavailable until migration
- Optional: Deploy new GardenerAccount and migrate

#### Migration Steps (Optional)

1. **Deploy New Account:**
   - Click "Migrate to GardenerAccount" in settings
   - Sign with existing passkey to authorize
   - New GardenerAccount deployed with same owner

2. **Transfer Garden Memberships:**
   - Garden operators must add new account address
   - Old account can be deprecated

3. **Set Profile:**
   - Fill in profile information
   - Save (gasless)

**Note:** Migration UI is not yet implemented. For now, existing users continue with current accounts.

## Security Considerations

### Access Control

- **Owner Only:** Only the account owner (passkey EOA) can update profile
- **Or Account Itself:** Functions can be called via UserOperation (EntryPoint)
- **No External Calls:** Profile updates don't interact with other contracts

### Rate Limiting

- Prevents spam/abuse: 1 update per 5 minutes
- Enforced on-chain (cannot be bypassed)
- Applies to all update functions

### Data Privacy

- **Public Data:** All profile fields are publicly readable on-chain
- **Encryption Recommended:** For contactInfo, encrypt client-side before storing
- **No PII:** Avoid storing sensitive personal information

### URL Validation

- Social links must be HTTPS (prevents phishing)
- Image URIs validated for known protocols (IPFS, Arweave, HTTPS)
- Invalid URLs rejected on-chain

## Recovery

### ZeroDev Recovery Plugin

GardenerAccount supports account recovery via ZeroDev's official recovery plugin:

- **Guardian Setup:** Configure trusted guardian(s) during account creation
- **Recovery Process:** Guardian can initiate ownership transfer if user loses passkey
- **Backup:** Green Goods support multisig can act as fallback guardian

### Transfer Ownership

```solidity
// Transfer to new owner (recovery scenario)
function transferOwnership(address newOwner) external onlyOwner
```

**Use Cases:**
- Lost passkey recovery (via guardian)
- Account transfer/sale
- Upgrading to new authentication method

## Troubleshooting

### "Not Authorized" Error

**Cause:** Trying to update profile from wrong address

**Solution:**
- Ensure you're signed in with the correct passkey
- Check that transaction is sent from account owner

### "RateLimited" Error

**Cause:** Trying to update profile within 5-minute cooldown

**Solution:**
- Wait 5 minutes since last update
- Check `profileUpdatedAt` timestamp on contract

### "NameTooLong" / "BioTooLong" / etc.

**Cause:** Input exceeds maximum length

**Solution:**
- Reduce input length to meet requirements
- Name: ≤50 chars
- Bio: ≤280 chars
- Location: ≤100 chars

### "InvalidURL" Error

**Cause:** Image URI or social link has invalid protocol

**Solution:**
- Image must start with `ipfs://`, `ar://`, or `https://`
- Social links must start with `https://`

### Profile Not Showing in UI

**Cause:** Indexer hasn't processed ProfileUpdated event yet

**Solution:**
- Wait 10-30 seconds for indexer to sync
- Refresh the page
- Check indexer status at http://localhost:8080 (local dev)

### Transaction Failed / Paymaster Error

**Cause:** Pimlico paymaster issue

**Solution:**
- Check `VITE_PIMLICO_API_KEY` environment variable is set
- Verify sponsorship policy ID is valid
- Check Pimlico dashboard for policy limits

## Development Workflow

### Local Testing

1. **Start Anvil (local chain):**
   ```bash
   cd packages/contracts
   bun dev
   ```

2. **Deploy contracts:**
   ```bash
   bun deploy
   ```

3. **Start indexer:**
   ```bash
   cd packages/indexer
   bun codegen
   bun dev
   ```

4. **Start client:**
   ```bash
   cd packages/client
   bun dev
   ```

5. **Test profile updates:**
   - Create passkey account
   - Go to Profile → Gardener Profile
   - Fill in profile and save
   - Check indexer GraphQL: http://localhost:8080

### Running Tests

**Contract Tests:**
```bash
cd packages/contracts
bun test --match-contract GardenerAccountTest
```

**Integration Tests:**
```bash
cd packages/client
bun test src/__tests__/integration/gardener-profile.test.tsx
```

## Future Enhancements

### Planned Features

- **ENS Integration:** Resolve ENS names to GardenerAccount addresses
- **Reputation System:** On-chain reputation based on work completed
- **Badges/Achievements:** NFT badges for milestones
- **Profile Verification:** Verify social accounts (Twitter, GitHub)
- **Multi-Language Support:** Profile fields in multiple languages
- **Rich Media:** Video intros, portfolio links

### Plugin Opportunities

- **Session Keys Plugin:** Delegated signing for mobile apps
- **Multi-Sig Plugin:** Shared accounts for organizations
- **Subscription Plugin:** Recurring payments for premium features

## References

- [Kernel v3 Documentation](https://docs.zerodev.app/)
- [Pimlico Documentation](https://docs.pimlico.io/)
- [ERC-4337 Spec](https://eips.ethereum.org/EIPS/eip-4337)
- [Envio Indexer](https://docs.envio.dev/)

## Support

For questions or issues:
- Telegram: https://t.me/+N3o3_43iRec1Y2Jh
- Twitter: https://x.com/greengoodsapp
- GitHub Issues: [green-goods repo]

---

**Last Updated:** October 18, 2025  
**Version:** 1.0.0  
**Status:** ✅ Implemented, Ready for Testing


