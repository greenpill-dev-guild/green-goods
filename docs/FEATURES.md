# Green Goods - Core Features Documentation

Green Goods is an innovative regenerative work platform that leverages blockchain technology to create a transparent, decentralized ecosystem for environmental restoration and sustainable agriculture. This document outlines the core features and functionality of the platform.

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Authentication System (Privy/Pimlico)](#authentication-system-privypimlico)
3. [Work Capture System](#work-capture-system)
4. [Work Approval Workflow](#work-approval-workflow)
5. [Offline Support Architecture](#offline-support-architecture)
6. [Localization & Internationalization](#localization--internationalization)
7. [Technical Architecture](#technical-architecture)

---

## Platform Overview

Green Goods is built as an **offline-first, blockchain-enabled platform** that connects gardeners, land stewards, and environmental organizations in a transparent ecosystem for regenerative work verification and compensation.

### Key Principles

- **Offline-First**: Complete functionality without internet connectivity
- **Blockchain Transparency**: All work submissions and approvals recorded on-chain via EAS (Ethereum Attestation Service)
- **Decentralized Governance**: Community-driven garden management and work validation
- **Mobile-Optimized**: Designed for field work with responsive, touch-friendly interfaces
- **Multi-Language Support**: Accessible to global communities

### Core Entities

- **Gardens**: Autonomous organizations representing physical spaces or projects
- **Actions**: Defined types of regenerative work (planting, composting, etc.)
- **Work Submissions**: Evidence-based reports of completed activities
- **Approvals**: Peer-reviewed validation of submitted work
- **Attestations**: Immutable blockchain records of verified work

---

## Authentication System (Privy/Pimlico)

The authentication system provides seamless Web3 onboarding while maintaining familiar user experiences.

### Features

#### **Privy Integration**
- **Social Login**: Google, Apple, Discord, Twitter authentication
- **Email/SMS**: Traditional authentication with Web3 wallet creation
- **Embedded Wallets**: Automatic smart wallet generation for new users
- **Progressive Web3**: Users can interact immediately without crypto knowledge

#### **Pimlico Smart Accounts**
- **Account Abstraction**: EIP-4337 compatible smart accounts
- **Gasless Transactions**: Sponsored transactions for seamless UX
- **Multi-Device Access**: Same account accessible across devices
- **Recovery Options**: Social recovery and guardian systems

#### **Authentication Flow**
```typescript
// Example authentication flow
const { user, authenticated, login } = usePrivy();
const { smartAccountClient } = useSmartAccount();

// Automatic wallet creation on first login
if (authenticated && !user.wallet) {
  await createEmbeddedWallet();
}

// Smart account client ready for transactions
if (smartAccountClient) {
  offlineSync.setSmartAccountClient(smartAccountClient);
}
```

### Security Features

- **Non-Custodial**: Users maintain full control of their accounts
- **MFA Support**: Multi-factor authentication options
- **Session Management**: Secure session handling with automatic refresh
- **Biometric Integration**: Device-level security on supported platforms

---

## Work Capture System

The work capture system enables gardeners to document their regenerative activities with rich media and structured data.

### Core Features

#### **Multimedia Documentation**
- **Photo Capture**: Camera integration with automatic compression
- **Video Recording**: Short-form video documentation
- **GPS Tagging**: Automatic location capture for work verification
- **Offline Storage**: Full functionality without internet connectivity

#### **Structured Data Collection**
- **Action Selection**: Choose from predefined garden-specific activities
- **Plant Cataloging**: Species selection and count tracking
- **Metadata Capture**: Soil conditions, weather, timing information
- **Progress Tracking**: Before/after documentation workflows

#### **Work Submission Process**
1. **Garden Selection**: Choose active garden for work submission
2. **Action Type**: Select from available regenerative activities
3. **Documentation**: Capture photos, videos, and descriptions
4. **Plant Details**: Specify species, quantities, and locations
5. **Review & Submit**: Validate information before submission

### Data Structure

```typescript
interface WorkSubmission {
  gardenAddress: string;
  actionUID: number;
  metadata: {
    plantSelection: string[];
    plantCount: number;
    description: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  media: File[];
  timestamp: number;
}
```

### Quality Assurance

- **Content Validation**: Automated checks for required fields
- **Image Processing**: Automatic compression and format optimization
- **Duplicate Detection**: Prevent accidental duplicate submissions
- **Data Integrity**: Cryptographic hashing for tamper detection

---

## Work Approval Workflow

The approval system enables garden operators and community members to review and validate submitted work.

### Approval Process

#### **Review Interface**
- **Comprehensive Display**: All work metadata and media in organized view
- **Garden Context**: Clear garden information and action requirements
- **Evidence Analysis**: Full-screen media viewing and metadata review
- **Feedback System**: Structured approval/rejection with comments

#### **Decision Framework**
- **Binary Approval**: Clear approve/reject decisions
- **Feedback Requirement**: Mandatory comments for all decisions
- **Quality Standards**: Garden-specific criteria for work validation
- **Appeal Process**: Mechanisms for dispute resolution

#### **Approval Flow**
1. **Work Assignment**: Automatic routing to qualified reviewers
2. **Evidence Review**: Comprehensive evaluation of submission
3. **Decision Making**: Approve/reject with detailed feedback
4. **Blockchain Recording**: EAS attestation for final decision
5. **Notification**: Automatic updates to all stakeholders

### Reviewer Management

- **Role-Based Access**: Different approval permissions by garden role
- **Expertise Matching**: Route work to qualified reviewers
- **Conflict Resolution**: Multi-reviewer systems for disputed decisions
- **Performance Tracking**: Reviewer accuracy and response time metrics

---

## Offline Support Architecture

Green Goods is designed as an **offline-first application** that provides full functionality without internet connectivity.

### Core Offline Components

#### **Storage Management** (`storage-manager.ts`)
- **Quota Monitoring**: Real-time storage usage tracking
- **Automated Cleanup**: Intelligent storage management policies
- **Performance Analytics**: Storage breakdown and optimization recommendations
- **Capacity Planning**: Predictive storage requirement analysis

```typescript
const storageManager = new StorageManager({
  thresholdPercentage: 85,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  priorityOrder: ["old_completed", "failed_items", "large_images", "cache"]
});
```

#### **Offline Synchronization** (`offline-sync.ts`)
- **Automatic Sync**: Periodic and connectivity-based synchronization
- **Work Submission Sync**: Upload work with media to blockchain
- **Approval Sync**: Submit approvals as EAS attestations
- **Error Handling**: Robust retry mechanisms for failed syncs
- **State Management**: Track sync status across app restarts

#### **Conflict Resolution** (`conflict-resolver.ts`)
- **Multi-Type Detection**: Schema, garden, and data conflict identification
- **Automatic Resolution**: Smart merging for compatible conflicts
- **Manual Intervention**: User-guided resolution for complex conflicts
- **Version Management**: Schema and data version compatibility

#### **Deduplication System** (`deduplication.ts`)
- **Content Hashing**: Deterministic fingerprinting of work submissions
- **Local Cache**: Fast duplicate detection without network requests
- **Remote Validation**: Cross-user duplicate prevention
- **Similarity Analysis**: Near-duplicate detection and warnings

#### **Retry Policy** (`retry-policy.ts`)
- **Exponential Backoff**: Intelligent retry scheduling with jitter
- **Priority-Based**: High-priority items get faster retry cycles
- **Failure Handling**: Permanent failure detection and cleanup
- **Statistics**: Comprehensive retry performance analytics

### Offline User Experience

#### **Seamless Operation**
- **Full Functionality**: Complete feature set without connectivity
- **Visual Indicators**: Clear offline/online status communication
- **Pending Sync**: Dashboard of items waiting for synchronization
- **Automatic Recovery**: Seamless transition when connectivity returns

#### **Data Persistence**
- **IndexedDB Storage**: Browser-native structured data storage
- **Media Caching**: Local storage of images and videos
- **State Preservation**: Maintain user progress across sessions
- **Backup Mechanisms**: Redundant storage for critical data

---

## Localization & Internationalization

Green Goods supports multiple languages and cultural contexts to serve global communities.

### Language Support

#### **Current Languages**
- **English** (`en.json`): Primary language with complete coverage
- **Spanish** (`es.json`): Full translation for Spanish-speaking communities  
- **Portuguese** (`pt.json`): Brazilian Portuguese localization

#### **Translation Infrastructure**
- **React Intl**: Industry-standard internationalization framework
- **Message Keys**: Structured, hierarchical translation keys
- **Pluralization**: Proper handling of singular/plural forms
- **Date/Time**: Locale-aware formatting for timestamps
- **Number Formatting**: Currency and measurement localization

### Implementation Example

```typescript
// Translation usage in components
const intl = useIntl();

const message = intl.formatMessage({
  id: "app.garden.workSubmission.title",
  defaultMessage: "Submit Your Work"
});

// Date formatting
const formattedDate = intl.formatDate(new Date(), {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
```

### Cultural Adaptation

#### **Regional Considerations**
- **Plant Species**: Localized plant databases by region
- **Measurement Units**: Metric/Imperial system support
- **Cultural Practices**: Region-specific gardening terminology
- **Legal Compliance**: Local regulatory requirement adaptation

#### **Accessibility**
- **RTL Support**: Right-to-left language compatibility
- **Screen Readers**: ARIA labels and semantic HTML
- **High Contrast**: Visual accessibility improvements
- **Font Scaling**: Responsive text sizing support

---

## Technical Architecture

### Frontend Stack

- **React 18**: Component-based UI with concurrent features
- **TypeScript**: Type-safe development and better DX
- **Vite**: Fast build tooling and hot module replacement
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Performant form handling with validation
- **Biome**: Fast linting and code formatting

### Blockchain Integration

- **Ethereum Attestation Service (EAS)**: Immutable work record storage
- **Viem**: Type-safe Ethereum client library
- **Account Abstraction**: EIP-4337 smart accounts via Pimlico
- **Multi-Chain**: Arbitrum primary with expansion capabilities

### Offline Architecture

- **IndexedDB**: Browser-native structured data storage
- **Service Workers**: Background sync and caching strategies
- **Event-Driven**: Message passing for cross-tab communication
- **State Machines**: Predictable state management for complex flows

### Development Workflow

- **Monorepo**: Unified codebase with package-based organization
- **CI/CD**: Automated testing and deployment pipelines
- **Code Quality**: Comprehensive linting, formatting, and type checking
- **Documentation**: Living documentation with code examples

---

## Security & Privacy

### Data Protection

- **End-to-End Encryption**: Sensitive data encrypted at rest and in transit
- **Minimal Data Collection**: Privacy-first approach to user information
- **Local Storage Priority**: User data stored locally when possible
- **GDPR Compliance**: European privacy regulation adherence

### Blockchain Security

- **Smart Contract Audits**: Professional security reviews
- **Multi-Signature**: Critical operations require multiple approvals
- **Rate Limiting**: Protection against spam and abuse
- **Access Controls**: Role-based permissions and validation

---

## Future Roadmap

### Planned Features

- **Advanced Analytics**: Garden performance and impact metrics
- **Token Economics**: Native token for governance and incentives
- **API Ecosystem**: Third-party integration capabilities
- **AI/Machine Learning**: Automated work validation, audio capture and recommendations

### Scalability Improvements

- **Layer 2 Integration**: Additional blockchain networks
- **P2P Networking**: Decentralized data synchronization
- **Edge Computing**: Regional data processing nodes
- **Advanced Caching**: Intelligent content delivery networks

---

## Getting Started

For developers looking to contribute or understand the codebase:

1. **Repository Setup**: Clone and install dependencies with `bun`
2. **Environment Configuration**: Set up local blockchain and API connections  
3. **Development Server**: Run `bun dev` for hot-reload development
4. **Testing**: Execute `bun test` for comprehensive test coverage
5. **Documentation**: Review inline code documentation and examples

For detailed development instructions, see [DEVELOPMENT.md](../DEVELOPMENT.md). 