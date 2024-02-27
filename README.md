## Overview

Web3 starter kit gives developers the simplest and quickesrt way to start a Web3 project with a web client, API, and contracts. With a minimalist and web3 focused structure the kit offers a flexible template anyone can easily modify to fit their use case. The kit has different branches that provide more complex functionality out the gate such as Mud for autonomous worlds and Tokenbound accounts.

## Getting Started 

The repo is a monorepo using **pnpm** with all code held under packages directory.
Packages consists of API, Clients, and Contracts and can be ran simultonolesouly E2E in a local environment.

In order to run this project you need these dependencies:

- [Node](https://nodejs.org/en/download/current) version 18+ for running scripts and PNPM.
- [PNPM](https://pnpm.io/installation) version 6+ for package management.
- [Docker](https://docs.docker.com/get-docker) for database services Postgres and Redis.
- [Foundry](https://book.getfoundry.sh/getting-started/installation) for compiling/deploying smart contracts and running local blockchain node.

### Tests

Test can be ran at both the package level and root with `pnpm run test`.

Testing Structure:

- Clients use vitest and testing library for writing and running tests
- API uses Supertest in conjunction with Jest for writing and executing tests
- Contracts tests are written in Solidity and ran via MUD which uses Foundry's Forge for running tests.

## Architecture

The repo is architected with packages holding different code for dirrefent aspect of an application from clients to contracts. API and contract packages are singletons while clients may hold multiple for different interfaces (web, mobile) 

Languages used:

- [Typescript](https://www.typescriptlang.org/download) - Used for both client and API code with a types folder holding global type declerations and types created directly in routes, hooks, components, and views.
- [Solidity](https://docs.soliditylang.org/en/latest/installing-solidity.html#npm-node-js) - Language for writing Ethereum based contracts, compiling, and deploying. 

Core libraries:

- [React](https://react.dev) - Library for rendering UI and controlling basic state 
- [Vite](https://vitejs.dev) - Build library for client UIs
- [Express](https://expressjs.com) - Server based library handling server setup, routing, middleware
- [Prisma](https://www.prisma.io) - Database client and schema manager controlling SQL based DB
- [Mud](https://mud.dev) - On chain autonomous world based on ECS model with an indexer for querying chain state.

## Contributing

Project is open sourced and open for contributors who want to help add new feqtures to the kit.

If you would like to contribute here are the following steps:

- Fork the repo and get your local environment up and running, if any issues post in the [issues](https://github.com/Oba-One/web3-starter-kit/issues) tab.
- Pick up an open needs help issue from the [issues](https://github.com/Oba-One/web3-starter-kit/issues) that's not in progress and create a branch with the issue name.
- Once done open a [PR]([https://github.com/wefa-labs/wefa/pulls](https://github.com/Oba-One/web3-starter-kit/pulls)) to merge into the development branch of the starter kit repo
- Once approved make sure your branch is up to date with main and complete the merge.
