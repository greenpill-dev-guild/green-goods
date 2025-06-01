# Green Goods

Green Goods is a decentralized platform for biodiversity conservation, enabling Garden Operators and Gardeners to document and get approval for conservation work through blockchain-based attestations.

## 🏗️ Repository Architecture

The project is organized as a monorepo using pnpm workspaces:

```
green-goods/
├── packages/
│   ├── client/           # Frontend React application
│   ├── contracts/        # Smart contracts and deployment scripts
│   └── server/           # Backend services and APIs
├── apps/                 # Additional applications
└── docs/                 # Documentation
```

### Key Components

#### Client (`packages/client`)

- React-based Progressive Web App (PWA)
- Built with Vite, TypeScript, and Tailwind CSS
- Handles user authentication, garden management, and blockchain interactions

#### Contracts (`packages/contracts`)

- Solidity smart contracts for garden management
- Foundry-based deployment scripts
- Integration with Privy for wallet management

#### Server (`packages/server`)

- Backend services and APIs
- Handles data persistence and business logic
- Integrates with blockchain networks

## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or higher)
- pnpm (v9.x)
- Foundry (for smart contract development)
- Git

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/green-goods.git
   cd green-goods
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   # Copy example env files
   cp packages/client/.env.example packages/client/.env
   cp packages/contracts/.env.example packages/contracts/.env
   cp packages/server/.env.example packages/server/.env
   ```

4. Configure environment variables:
   - `PRIVY_CLIENT_ID`: Your Privy application ID
   - `PRIVY_APP_SECRET_ID`: Privy app secret
   - `PRIVY_AUTHORIZATION_PRIVATE_KEY`: Privy authorization key
   - `PINATA_JWT`: Pinata API JWT token
   - `PRIVATE_KEY`: Ethereum private key for deployments

## 💻 Development

### Running the Development Environment

1. Start the client:

   ```bash
   pnpm --filter client dev
   ```

2. Start the server:

   ```bash
   pnpm --filter server dev
   ```

3. Deploy contracts (if needed):
   ```bash
   pnpm --filter contracts deploy
   ```

### Testing

Run tests across all packages:

```bash
pnpm test
```

Run tests for a specific package:

```bash
pnpm --filter <package-name> test
```

### Linting and Type Checking

```bash
# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck
```

## 🛠️ Core Technologies

### Frontend

- **React**: UI library
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **TanStack Query**: Data fetching and caching
- **Privy**: Authentication and wallet management
- **Radix UI**: Accessible UI components
- **React Hook Form**: Form management

### Smart Contracts

- **Solidity**: Smart contract language
- **Foundry**: Development framework
- **Hardhat**: Alternative development environment

### Backend

- **Node.js**: Runtime
- **Express**: Web framework
- **TypeScript**: Type safety
- **Prisma**: Database ORM

## 📦 Package Management

### Adding Dependencies

```bash
# Add to specific package
pnpm --filter <package-name> add <dependency>

# Add dev dependency
pnpm --filter <package-name> add -D <dependency>
```

### Workspace Scripts

```bash
# Run script in specific package
pnpm --filter <package-name> <script-name>

# Run script in all packages
pnpm -r <script-name>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Run tests and linting:
   ```bash
   pnpm test
   pnpm lint
   ```
5. Commit your changes:
   ```bash
   git commit -m "feat: your feature description"
   ```
6. Push to your fork
7. Create a pull request

### Commit Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

### Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update the changelog
5. Get code review approval
6. Merge after approval

## 📚 Documentation

- [Architecture Overview](./docs/architecture.md)
- [API Documentation](./docs/api.md)
- [Smart Contract Documentation](./docs/contracts.md)
- [Contributing Guidelines](./docs/contributing.md)

## 🔐 Security

- Report security vulnerabilities to security@greengoods.app
- Do not disclose security-related issues publicly

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Privy](https://www.privy.io/) for authentication and wallet management
- [Pinata](https://pinata.cloud/) for IPFS services
- [Foundry](https://getfoundry.sh/) for smart contract development
- All contributors and supporters of the project
