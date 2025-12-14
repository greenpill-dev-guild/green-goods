# MDR Workflow (Media → Details → Review)

The MDR workflow is Green Goods' signature three-step process for documenting regenerative work. Simple, fast, and designed for mobile-first field documentation.

---

## Why MDR?

Traditional impact reporting is complex and time-consuming. MDR reduces documentation to three intuitive steps that anyone can complete in under 2 minutes.

### The Problem MDR Solves

**Before Green Goods**:
- 📋 15+ form fields to fill
- 📎 Multiple file upload processes
- 📧 Email submissions with unclear status
- ⏰ 20-30 minutes per submission
- 🔄 Repeated data entry

**With MDR**:
- 📸 Take 2-3 photos
- ✍️ Fill key details (< 5 fields)
- ✅ Review and submit
- ⏰ < 2 minutes total
- 🌐 Works offline

---

## Step 1: Media

**Capture visual evidence of your work.**

### What to Photograph

**Before Photo** 📸
- Shows initial state
- Makes impact clear through contrast
- Include context (surroundings, scale)

**After Photo** 📸
- Same angle/framing as before
- Shows the change you made
- Visible evidence of work completed

**Optional: Detail Photos** 📸
- Close-ups of specific work
- Process documentation
- Team photos (optional)

### Photo Tips

✅ **Good Practices**:
- Use natural lighting
- Keep camera steady
- Same angle for before/after
- Include scale reference (person, tool)
- Capture wide view showing area

❌ **Avoid**:
- Blurry or dark photos
- Different angles for before/after
- Excessive filters
- Photos without context
- Using old/stock photos

<!-- TODO: Add before/after photo examples -->
![Good Before/After Example](../.gitbook/assets/mdr-before-after-example.png)
*Example of effective before/after documentation*

### Offline Support

**Photos are stored locally** if you're offline:
- Saved in device storage
- Queued for upload
- Automatically synced when online
- Never lost

**Best Practice**: Take photos in the field immediately after completing work, even without internet.

---

## Step 2: Details

**Provide context and metrics about your work.**

### Required Information

**Action Selection**:
- Choose which action you completed
- Actions are pre-defined by garden operators

**Title** (optional but recommended):
- Brief description of what you did
- Auto-generated from action if blank
- Example: "Planted 15 oak trees in north section"

**Metrics**:
- Numbers specific to the action
- Examples:
  - Trees planted: 15
  - Area covered: 300 sqm
  - Species: Quercus agrifolia (Coast live oak)
  - Bags of litter: 4

**Location**:
- Auto-detected from device GPS
- Can be manually adjusted if needed
- Helps map cumulative impact

### Optional Information

**Notes/Feedback**:
- Additional context
- Challenges encountered
- Observations worth sharing

**Metadata** (stored as JSON):
- Custom fields based on action
- Flexible structure
- Can include any relevant data

### Form Interface

The details form is:
- ✅ Mobile-optimized
- ✅ Auto-saves as you type
- ✅ Pre-populated from action definition
- ✅ Clear validation errors
- ✅ Works offline

<!-- TODO: Add screenshot of details form -->
![Details Form](../.gitbook/assets/mdr-details-form.png)
*Fill in metrics and context for your work*

---

## Step 3: Review

**Preview and confirm your submission before sending.**

### What You'll See

**Visual Preview**:
- All uploaded photos in gallery
- Title and description
- Selected action
- All metrics displayed
- Location (if shared)

**Submission Summary**:
```
Action: Plant 10+ Native Trees
Photos: 3 (2 required)
Metrics: 
  - Trees planted: 15
  - Species: Coast live oak
  - Area: 300 sqm
Location: River Valley Park
```

### Pre-Submission Checks

✅ **Photos uploaded**: All media synced (or queued if offline)
✅ **Required fields complete**: No validation errors
✅ **Metrics accurate**: Double-check numbers
✅ **Location correct**: GPS data looks right

### Submit Button

**When you click "Submit"**:
1. ✅ Data saved to IndexedDB (local)
2. ✅ Photos uploaded to IPFS (via Storacha)
3. ✅ Attestation prepared with IPFS CIDs
4. ✅ Transaction queued (passkey) or sent (wallet)
5. ✅ Confirmation shown

<!-- TODO: Add screenshot of review screen -->
![Review Screen](../.gitbook/assets/mdr-review-screen.png)
*Review before submitting to ensure accuracy*

---

## The Complete MDR Flow

```
1. MEDIA
   ├─ Take before photo
   ├─ Complete work
   ├─ Take after photo
   └─ Take detail photos (optional)
   
2. DETAILS
   ├─ Select action
   ├─ Fill title (optional)
   ├─ Enter metrics
   ├─ Add notes (optional)
   └─ Confirm location
   
3. REVIEW
   ├─ Preview submission
   ├─ Verify photos uploaded
   ├─ Check metrics accuracy
   └─ Submit
   
4. PROCESSING
   ├─ Upload media to IPFS
   ├─ Create attestation data
   ├─ Send transaction
   └─ Await operator review
```

---

## After Submission

### Immediate Feedback

**You'll see**:
- ✅ Confirmation message
- 📊 Submission added to your dashboard
- ⏳ Status: "Pending review"
- 🔗 Transaction hash (if online)

### What Happens Next

**Operator Review** (24-48 hours typically):
1. Operator views your submission
2. Reviews photos and details
3. Approves or rejects with feedback

**If Approved** ✅:
- On-chain attestation created
- Karma GAP impact attestation triggered
- You receive confirmation
- Work added to garden's permanent record

**If Rejected** ❌:
- Operator provides feedback
- You can revise and resubmit
- Original submission archived

---

## MDR Best Practices

### For Quality Submissions

**Photos**:
- ✅ Clear, well-lit images
- ✅ Consistent before/after framing
- ✅ Include scale and context
- ✅ Take immediately after work

**Metrics**:
- ✅ Count carefully (don't guess)
- ✅ Use consistent units
- ✅ Be honest about challenges
- ✅ Note unusual conditions

**Context**:
- ✅ Explain your approach
- ✅ Share learnings
- ✅ Note collaborations
- ✅ Include relevant observations

### Common Mistakes to Avoid

❌ **Rushed Documentation**:
- Taking photos after leaving site
- Forgetting to capture "before" state
- Estimating instead of counting

❌ **Poor Photo Quality**:
- Blurry images
- Wrong angle for before/after
- No context showing area

❌ **Incomplete Details**:
- Missing required metrics
- Vague descriptions
- No location data

❌ **Inaccurate Information**:
- Inflated numbers
- Wrong action selected
- Misleading photos

---

## Offline MDR

MDR is designed to work **completely offline** in the field.

### Offline Capabilities

**When offline, you can**:
- ✅ Take and store photos locally
- ✅ Fill out all form fields
- ✅ Submit to local queue
- ✅ View pending submissions

**Automatic sync when online**:
1. Photos upload to IPFS
2. Form data prepared as attestation
3. Transaction submitted
4. Status updated to "Pending review"

### Offline Indicator

The app shows your connection status:
- 🟢 **Online**: Immediate submission
- 🔴 **Offline**: Queued for sync
- 🟡 **Syncing**: Upload in progress

---

## Advanced: Batch Submissions

**Coming soon**: Document multiple tasks at once:

1. Take all photos in field
2. Return to coverage area
3. Batch upload all submissions
4. Save time, reduce redundancy

---

## MDR vs. Traditional Methods

| Aspect | Traditional | MDR Workflow |
|--------|------------|--------------|
| **Time** | 20-30 min | < 2 min |
| **Fields** | 15+ | 5 core |
| **Offline** | No | Yes |
| **Mobile** | Poor | Optimized |
| **Media** | Email attachment | Integrated |
| **Verification** | Manual | On-chain |
| **Status Tracking** | Email | Real-time |

---

## Developer Note: MDR Implementation

For developers building on Green Goods:

### Frontend (React)

```typescript
// MDR state machine using XState (example)
const mdrMachine = createMachine({
  initial: 'media',
  states: {
    media: {
      on: { NEXT: 'details' }
    },
    details: {
      on: { 
        NEXT: 'review',
        BACK: 'media'
      }
    },
    review: {
      on: {
        SUBMIT: 'submitting',
        BACK: 'details'
      }
    },
    submitting: {
      on: {
        SUCCESS: 'complete',
        ERROR: 'review'
      }
    }
  }
});
```

### Data Structure

```typescript
interface WorkSubmission {
  actionUID: number;
  title: string;
  feedback: string; // User notes
  metadata: Record<string, any>; // Flexible metrics
  media: string[]; // IPFS CIDs
  location?: { lat: number; lng: number };
  timestamp: number;
}
```

---

## Learn More

- [Gardens & Work](gardens-and-work.md) — Understanding the broader context
- [Attestations](attestations.md) — How submissions become on-chain records
- [Gardener Guide: Logging Work](../guides/gardeners/logging-work.md) — Detailed step-by-step
- [Best Practices Guide](../guides/gardeners/best-practices.md) — Tips for quality submissions

