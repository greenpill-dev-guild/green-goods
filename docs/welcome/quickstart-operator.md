# Operator Quickstart

> **Need the complete operator toolkit?** Visit the [Operator Hub](../reference/for-operators.md) for curated workflows and references.

Set up and manage your first Green Goods garden in 10 minutes. Coordinate community conservation efforts and validate regenerative work.

---

## What You'll Need

- 🔐 A web3 wallet (MetaMask, WalletConnect, Coinbase Wallet, etc.)
- 💰 Small amount of ETH/CELO for gas (minimal costs on L2s)
- 📧 Operator permissions (granted by admin or existing as deployer)

---

## Who Can Be an Operator?

There are two ways to become an operator:

1. **Admin Grant**: Platform admins can designate you as an operator
2. **Garden Assignment**: Existing operators can add you to their gardens
3. **Deploy Your Own**: Advanced users can deploy contracts (see [developer docs](quickstart-developer.md))

**For this quickstart**, we assume you've been granted operator status or are using the admin allowlist.

---

## Step 1: Access the Admin Dashboard

### 1.1 Navigate to Dashboard

1. **Visit**: [admin.greengoods.app](https://admin.greengoods.app)

<!-- TODO: Add screenshot of admin dashboard login -->
![Admin Dashboard Login](../.gitbook/assets/admin-login.png)
*Connect your wallet to access the admin dashboard*

2. **Connect your wallet**:
   - Click "Connect Wallet"
   - Choose your wallet (MetaMask, WalletConnect, etc.)
   - Approve the connection

3. **Select network**:
   - **Production**: Arbitrum One (42161) or Celo (42220)
   - **Testing**: Base Sepolia (84532)

### 1.2 Verify Permissions

<!-- TODO: Add screenshot showing role detection -->
![Role Detection](../.gitbook/assets/role-detection.png)
*The dashboard detects your role automatically*

**You'll see one of**:
- ✅ **Admin (Deployer)**: Full access to create gardens and manage everything
- ✅ **Operator**: Access to gardens where you're assigned as operator
- ❌ **Unauthorized**: No operator access (contact an admin)

---

## Step 2: Create Your First Garden

**Note**: Only admins can create new gardens. If you're an operator (not admin), skip to [Step 3: Review Work](#step-3-review-work-submissions).

### 2.1 Open Garden Creation

1. **Click "Create Garden"** (top right or main menu)

<!-- TODO: Add screenshot of create garden modal -->
![Create Garden Modal](../.gitbook/assets/create-garden-modal.png)
*Fill in your garden's details*

### 2.2 Fill Garden Details

2. **Garden Information**:
   - **Name**: "Watershed Restoration Initiative" (example)
   - **Description**: Clear mission statement
   - **Location**: "San Francisco Bay Area, CA" (be specific)
   - **Banner Image**: Upload from computer or provide IPFS CID

**Tips**:
- Choose a descriptive, searchable name
- Location helps gardeners find relevant gardens
- Description should explain your garden's mission and goals

### 2.3 Add Initial Members

3. **Add Gardeners** (optional):
   - Enter wallet addresses of initial team members
   - Comma-separated for multiple addresses
   - Can add more later

4. **Add Operators** (optional):
   - Enter wallet addresses of co-operators
   - These users can approve work and manage members
   - Recommend starting with 2-3 trusted operators

### 2.4 Deploy Garden

5. **Review and click "Create Garden"**:
   - Transaction will be sent to your wallet
   - Confirm the transaction
   - Wait for confirmation (~15 seconds on L2s)

6. **Garden created! 🎉**
   - Garden is now live on-chain
   - NFT minted with tokenbound account
   - Karma GAP project attestation created automatically

<!-- TODO: Add screenshot of successful garden creation -->
![Garden Created](../.gitbook/assets/garden-created.png)
*Your garden is now live!*

[Detailed Guide: Managing Gardens →](../guides/operators/managing-gardens.md)

---

## Step 3: Create Actions for Gardeners

Actions define the tasks gardeners can complete in your garden.

### 3.1 Navigate to Actions

1. **Select your garden** from dashboard
2. **Click "Actions" tab**
3. **Click "Create Action"**

<!-- TODO: Add screenshot of create action modal -->
![Create Action Modal](../.gitbook/assets/create-action-modal.png)
*Define a new action for your garden*

### 3.2 Define Action Details

**Basic Information**:
- **Title**: "Plant 10+ Native Trees"
- **Instructions**: Clear, specific requirements
  ```
  Plant at least 10 native tree seedlings in designated restoration areas.
  
  Requirements:
  - Only native species (oak, bay laurel, or redwood)
  - Minimum 10 feet spacing between trees
  - Document with before/after photos
  - Record GPS location
  ```

**Metrics to Track**:
- Trees planted (number)
- Area covered (square meters)
- Species planted (text)

**Time Window** (optional):
- Start date: When action becomes available
- End date: Deadline for completion

**Capital Alignment**:
- Select relevant forms of capital (e.g., Living, Material)

### 3.3 Add Media & Deploy

4. **Upload example photo** (optional):
   - Shows gardeners what good documentation looks like

5. **Click "Create Action"**:
   - Transaction sent to wallet
   - Confirm transaction
   - Action is now live for gardeners

**Result**: Gardeners in your garden can now see and complete this action!

[Detailed Guide: Managing Actions →](../guides/operators/managing-actions.md)

---

## Step 4: Review Work Submissions

As an operator, your primary role is validating gardener work.

### 4.1 View Pending Work

1. **Navigate to "Work Reviews" tab** in dashboard

<!-- TODO: Add screenshot of pending work list -->
![Pending Work List](../.gitbook/assets/pending-work.png)
*See all work awaiting your review*

2. **See pending submissions**:
   - Listed with submission date
   - Shows gardener, action, and preview

### 4.2 Review Submission Details

3. **Click on a submission** to see full details:

<!-- TODO: Add screenshot of work detail view for operators -->
![Work Review Detail](../.gitbook/assets/work-review-detail.png)
*Review media, metrics, and gardener notes*

**Review Checklist**:
- ✅ **Photos**: Are before/after photos clear and relevant?
- ✅ **Metrics**: Are numbers reasonable and accurate?
- ✅ **Instructions**: Did gardener follow action requirements?
- ✅ **Evidence**: Is there sufficient proof of work done?

### 4.3 Approve or Reject

4. **Make your decision**:

**To Approve**:
- Click "Approve"
- Optionally add positive feedback
- Confirm transaction
- ✅ On-chain attestation created
- 🤖 Karma GAP impact attestation triggered

**To Reject**:
- Click "Reject"
- **MUST** provide constructive feedback
- Explain what needs improvement
- Gardener can revise and resubmit

<!-- TODO: Add screenshot of approval confirmation -->
![Approval Confirmation](../.gitbook/assets/approval-confirmation.png)
*Work approved and recorded on-chain*

**What Happens After Approval**:
1. EAS attestation created linking work → approval
2. Karma GAP impact attestation auto-generated
3. Gardener receives notification
4. Work appears in garden's permanent record
5. Metrics aggregate to garden level

[Detailed Guide: Reviewing Work →](../guides/operators/reviewing-work.md)

---

## Step 5: Monitor Garden Health

### 5.1 View Garden Dashboard

1. **Go to your garden's overview page**

<!-- TODO: Add screenshot of garden dashboard -->
![Garden Dashboard](../.gitbook/assets/garden-dashboard.png)
*Track your garden's cumulative impact*

**Key Metrics**:
- Total work submissions
- Approval rate
- Active gardeners
- Cumulative impact metrics

### 5.2 Export Impact Reports

2. **Generate reports for funders**:
   - Click "Export Data"
   - Choose format (CSV/JSON)
   - Include date range
   - Download report

**Use Cases**:
- Grant applications
- Impact reports for funders
- Community progress updates
- Research data sharing

[Detailed Guide: Reporting Impact →](../guides/operators/reporting-impact.md)

---

## Best Practices for Operators

### 🎯 Creating Effective Actions

**Do**:
- ✅ Clear, specific instructions
- ✅ Measurable outcomes
- ✅ Example photos showing good documentation
- ✅ Reasonable scope (2-4 hours of work)

**Don't**:
- ❌ Vague requirements ("improve the garden")
- ❌ Unmeasurable outcomes
- ❌ Overly complex multi-day projects
- ❌ Actions without clear success criteria

### ✅ Reviewing Work Fairly

**Response Time**:
- Aim for 24-48 hour review turnaround
- Set expectations with your gardeners
- Review regularly to avoid backlogs

**Feedback Quality**:
- Be constructive, not critical
- Specific > General ("Add closer photo of planted area" vs "Bad photos")
- Recognize good work publicly
- Help gardeners improve over time

**Consistency**:
- Apply same standards to all gardeners
- Document your review criteria
- Discuss edge cases with co-operators

### 👥 Managing Members

**Adding Gardeners**:
- Vet new members when possible
- Start with small group, grow over time
- Remove inactive or low-quality contributors

**Adding Co-Operators**:
- Choose trusted community members
- Look for consistent, fair reviewers
- Train new operators on your standards

---

## Advanced Operator Features

### Multi-Garden Management

- Manage multiple gardens from one dashboard
- Switch between gardens easily
- Track cumulative impact across all gardens

### Karma GAP Integration

Your approved work automatically:
- Creates Karma GAP impact attestations
- Reports to standardized framework
- Enables transparent accountability

[Learn more about Karma GAP →](../developer/karma-gap.md)

### Future: Hypercerts

Coming soon:
- Aggregate garden work into Hypercerts
- Enable retroactive funding
- Fractionalize impact tokens

[Learn more about Hypercerts →](../concepts/hypercerts.md)

---

## Troubleshooting

### "Can't create garden"

- Verify you're using an admin wallet address
- Check you're connected to the correct network
- Ensure you have gas for transaction

### "Approval transaction failing"

- Check wallet has sufficient gas
- Verify you're an operator of this garden
- Try refreshing page and reconnecting wallet

### "Gardener not seeing action"

- Verify gardener is added to garden
- Check action is activated (not paused)
- Confirm gardener is on correct network

---

## Learn More

### Detailed Operator Guides

- [Managing Gardens](../guides/operators/managing-gardens.md)
- [Creating & Managing Actions](../guides/operators/managing-actions.md)
- [Reviewing & Approving Work](../guides/operators/reviewing-work.md)
- [Reporting & Impact](../guides/operators/reporting-impact.md)

### Understanding the System

- [Gardens & Work](../concepts/gardens-and-work.md)
- [Attestations & On-Chain Records](../concepts/attestations.md)
- [Roles & Responsibilities](../concepts/roles.md)

### Get Help

- 💬 **Operator Community**: [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- 📖 **Admin README**: [packages/admin/README.md](../../packages/admin/README.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/greenpill-dev-guild/green-goods/issues)

---

## What's Next?

You're now managing a Green Goods garden! 🎉

**Your operator responsibilities**:
- ✅ Create and manage actions
- ✅ Review work submissions fairly
- ✅ Provide constructive feedback
- ✅ Track garden impact metrics
- ✅ Generate reports for funders

**Keep building**:
- Add more diverse actions
- Grow your gardener community
- Coordinate with other gardens
- Share impact stories

---

<p align="center">
  <strong>Ready to start coordinating impact?</strong><br>
  <a href="https://admin.greengoods.app">Open Admin Dashboard →</a>
</p>

