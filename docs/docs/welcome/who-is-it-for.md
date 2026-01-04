# Who Is Green Goods For?

Green Goods serves four distinct audiences, each with unique needs and workflows. Whether you're doing hands-on conservation work, coordinating a community, analyzing impact data, or building regenerative tech—Green Goods has tools for you.

---

## 🌱 Gardeners: On-the-Ground Impact Workers

Gardeners are community members who perform regenerative work and document it through Green Goods.

### Who Are Gardeners?

- **Conservation volunteers**: Tree planters, habitat restorers, wildlife monitors
- **Community organizers**: Leading cleanup events, educational workshops
- **Farmers & land stewards**: Documenting sustainable practices
- **Students & researchers**: Conducting biodiversity surveys
- **Anyone contributing**: To local environmental and community work

### What Do Gardeners Do in Green Goods?

1. **Log Work with MDR Workflow**
   - Take before/after photos
   - Fill in task details and metrics
   - Submit for operator review

2. **Track Contributions**
   - View submission history
   - Check approval status
   - Access on-chain attestations

3. **Build Reputation**
   - Accumulate verified work
   - Showcase impact portfolio
   - Unlock future opportunities

### Key Features for Gardeners

- ✅ **Passkey authentication**: No seed phrases, just Face ID/Touch ID
- 📱 **Mobile-first PWA**: Works on any smartphone
- 🌐 **Offline capability**: Document work in the field, sync later
- 🚫 **No gas fees**: Transactions are sponsored via Pimlico
- 🌍 **Multi-language**: English, Spanish, Portuguese

<!-- TODO: Add screenshot of gardener work submission flow -->
<!-- TODO: Add image - Gardener Workflow -->
<!-- ![Gardener Workflow](../.gitbook/assets/gardener-workflow.png) -->
*Submitting work takes less than 2 minutes*

**Get Started**: [Gardener Quickstart →](quickstart-gardener.md)

---

## 🧑‍🌾 Garden Operators: Community Coordinators

Operators are trusted community members who manage gardens, design tasks, and validate work submissions.

### Who Are Garden Operators?

- **Community leaders**: Managing local conservation initiatives
- **NGO coordinators**: Running regenerative programs
- **Land managers**: Overseeing restoration projects
- **Educators**: Facilitating community-based learning
- **Garden founders**: Building bioregional impact hubs

### What Do Operators Do in Green Goods?

1. **Manage Gardens**
   - Create and edit garden profiles
   - Add/remove gardeners and operators
   - Coordinate multiple gardens

2. **Design Actions**
   - Create tasks with clear instructions
   - Define metrics and requirements
   - Set time windows and priorities

3. **Review Work**
   - Validate submitted work
   - Approve or reject with feedback
   - Create on-chain attestations

4. **Generate Reports**
   - View garden-level impact data
   - Export for grant applications
   - Track cumulative metrics

### Key Features for Operators

- 🎛️ **Admin dashboard**: [admin.greengoods.app](https://admin.greengoods.app)
- ⛓️ **On-chain permissions**: Role-based access control
- 📊 **Real-time data**: GraphQL subscriptions
- 🤖 **Automated attestations**: Karma GAP integration
- 🔐 **Secure**: Wallet-based authentication

<!-- TODO: Add screenshot of operator dashboard -->
<!-- TODO: Add image - Operator Dashboard -->
<!-- ![Operator Dashboard](../.gitbook/assets/operator-dashboard.png) -->
*Operators can manage multiple gardens from a single interface*

**Get Started**: [Operator Quickstart →](quickstart-operator.md)

---

## 📊 Impact Evaluators: Researchers & Funders

Evaluators analyze verified impact data to make funding decisions, conduct research, or report on regenerative outcomes.

### Who Are Evaluators?

- **Grant makers**: Allocating funding based on proven impact
- **Researchers**: Studying regenerative practices and outcomes
- **Impact investors**: Evaluating retroactive funding opportunities
- **Government agencies**: Monitoring conservation compliance
- **NGO partners**: Tracking program effectiveness

### What Do Evaluators Do in Green Goods?

1. **Access Verified Data**
   - Query GraphQL API
   - View on-chain attestations
   - Browse gardens and work

2. **Analyze Impact**
   - Filter by location, action type, time period
   - Export data for external analysis
   - Track trends over time

3. **Integrate with Frameworks**
   - Map to existing impact standards
   - Pull data into dashboards
   - Generate custom reports

### Key Features for Evaluators

- 🔍 **GraphQL API**: [Envio Indexer](https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql)
- ⛓️ **On-chain verification**: Immutable attestations via EAS
- 📈 **Karma GAP integration**: Standardized impact reporting
- 🗂️ **Multiple chains**: Arbitrum, Celo, Base Sepolia
- 📊 **Flexible queries**: Filter by any dimension

### Example Evaluation Workflows

**Funding Decision**:
1. Query all work in a specific bioregion
2. Filter for actions matching grant criteria
3. Verify attestations on-chain
4. Export approved work for board review

**Research Study**:
1. Pull biodiversity assessment data
2. Correlate with environmental metrics
3. Analyze trends across multiple gardens
4. Publish findings with verifiable sources

<!-- TODO: Add screenshot of GraphQL playground query -->
<!-- TODO: Add image - GraphQL Query Example -->
<!-- ![GraphQL Query Example](../.gitbook/assets/graphql-example.png) -->
*Query impact data with flexible GraphQL API*

**Get Started**: [Evaluator Quickstart →](quickstart-evaluator.md)

---

## 👩‍💻 Developers: Protocol Builders

Developers build on, extend, or contribute to the Green Goods platform and protocol.

### Who Are Developers?

- **Web3 builders**: Integrating Green Goods into dApps
- **Impact tool creators**: Building complementary tools
- **Data scientists**: Creating analytics dashboards
- **Smart contract developers**: Extending protocol functionality
- **Open source contributors**: Improving the platform

### What Do Developers Do in Green Goods?

1. **Build Integrations**
   - Query GraphQL API
   - Interact with smart contracts
   - Create custom UIs

2. **Extend the Protocol**
   - Deploy new resolvers
   - Create custom actions
   - Add garden templates

3. **Contribute to Platform**
   - Submit PRs to monorepo
   - Fix bugs and improve UX
   - Write documentation

### Key Features for Developers

- 🧰 **Complete monorepo**: Client, admin, contracts, indexer
- 📚 **Comprehensive docs**: Architecture, APIs, deployment guides
- 🛠️ **Modern stack**: React, Viem, Foundry, Envio, Tailwind
- 🔓 **Open source**: MIT License
- 🤝 **Active community**: [GitHub](https://github.com/greenpill-dev-guild/green-goods) • [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)

### Tech Stack Overview

**Frontend**:
- React 18 + TypeScript + Vite
- TanStack Query + Zustand
- Tailwind CSS v4 + Radix UI
- Offline-first architecture

**Backend**:
- Envio GraphQL indexer
- IPFS via Storacha
- Pimlico account abstraction

**Blockchain**:
- Solidity smart contracts
- EAS attestations
- Tokenbound accounts (ERC-6551)
- Deployed on Arbitrum, Celo, Base Sepolia

<!-- TODO: Add architecture diagram -->
<!-- TODO: Add image - System Architecture -->
<!-- ![System Architecture](../.gitbook/assets/system-architecture.png) -->
*Green Goods architecture overview*

**Get Started**: [Developer Quickstart →](quickstart-developer.md)

---

## Multiple Roles

Many users wear multiple hats! You might be:
- An **operator** who also does **gardener** work
- An **evaluator** who wants to **contribute code**
- A **developer** building tools for **gardeners**

Green Goods is designed to support fluid role transitions. Your account can:
- Submit work as a gardener
- Approve work as an operator (if assigned)
- Query data as an evaluator
- Contribute code as a developer

---

## Which Role Are You?

<table>
  <tr>
    <td align="center" width="25%">
      <h3>🌱</h3>
      <strong>Gardener</strong><br/>
      <small>I do conservation work</small><br/><br/>
      <a href="quickstart-gardener.md">Get Started →</a>
    </td>
    <td align="center" width="25%">
      <h3>🧑‍🌾</h3>
      <strong>Operator</strong><br/>
      <small>I manage a community</small><br/><br/>
      <a href="quickstart-operator.md">Get Started →</a>
    </td>
    <td align="center" width="25%">
      <h3>📊</h3>
      <strong>Evaluator</strong><br/>
      <small>I analyze impact data</small><br/><br/>
      <a href="quickstart-evaluator.md">Get Started →</a>
    </td>
    <td align="center" width="25%">
      <h3>👩‍💻</h3>
      <strong>Developer</strong><br/>
      <small>I build regenerative tech</small><br/><br/>
      <a href="quickstart-developer.md">Get Started →</a>
    </td>
  </tr>
</table>

---

## Learn More

- [Why Green Goods?](why-green-goods.md) — Understand the problems we solve
- [What You Can Do](what-you-can-do.md) — Explore specific use cases
- [Core Concepts](../concepts/roles.md) — Deep dive into roles and permissions

