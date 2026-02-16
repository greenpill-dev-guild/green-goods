# Core Features

Green Goods combines cutting-edge web3 technology with intuitive UX to create a regenerative impact platform that works for everyone—from smartphone-wielding gardeners to technically sophisticated developers.

---

## 🔐 Frictionless Onboarding (Passkey + Account Abstraction)

### The Challenge

Traditional web3 onboarding creates massive friction:
- ❌ Seed phrases are confusing and risky to manage
- ❌ Gas fees prevent participation
- ❌ Wallet setup takes 10+ minutes
- ❌ High abandonment rates (~90% for new users)

### The Green Goods Solution

**Passkey Authentication + Pimlico Smart Accounts**

**For Gardeners**:
1. Visit greengoods.app
2. Click "Sign Up with Passkey"
3. Use Face ID / Touch ID / Fingerprint
4. Done! (~30 seconds)

**Under the Hood**:
- **WebAuthn**: Industry-standard biometric authentication
- **Smart Accounts**: Kernel accounts via Pimlico
- **Gasless Transactions**: Pimlico paymaster sponsors gas
- **No Private Keys**: Secure, can't be phished

**Benefits**:
- ✅ Web2-like UX with web3 benefits
- ✅ No seed phrase management
- ✅ No gas fees for gardeners
- ✅ Familiar biometric authentication
- ✅ Works on any smartphone

**For Operators**:
- Traditional wallet connection (MetaMask, etc.)
- Full transparency and control
- Suitable for validators and admins

[Technical Details →](../developer/client)

---

## 📱 PWA Experience (Mobile-First Progressive Web App)

### Why PWA?

Native apps require:
- App store approval (weeks)
- Large downloads (100+ MB)
- Regular updates users must install
- Platform-specific development

**Green Goods PWA**:
- ✅ Instant access via URL
- ✅ Install to home screen (optional)
- ✅ Works on iOS, Android, desktop
- ✅ Auto-updates in background
- ✅ Small install size (~5 MB)

### PWA Capabilities

**Installable**:
- Add to home screen like native app
- Runs in standalone mode (no browser chrome)
- Launch icon on device

**Offline-First**:
- Service worker caches assets
- Works without internet
- Background sync when online

**Native Features**:
- Camera access for photos
- GPS for location tracking
- Push notifications (future)
- Background sync

**Cross-Platform**:
- Single codebase for all platforms
- Consistent experience everywhere
- No app store gatekeepers

> 🔗 **Reference:** Offline caching & sync patterns mirror [TanStack Query’s offline guide](https://tanstack.com/query/latest/docs/framework/react/guides/examples/offline); revisit it before adjusting queue behaviour.

<!-- TODO: Add screenshot of PWA install prompt -->
<!-- TODO: Add PWA install screenshot -->
<!-- <!-- TODO: Add image - PWA Install -->
<!-- ![PWA Install](../.gitbook/assets/pwa-install.png) --> -->
*Install Green Goods to your home screen*

---

## 📸 Work Logging with MDR

**Media → Details → Review**: The signature 3-step workflow

### Why MDR?

Traditional impact forms have 15+ fields and take 30 minutes. MDR takes < 2 minutes.

**Step 1: Media** 📸
- Take before/after photos
- Capture in the field
- Stored locally if offline

**Step 2: Details** ✍️
- Select action
- Fill key metrics (< 5 fields)
- Add notes (optional)

**Step 3: Review** ✅
- Preview submission
- Confirm accuracy
- Submit

**Result**: High-quality documentation with minimal effort.

[Detailed MDR Guide →](../concepts/mdr-workflow)

---

## 🤖 Automated Impact Reporting via Karma GAP

### The Problem

Impact reporting requires:
- Manual data entry across platforms
- Different standards for different funders
- Fragmented reporting systems
- Duplicate work

### Karma GAP Integration

**What Is Karma GAP?**

The Grantee Accountability Protocol (GAP) is a standardized framework for on-chain impact reporting.

**Automatic in Green Goods**:

**When Garden Created**:
```
✅ Green Goods Garden NFT minted
✅ Karma GAP Project attestation created
   → Garden becomes queryable GAP project
```

**When Operator Approves Work**:
```
✅ Green Goods Work Approval attestation
✅ Karma GAP Impact attestation
   → Work becomes verifiable GAP impact
```

**Benefits**:
- ✅ **Zero extra work**: Happens automatically
- ✅ **Standardized**: Compatible with GAP ecosystem
- ✅ **Multi-chain**: Works across Arbitrum, Celo, Base
- ✅ **Transparent**: All data publicly verifiable

**For Funders**:
- Query impact via Karma GAP platform
- Standardized schema across projects
- Transparent accountability

**Supported Networks**:
- Arbitrum One (42161)
- Celo (42220)
- Sepolia (11155111)

[Karma GAP Technical Details →](../developer/karma-gap)

---

## ⛓️ On-Chain Verification & Rewards

### Permanent, Verifiable Records

Every approved work submission creates **immutable on-chain attestations**.

**Attestation Chain**:
```
Work Submission Attestation
  ↓ references
Work Approval Attestation
  ↓ references
Garden Assessment Attestation
```

**Powered by EAS** (Ethereum Attestation Service):
- Battle-tested infrastructure
- Used by ENS, Gitcoin, Optimism
- Multi-chain deployment
- Open and composable

**View on EAS Explorers**:
- [Arbitrum EAS](https://arbitrum.easscan.org)
- [Celo EAS](https://celo.easscan.org)
- [Sepolia EAS](https://sepolia.easscan.org)

### Future: Tokenized Rewards

**Coming Soon**: Hypercerts for retroactive funding

- Aggregate verified work into impact certificates
- Fractionalize among contributors
- Enable impact markets
- Unlock retroactive funding

[Learn More About Attestations →](../concepts/attestations)

---

## 🌍 Localization & Language Support

Green Goods is built for global communities.

### Supported Languages

**Available Now**:
- 🇺🇸 **English** (en)
- 🇪🇸 **Spanish** (es)
- 🇧🇷 **Portuguese** (pt)

**Coming Soon**:
- 🇫🇷 French
- 🇨🇳 Mandarin
- 🇮🇳 Hindi

### Translation Infrastructure

**React Intl** provides:
- Dynamic language switching
- Localized date/time formatting
- Number formatting by locale
- Right-to-left (RTL) support (future)

**Translation Files**:
- `client/src/i18n/en.json`
- `client/src/i18n/es.json`
- `client/src/i18n/pt.json`

**Example**:
```json
{
  "app.garden.work.submit": "Submit Work",
  "app.garden.work.noWork": "No work yet",
  "app.garden.actions.available": "Available Actions"
}
```

**User Experience**:
- Auto-detect browser language
- Manual switcher in settings
- All UI elements translated
- Action instructions can be multilingual

### Contributing Translations

Translations are community-contributed. To add a language:

1. Copy `en.json` to `{lang-code}.json`
2. Translate all strings
3. Submit PR
4. Community reviews

[Contributing Guide →](../developer/contributing)

---

## 📡 Offline-First Architecture

Built for working in remote areas without reliable connectivity.

### The Problem

Conservation work happens where there's **no internet**:
- Remote forests
- Rural farms
- Mountains and valleys
- Developing regions

Traditional apps fail without connectivity.

### Green Goods Offline Capabilities

**Works Completely Offline**:
- ✅ Take photos
- ✅ Fill out forms
- ✅ Submit work (queued locally)
- ✅ View past submissions

**Automatic Sync When Online**:
- Photos upload to IPFS
- Form data prepared as attestations
- Transactions submitted
- Status updated

### Technical Architecture

**Job Queue System**:
```
User submits work offline
  ↓
Saved to IndexedDB
  ↓
Queued for processing
  ↓
When online: Upload media → Create attestation → Submit transaction
  ↓
Confirmation → Update UI
```

**Storage**:
- **IndexedDB**: Local database for queued work
- **Blob Storage**: Media files stored temporarily
- **Service Worker**: Manages background sync

**Event-Driven Updates**:
- Real-time sync status
- Automatic retry with exponential backoff
- Graceful degradation

<!-- TODO: Add diagram showing offline architecture -->
<!-- TODO: Add offline architecture diagram -->
<!-- <!-- TODO: Add image - Offline Architecture -->
<!-- ![Offline Architecture](../.gitbook/assets/offline-architecture-diagram.png) --> -->
*Work flows from offline queue to on-chain attestation*

**User Experience**:
- 🟢 **Online**: Immediate submission
- 🔴 **Offline**: Queued, syncs later
- 🟡 **Syncing**: Background upload
- ℹ️ Clear indicators for all states

[Offline Architecture Details →](../developer/client)

---

## Additional Features

### 🔗 Multi-Chain Support

**Deployed Networks**:
- **Arbitrum One** (42161): Production L2
- **Celo** (42220): Carbon-negative blockchain
- **Sepolia** (11155111): Testnet

**Future Expansion**:
- Optimism
- Polygon
- Base Mainnet

### 🎨 Modern Design System

**Built With**:
- **Tailwind CSS v4**: Utility-first styling
- **Radix UI**: Accessible primitives
- **CSS Variables**: Theme system
- **Responsive**: Mobile-first design

### 🔍 Search & Discovery

**Find Gardens By**:
- Location (city, region, country)
- Tags (restoration, urban farming)
- Capital focus (Living, Social, Cultural)

### 📊 Real-Time Analytics

**For Gardens**:
- Total work submissions
- Approval rates
- Active members
- Cumulative metrics

**For Gardeners**:
- Personal dashboard
- Submission history
- Impact portfolio

### 🔔 Notifications (Future)

**Coming Soon**:
- Work approval notifications
- Garden invitations
- New action alerts
- Impact milestones

### 🤝 Social Sharing

**Share**:
- Individual attestations
- Garden profiles
- Impact achievements
- Invite links

---

## Feature Comparison

| Feature | Green Goods | Traditional Platforms |
|---------|-------------|----------------------|
| **Onboarding** | 30 seconds | 10+ minutes |
| **Gas Fees** | None (sponsored) | User pays |
| **Offline** | Full support | Limited/None |
| **Verification** | On-chain attestations | Self-reported |
| **Portability** | Own your data | Platform locked |
| **Mobile** | PWA (native-like) | Mobile web |
| **Multi-chain** | 3+ networks | Single or none |
| **Open Data** | Public GraphQL | API keys required |

---

## Coming Soon

### Q2 2024

- ✨ Enhanced search and filters
- 📊 Advanced analytics dashboards
- 📧 Email notifications
- 🗺️ Map view for gardens

### Q3 2024

- 🪙 Hypercert integration
- 💰 Retroactive funding tools
- 🏛️ DAO governance features
- 🔗 More chain deployments

### Q4 2024

- 📱 Native mobile apps (iOS/Android)
- 🤖 AI-assisted documentation
- 📈 Impact prediction models
- 🌐 Additional languages

---

## Learn More

- [System Architecture](architecture) — Technical deep dive
- [Product Overview](overview) — Vision and goals
- [MDR Workflow](../concepts/mdr-workflow) — Signature feature
- [Attestations](../concepts/attestations) — Verification system
- [Offline Architecture](../developer/client) — Technical details

