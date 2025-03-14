## Overview

Green Goods is an innovative Progressive Web App (PWA) designed to revolutionize biodiversity conservation. By providing tools for Garden Operators and Gardeners, the app streamlines the documentation and approval of conservation work. Key features include:

- **Work Submission:** Gardeners can capture and upload images of their conservation efforts.
- **Plant AI Detection (In Development):** Automatically verifies that uploaded images contain valid plant data using external APIs (with plans to explore local model deployment).
- **Blockchain Integration:** Securely records work attestations on-chain using Ethereum Attestation Service (EAS) and related blockchain components.
- **Impact Reporting:** Aggregates data for standardized impact metrics like invasive species removal, biomass generation, and carbon sequestration.

## Getting Started

### Prerequisites

- **Node.js & npm:** Ensure you have Node.js (version 20 or higher) and npm installed.
- **Git:** Version control is managed with Git.
- **Foundry:** For smart contract development and testing.
- **Docker (optional):** For local development and containerized deployments.

### Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/greenpill-dev-guild/green-goods.git
   cd green-goods
   ```
2. **Install Dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:** Create a .env file in each package as needed by copying the example .env file and set the necessary environment variables (e.g., API keys for plant detection, blockchain endpoints, etc.):

_Reachout to the Green Goods team on the [Greenpill Dev Guild Discord](https://discord.gg/XgU4emTW7M) to get environment variables._

4. **Build and Run the App:**
   ```bash
   pnpm run dev
   ```

The top `pnpm run dev` will run the Vite development server for the **Client** and for **Contracts** it will compile and build the smart contracts.

### Client

The Green Goods client is built using React and Vite. To run the development server, navigate to the client directory and run the following command:

1. **Run the Development Server:**
   ```bash
   pnpm run dev
   ```

The app should now be running at http://localhost:3001.

2. **Build for Production:**
   ```bash
   pnpm run build
   ```

The app will be built in the `dist` directory.

### Contracts

The Green Goods smart contracts are built using Foundry and deployed to a local blockchain (e.g., Anvil) or a public blockchain (e.g., Arbitrum).

1. **Compile Contracts:**

   ```bash
   pnpm run compile
   ```

2. **Build Contracts:**

   ```bash
   pnpm run build
   ```

3. **Deploy Contracts:** There are multiple deploy:\* scripts for different contracts and functionality. Each one simulate the transaction and in order to run onchain will need a `--broadcast` flag.

   ```bash
   pnpm run deploy:counter --broadcast
   ```

## Architecture

Green Goods is built using a modern, modular architecture to ensure scalability and maintainability. The main components include:

### Frontend

Built with React (using Vitejs) and styled with TailwindCSS.

Implements a mobile-first PWA design for seamless user experience on both mobile and desktop.

Integrates real-time image validation and plant detection UI flows.
API Integration Layer:

Handles calls to external plant detection services (e.g., Plant.id, PlantNet, Kindwise) for image analysis.
Processes API responses and integrates detection data into work metadata.

### Backend & Blockchain Integration

Manages user submissions, work approvals, and conservation impact reports.

Deploys a Garden NFT contract that deploys tokenbound smart account owned by the NFT holder.

Deploys an Action Registry smart contract that enables creating new actions for work submission, work approval, and impact reporting.

Integrates with Ethereum Attestation Service (EAS) for blockchain-based attestations.

Uses a Ethereum Attestation and Envio Graphql Indexer to read blockchain events asynchronously.

_Refer to Green Goods technical specs for [work](https://app.charmverse.io/greenpill-dev-guild/green-goods-work-spec-2986399741355552) and [plant detection](https://app.charmverse.io/greenpill-dev-guild/green-goods-ai-plant-detection-spec-2926920793393595) for more details._

## Contributing

We welcome contributions from the community! To contribute to Green Goods, please follow these steps:

1. **Fork the Repository:** Click the "Fork" button on the repository page to create your own copy.

2. **Create a Branch:** Create a new branch for your feature or bug fix:

```bash
git checkout -b feature/your-feature-name
```

3. **Make Your Changes:** Develop and test your changes locally. Make sure to update documentation and tests as needed.

4. **Submit a Pull Request:** Once your changes are ready, submit a pull request (PR) detailing what your contribution does and linking to any relevant issues.

5. **Review Process:** Our team will review your PR, provide feedback, and work with you to merge your contribution.
