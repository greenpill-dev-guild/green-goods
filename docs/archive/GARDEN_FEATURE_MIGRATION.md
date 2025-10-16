# Garden Feature Migration Guide

This document outlines the garden management features that were previously available as CLI scripts and need to be migrated to the admin dashboard UI.

## Overview

The Green Goods project previously had CLI scripts for garden management. With the creation of the admin dashboard, basic member management (add/remove gardeners and operators) has been implemented in the UI. However, several advanced features still need to be migrated.

## Migration Status

### ✅ Already Implemented in Dashboard

- **Individual Member Management**
  - Add single gardener (`useGardenOperations.addGardener`)
  - Remove single gardener (`useGardenOperations.removeGardener`)
  - Add single operator (`useGardenOperations.addOperator`)
  - Remove single operator (`useGardenOperations.removeOperator`)
  - View garden details and member lists (`/gardens/:id`)
  - Permission checks for garden operations (`useGardenPermissions`)

### 🔄 Features to Migrate

## High Priority Features

### 1. Batch Member Operations

**Previous CLI:** `batch-garden-operations.js`

**Functionality:**
- Add/remove multiple gardeners at once
- Add/remove multiple operators at once
- Update multiple gardens in a single operation
- Bulk operations from configuration files

**Implementation Guide:**

#### UI Components Needed
```typescript
// Component: BulkMemberModal.tsx
interface BulkMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenId: string;
  operation: 'addGardeners' | 'removeGardeners' | 'addOperators' | 'removeOperators';
}
```

#### Hook Extension
Add to `useGardenOperations.ts`:
```typescript
const addMultipleGardeners = async (addresses: string[]) => {
  const results = [];
  for (const address of addresses) {
    try {
      await addGardener(address);
      results.push({ address, success: true });
    } catch (error) {
      results.push({ address, success: false, error });
    }
  }
  return results;
};
```

#### Best Practices
- Use progress indicators for batch operations
- Show individual success/failure status for each address
- Implement retry mechanism for failed operations
- Consider using multicall for gas optimization
- Add dry-run preview before executing

#### Resources
- [Viem Multicall](https://viem.sh/docs/actions/public/multicall.html)
- [React Hook Form Array Fields](https://react-hook-form.com/api/usefieldarray)

---

### 2. Garden Information Updates

**Previous CLI:** `update-garden-info.js`

**Functionality:**
- Update garden name
- Update garden description
- Update garden location
- Update banner image

**Implementation Guide:**

#### Contract Functions
Garden accounts support these update functions:
```solidity
function updateName(string memory newName) external;
function updateDescription(string memory newDescription) external;
function updateLocation(string memory newLocation) external;
function updateBannerImage(string memory newBannerImage) external;
```

#### UI Components Needed
```typescript
// Component: EditGardenModal.tsx
interface EditGardenModalProps {
  garden: Garden;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

#### Hook Implementation
Create `useGardenInfoUpdates.ts`:
```typescript
export function useGardenInfoUpdates(gardenId: string) {
  const { data: walletClient } = useWalletClient();
  
  const updateName = async (newName: string) => {
    await walletClient.writeContract({
      address: gardenId as `0x${string}`,
      abi: GardenAccountABI.abi,
      functionName: "updateName",
      args: [newName],
    });
  };
  
  // Similar for updateDescription, updateLocation, updateBannerImage
  
  return { updateName, updateDescription, updateLocation, updateBannerImage };
}
```

#### Best Practices
- Validate inputs before submission (max lengths, required fields)
- Show preview of changes before confirming
- Handle IPFS upload for banner images (use existing `uploadFileToIPFS`)
- Implement optimistic UI updates with rollback on error
- Add edit button only for garden operators

#### Resources
- [React Hook Form Validation](https://react-hook-form.com/get-started#Applyvalidation)
- [Pinata IPFS Upload](https://docs.pinata.cloud/quickstart)

---

### 3. Export Functionality

**Previous CLI:** `garden-export.js`

**Functionality:**
- Export garden member list to CSV
- Export garden member list to JSON
- Include historical member data (inactive members)
- Filter by role (gardeners, operators, or both)

**Implementation Guide:**

#### UI Components Needed
```typescript
// Component: ExportModal.tsx
interface ExportModalProps {
  gardenId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ExportOptions {
  format: 'csv' | 'json';
  includeInactive: boolean;
  roles: ('gardeners' | 'operators')[];
}
```

#### Implementation Strategy

**Client-side Export:**
```typescript
// utils/exportGarden.ts
export function exportGardenToCSV(garden: Garden) {
  const headers = ['address', 'role', 'status'];
  const rows = [
    ...garden.gardeners.map(addr => [addr, 'gardener', 'active']),
    ...garden.operators.map(addr => [addr, 'operator', 'active'])
  ];
  
  const csv = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `garden-${garden.name}-${Date.now()}.csv`;
  a.click();
}

export function exportGardenToJSON(garden: Garden) {
  const data = {
    garden: {
      id: garden.id,
      name: garden.name,
      description: garden.description,
      location: garden.location,
    },
    members: {
      gardeners: garden.gardeners,
      operators: garden.operators,
    },
    exportedAt: new Date().toISOString(),
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `garden-${garden.name}-${Date.now()}.json`;
  a.click();
}
```

**For Historical Data:**
Query blockchain events through GraphQL:
```graphql
query GetGardenHistory($gardenId: String!) {
  GardenerAdded(where: { garden: { _eq: $gardenId } }) {
    gardener
    blockTimestamp
  }
  GardenerRemoved(where: { garden: { _eq: $gardenId } }) {
    gardener
    blockTimestamp
  }
}
```

#### Best Practices
- Add export button to garden detail page
- Show preview of data before export
- Include metadata (garden info, export date)
- For large datasets, consider server-side generation
- Add timestamp to filename to prevent overwrites

#### Resources
- [CSV Export in React](https://www.npmjs.com/package/react-csv)
- [File Download in Browser](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)

---

## Medium Priority Features

### 4. Garden Analytics Dashboard

**Previous CLI:** `garden-analytics.js`

**Functionality:**
- Member growth metrics (net growth, churn rate)
- Activity timeline (daily event breakdown)
- Active vs inactive members
- Operator activity tracking
- Time-based reports (7d, 30d, 90d, all-time)

**Implementation Guide:**

#### Data Source
Use the Envio indexer GraphQL API to query historical events:

```graphql
query GetGardenAnalytics($gardenId: String!, $fromTimestamp: Int!) {
  GardenerAdded(
    where: { 
      garden: { _eq: $gardenId }
      blockTimestamp: { _gte: $fromTimestamp }
    }
    order_by: { blockTimestamp: asc }
  ) {
    gardener
    blockTimestamp
    transactionHash
  }
  
  GardenerRemoved(
    where: { 
      garden: { _eq: $gardenId }
      blockTimestamp: { _gte: $fromTimestamp }
    }
    order_by: { blockTimestamp: asc }
  ) {
    gardener
    blockTimestamp
    transactionHash
  }
  
  GardenOperatorAdded(
    where: { 
      garden: { _eq: $gardenId }
      blockTimestamp: { _gte: $fromTimestamp }
    }
  ) {
    operator
    blockTimestamp
  }
  
  GardenOperatorRemoved(
    where: { 
      garden: { _eq: $gardenId }
      blockTimestamp: { _gte: $fromTimestamp }
    }
  ) {
    operator
    blockTimestamp
  }
}
```

#### UI Components Needed

```typescript
// views/Gardens/Analytics.tsx
interface AnalyticsViewProps {
  gardenId: string;
}

interface AnalyticsMetrics {
  totalGardeners: number;
  totalOperators: number;
  gardenersAdded: number;
  gardenersRemoved: number;
  operatorsAdded: number;
  operatorsRemoved: number;
  netGrowth: number;
  churnRate: number;
  activityByDay: Record<string, number>;
}
```

#### Calculations

```typescript
// hooks/useGardenAnalytics.ts
export function useGardenAnalytics(gardenId: string, period: '7d' | '30d' | '90d' | 'all') {
  const fromTimestamp = calculateTimestamp(period);
  
  const [{ data }] = useQuery({
    query: GET_GARDEN_ANALYTICS,
    variables: { gardenId, fromTimestamp },
  });
  
  const metrics = useMemo(() => {
    const gardenersAdded = data?.GardenerAdded?.length || 0;
    const gardenersRemoved = data?.GardenerRemoved?.length || 0;
    const netGrowth = gardenersAdded - gardenersRemoved;
    const churnRate = gardenersAdded > 0 
      ? (gardenersRemoved / gardenersAdded) * 100 
      : 0;
    
    // Group events by day
    const activityByDay = groupEventsByDay([
      ...data?.GardenerAdded || [],
      ...data?.GardenerRemoved || [],
      ...data?.GardenOperatorAdded || [],
      ...data?.GardenOperatorRemoved || [],
    ]);
    
    return {
      gardenersAdded,
      gardenersRemoved,
      netGrowth,
      churnRate,
      activityByDay,
    };
  }, [data]);
  
  return { metrics, loading, error };
}
```

#### Chart Libraries

Recommended: [Recharts](https://recharts.org/) (already commonly used in React projects)

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

<LineChart data={activityData}>
  <XAxis dataKey="date" />
  <YAxis />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip />
  <Line type="monotone" dataKey="events" stroke="#10b981" />
</LineChart>
```

#### Best Practices
- Cache analytics data (use URQL cache)
- Show loading skeleton for slow queries
- Add date range selector
- Export analytics reports
- Use color coding for positive/negative growth

#### Resources
- [Recharts Documentation](https://recharts.org/en-US/)
- [Date-fns for Date Manipulation](https://date-fns.org/)
- [URQL Caching](https://formidable.com/open-source/urql/docs/basics/document-caching/)

---

### 5. Comprehensive Status Overview

**Previous CLI:** `garden-status.js`

**Functionality:**
- Current member counts
- Recent activity summary
- Contract addresses
- Garden metadata
- Permission status for current user

**Implementation Guide:**

#### Enhanced Garden Detail View

Add a "Status" section to the garden detail page:

```typescript
// components/Garden/StatusOverview.tsx
interface StatusOverviewProps {
  garden: Garden;
}

export function StatusOverview({ garden }: StatusOverviewProps) {
  const { address } = useAuth();
  const permissions = useGardenPermissions();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatusCard
        title="Members"
        value={garden.gardeners.length + garden.operators.length}
        subtitle={`${garden.gardeners.length} gardeners, ${garden.operators.length} operators`}
      />
      <StatusCard
        title="Your Role"
        value={getUserRole(garden, address)}
        subtitle={permissions.canManageGarden(garden) ? 'Can manage' : 'Read only'}
      />
      <StatusCard
        title="Chain"
        value={`Chain ${garden.chainId}`}
        subtitle={`Token #${garden.tokenID}`}
      />
    </div>
  );
}
```

#### Activity Feed

```typescript
// components/Garden/ActivityFeed.tsx
export function ActivityFeed({ gardenId }: { gardenId: string }) {
  const [{ data }] = useQuery({
    query: GET_RECENT_ACTIVITY,
    variables: { gardenId, limit: 10 },
  });
  
  return (
    <div className="space-y-2">
      {data?.events.map(event => (
        <ActivityItem
          key={event.id}
          type={event.type}
          address={event.address}
          timestamp={event.blockTimestamp}
          txHash={event.transactionHash}
        />
      ))}
    </div>
  );
}
```

#### Best Practices
- Show real-time status updates
- Add quick action buttons (add member, edit info)
- Display contract verification status
- Show explorer links for on-chain data
- Refresh data automatically (polling or subscriptions)

---

## Lower Priority Features

### 6. Real-time Event Monitoring

**Previous CLI:** `monitor-garden-events.js`

**Functionality:**
- Live event stream for garden activities
- Filter by event type
- Historical event scanning
- Event notifications

**Implementation Guide:**

#### GraphQL Subscriptions

Envio supports subscriptions for real-time updates:

```typescript
// hooks/useGardenEvents.ts
import { useSubscription } from 'urql';

const GARDEN_EVENTS_SUBSCRIPTION = graphql(`
  subscription OnGardenEvents($gardenId: String!) {
    GardenerAdded(where: { garden: { _eq: $gardenId } }) {
      gardener
      updater
      blockTimestamp
      transactionHash
    }
    GardenerRemoved(where: { garden: { _eq: $gardenId } }) {
      gardener
      updater
      blockTimestamp
      transactionHash
    }
  }
`);

export function useGardenEvents(gardenId: string) {
  const [{ data }] = useSubscription({
    query: GARDEN_EVENTS_SUBSCRIPTION,
    variables: { gardenId },
  });
  
  return data;
}
```

#### UI Components

```typescript
// components/Garden/EventMonitor.tsx
export function EventMonitor({ gardenId }: { gardenId: string }) {
  const events = useGardenEvents(gardenId);
  
  return (
    <div className="space-y-2">
      {events?.map(event => (
        <EventCard
          key={event.transactionHash}
          event={event}
          isNew={isRecent(event.blockTimestamp)}
        />
      ))}
    </div>
  );
}
```

#### Best Practices
- Use WebSocket connections for real-time updates
- Add visual indicators for new events (animation, badge)
- Implement event filtering and search
- Show transaction status (pending, confirmed, failed)
- Add sound/toast notifications for important events
- Auto-scroll to new events

#### Resources
- [URQL Subscriptions](https://formidable.com/open-source/urql/docs/advanced/subscriptions/)
- [Envio Subscriptions](https://docs.envio.dev/docs/graphql-api#subscriptions)

---

### 7. CSV Import for Bulk Members

**Previous CLI:** Functionality from `add-garden-members.js`

**Functionality:**
- Upload CSV file with member addresses
- Validate addresses before importing
- Batch add members with progress tracking
- Support for role assignment (gardener/operator)

**Implementation Guide:**

#### CSV Format
```csv
address,role
0x1234567890123456789012345678901234567890,gardener
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,operator
```

#### File Upload Component

```typescript
// components/Garden/ImportMembersModal.tsx
interface ImportMembersModalProps {
  gardenId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImportMembersModal({ gardenId, isOpen, onClose }: ImportMembersModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedMember[]>([]);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const members = await parseCSV(file);
    setPreview(members);
    setFile(file);
  };
  
  const handleImport = async () => {
    // Validate and import members
    const results = await importMembers(gardenId, preview);
    // Show results
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      {preview.length > 0 && (
        <PreviewTable members={preview} />
      )}
      <button onClick={handleImport}>Import {preview.length} Members</button>
    </Modal>
  );
}
```

#### CSV Parsing

```typescript
// utils/csvParser.ts
interface ParsedMember {
  address: string;
  role: 'gardener' | 'operator';
  valid: boolean;
  error?: string;
}

export async function parseCSV(file: File): Promise<ParsedMember[]> {
  const text = await file.text();
  const lines = text.split('\n').slice(1); // Skip header
  
  return lines.map(line => {
    const [address, role] = line.split(',').map(s => s.trim());
    
    const valid = isAddress(address) && 
                  (role === 'gardener' || role === 'operator');
    
    return {
      address,
      role: role as 'gardener' | 'operator',
      valid,
      error: valid ? undefined : 'Invalid address or role',
    };
  }).filter(m => m.address); // Remove empty lines
}
```

#### Best Practices
- Validate all addresses before import
- Show preview with validation status
- Allow removing invalid entries
- Implement progress bar for batch import
- Handle partial failures gracefully
- Provide downloadable error report
- Support drag-and-drop file upload

#### Resources
- [React Dropzone](https://react-dropzone.js.org/)
- [Papa Parse (CSV Parser)](https://www.papaparse.com/)
- [Viem Address Validation](https://viem.sh/docs/utilities/isAddress.html)

---

## Technical Architecture

### State Management

The admin dashboard uses Zustand for state management:

```typescript
// stores/admin.ts - Already exists
interface AdminState {
  selectedGarden: Garden | null;
  setSelectedGarden: (garden: Garden | null) => void;
}
```

For new features, extend this store or create feature-specific stores.

### Data Fetching

The dashboard uses URQL for GraphQL queries:

```typescript
import { useQuery, useMutation } from 'urql';
import { graphql } from 'gql.tada';

// Define queries with gql.tada for type safety
const GET_GARDEN = graphql(`
  query GetGarden($id: String!) {
    Garden(where: { id: { _eq: $id } }) {
      id
      name
      # ...
    }
  }
`);
```

### Contract Interactions

Use Wagmi hooks for blockchain interactions:

```typescript
import { useWalletClient, usePublicClient } from 'wagmi';

const { data: walletClient } = useWalletClient();
await walletClient.writeContract({
  address: gardenId,
  abi: GardenAccountABI.abi,
  functionName: 'addGardener',
  args: [gardenerAddress],
});
```

### Toast Notifications

Use the existing toast system for user feedback:

```typescript
import { useToastAction } from '@/hooks/useToastAction';

const { executeWithToast } = useToastAction();
await executeWithToast(
  async () => { /* operation */ },
  {
    loadingMessage: 'Processing...',
    successMessage: 'Success!',
    errorMessage: 'Failed',
  }
);
```

---

## Development Workflow

### 1. Feature Branch Creation
```bash
git checkout -b feature/garden-batch-operations
```

### 2. Component Development
- Create feature components in `packages/admin/src/components/Garden/`
- Add hooks in `packages/admin/src/hooks/`
- Extend existing hooks rather than creating new ones when possible

### 3. GraphQL Queries
- Add new queries to component files using `gql.tada`
- Test queries in Envio GraphQL playground first
- Ensure proper error handling

### 4. Testing
```bash
cd packages/admin
bun test
```

### 5. Integration
- Add feature to garden detail view or create new route
- Update navigation if needed
- Add permission checks using `useGardenPermissions`

---

## Testing Checklist

For each new feature:

- [ ] Unit tests for utility functions
- [ ] Component tests with React Testing Library
- [ ] Integration tests for workflows
- [ ] Manual testing on testnet (Base Sepolia)
- [ ] Permission checks work correctly
- [ ] Error states display properly
- [ ] Loading states are smooth
- [ ] Toast notifications are informative
- [ ] Mobile responsive design
- [ ] Dark mode support

---

## Code Style Guidelines

### TypeScript
- Use strict TypeScript (`strict: true`)
- Define interfaces for all props and data structures
- Use `const` for immutable values
- Prefer type inference where clear

### React
- Use functional components with hooks
- Extract reusable logic into custom hooks
- Keep components focused (single responsibility)
- Use proper TypeScript types, not `any`

### Styling
- Use Tailwind utility classes
- Follow dark mode patterns: `className="bg-white dark:bg-gray-900"`
- Responsive design: `className="grid grid-cols-1 md:grid-cols-3"`
- Use existing UI components from `components/ui/`

### GraphQL
- Use `gql.tada` for type-safe queries
- Handle loading and error states
- Use fragments for reusable query parts
- Optimize query performance (only fetch needed fields)

---

## Common Patterns

### Modal Pattern
```typescript
const [isOpen, setIsOpen] = useState(false);

<button onClick={() => setIsOpen(true)}>Open Modal</button>
<MyModal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
/>
```

### Loading State Pattern
```typescript
const [{ data, fetching, error }] = useQuery({ query });

if (fetching) return <LoadingSkeleton />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

return <Content data={data} />;
```

### Permission Check Pattern
```typescript
const permissions = useGardenPermissions();
const canManage = garden ? permissions.canManageGarden(garden) : false;

{canManage && <ActionButton />}
```

---

## Performance Considerations

### Optimization Techniques
1. **Memoization**: Use `useMemo` for expensive calculations
2. **Debouncing**: Debounce user input (search, filters)
3. **Virtual Scrolling**: For large lists (react-virtual)
4. **Code Splitting**: Lazy load heavy features
5. **GraphQL Caching**: Leverage URQL cache properly

### Example: Debounced Search
```typescript
import { useDebouncedValue } from '@/hooks/useDebounce';

const [search, setSearch] = useState('');
const debouncedSearch = useDebouncedValue(search, 300);

// Use debouncedSearch in query
```

---

## Security Considerations

### Address Validation
Always validate Ethereum addresses:
```typescript
import { isAddress } from 'viem';

if (!isAddress(inputAddress)) {
  throw new Error('Invalid Ethereum address');
}
```

### Permission Checks
Never trust client-side permissions alone - contracts enforce on-chain:
```typescript
// Show UI based on permissions
const canManage = permissions.canManageGarden(garden);

// But contract will revert if not authorized
await gardenContract.addGardener(address); // ✅ Will revert if caller not operator
```

### Input Sanitization
- Validate all user inputs
- Prevent XSS in user-generated content
- Use proper escaping for displayed data

---

## Resources

### Documentation
- [Wagmi Documentation](https://wagmi.sh/)
- [Viem Documentation](https://viem.sh/)
- [URQL Documentation](https://formidable.com/open-source/urql/)
- [Envio Documentation](https://docs.envio.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [Tailwind CSS](https://tailwindcss.com/)

### Tools
- [GraphQL Playground](http://localhost:8080/graphql) - Test queries locally
- [Envio Explorer](https://envio.dev/) - Production GraphQL endpoint
- [BaseScan](https://sepolia.basescan.org/) - Block explorer for testing
- [Tenderly](https://tenderly.co/) - Transaction debugging

### Green Goods Specific
- Contract ABIs: `packages/admin/src/utils/contracts.ts`
- GraphQL Types: Auto-generated by `gql.tada`
- Deployment Addresses: `packages/contracts/deployments/`

---

## Getting Help

### Internal Resources
1. Check existing components in `packages/admin/src/components/`
2. Review existing hooks in `packages/admin/src/hooks/`
3. Look at similar features (e.g., AddMemberModal for modals)
4. Check the contracts for available functions

### When Stuck
1. Test GraphQL queries in playground first
2. Add console.logs to debug data flow
3. Check browser console for errors
4. Use React DevTools to inspect component state
5. Check network tab for failed requests

---

## Priority Roadmap

### Phase 1 (MVP)
1. Garden info updates (High Priority #2)
2. Export functionality (High Priority #3)

### Phase 2 (Enhanced Features)
3. Batch member operations (High Priority #1)
4. Basic analytics dashboard (Medium Priority #4)

### Phase 3 (Advanced Features)
5. Comprehensive status overview (Medium Priority #5)
6. CSV import (Lower Priority #7)

### Phase 4 (Real-time)
7. Event monitoring and subscriptions (Lower Priority #6)

---

## Notes

- All features should work offline when possible (PWA capability)
- Design for mobile-first responsive layouts
- Follow the existing design system and patterns
- Test on both light and dark modes
- Consider accessibility (ARIA labels, keyboard navigation)
- Add proper loading states and error boundaries
- Document complex logic with inline comments

---

## Questions?

For questions about:
- **Contract functionality**: Check `packages/contracts/src/accounts/Garden.sol`
- **GraphQL schema**: Check `packages/indexer/schema.graphql`
- **Existing patterns**: Review `packages/admin/src/views/Gardens/Detail.tsx`
- **Authentication**: Review `packages/admin/src/providers/AuthProvider.tsx`

