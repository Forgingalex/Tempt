# Tempt

**The peer-to-peer marketplace for AI agents powered by hidden prompts.**

Tempt lets creators build and sell AI agents without exposing their prompts. Buyers purchase working AI behaviors with escrowed payments on Tempo blockchain — prompts stay encrypted end-to-end.

## Overview

Tempt is a marketplace where prompt engineers monetize their expertise by wrapping prompts into sellable AI agents. Buyers get working AI tools without prompt trial-and-error. Every transaction is secured through on-chain escrow with a 7-day acceptance window, structured outcome-based reviews, and reputation scoring — no star ratings, no guesswork.

Sellers never have their prompts exposed. Buyers always have recourse. The platform enforces quality systemically.

## Features

- **Prompt Privacy**: Seller prompts encrypted with AES-256-GCM, decrypted only server-side during execution
- **On-Chain Escrow**: Funds held in TIP-20 tokens until buyer accepts or 7-day auto-release
- **Structured Reviews**: Outcome-based reviews ("Did it do what it claimed?"), not star ratings
- **Reputation System**: Acceptance rates, dispute rates, repeat buyer %, version recency
- **Multi-Provider AI**: Agents can run on OpenAI or Anthropic models
- **Mandatory Disclosure**: Every agent must declare what it does NOT do — equally prominent as what it does
- **Pre-Listing Review**: Automated checks + manual review before agents go live
- **Wallet Auth**: Sign-In with Ethereum (SIWE) adapted for Tempo chain

## Architecture

```
Buyer → Frontend → API Route → Decrypt Prompt → LLM (OpenAI/Anthropic) → Output
                       ↕
                   PostgreSQL (encrypted prompts, metadata, reviews)
                       ↕
              Tempo Blockchain (escrow, agent registry, payments)
```

### Components

- **Frontend**: Next.js 14 App Router + wagmi v2 + viem (marketplace UI, studio, usage interface)
- **API Layer**: Next.js API routes as BFF (auth, agent CRUD, execution proxy)
- **Backend Services**: Express.js (agent execution, blockchain events, job queues)
- **Smart Contracts**: Solidity on Tempo (AgentRegistry, MarketplaceEscrow)
- **Database**: PostgreSQL via Prisma (users, agents, purchases, reviews, disputes)

## Project Structure

```
tempt/
├── apps/
│   ├── web/              # Next.js frontend + API routes
│   │   ├── app/          # App Router (marketplace, dashboard, studio, API)
│   │   ├── components/   # UI, marketplace, studio, layout components
│   │   ├── hooks/        # Auth, queries, token balance, studio hooks
│   │   ├── lib/          # Tempo config, auth, DB, encryption, utils
│   │   └── stores/       # Zustand state (agent filters, wallet)
│   └── server/           # Backend services
│       ├── services/     # Agent executor, encryption, blockchain
│       ├── prisma/       # Schema, migrations
│       └── queue/        # BullMQ job processors
├── contracts/            # Solidity smart contracts (Foundry)
│   ├── src/              # AgentRegistry, MarketplaceEscrow
│   ├── test/             # Foundry tests
│   └── script/           # Deployment scripts
├── packages/
│   └── types/            # Shared TypeScript types
└── turbo.json            # Turborepo config
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- PostgreSQL
- Redis
- Foundry (for smart contracts)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Forgingalex/tempt.git
   cd tempt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values:
   ```env
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://localhost:6379
   PROMPT_ENCRYPTION_KEY=your-secret-key
   NEXTAUTH_SECRET=your-nextauth-secret
   OPENAI_API_KEY=sk-...
   ```

4. **Set up database**
   ```bash
   cd apps/server && npx prisma generate && npx prisma db push
   ```

### Running

1. **Start the frontend** (Terminal 1)
   ```bash
   npm run dev --workspace=apps/web
   ```
   Open http://localhost:3000

2. **Start the backend** (Terminal 2)
   ```bash
   npm run dev --workspace=apps/server
   ```

### Smart Contracts

```bash
cd contracts

# Build
forge build

# Test
forge test

# Deploy to Tempo Testnet
forge script script/Deploy.s.sol --rpc-url https://rpc.moderato.tempo.xyz --broadcast
```

## Tempo Chain Details

| Property | Value |
|----------|-------|
| **Network** | Tempo Testnet (Moderato) |
| **Chain ID** | `42431` |
| **RPC URL** | `https://rpc.moderato.tempo.xyz` |
| **Explorer** | `https://explore.tempo.xyz` |
| **Token Standard** | TIP-20 (6 decimals, not 18) |
| **Gas** | No native gas token — fees paid in TIP-20 stablecoins |

Testnet stablecoins (pathUSD, AlphaUSD, BetaUSD, ThetaUSD) available via faucet or `tempo_fundAddress` RPC method.

## Trust Model

The platform enforces trust through four layers:

1. **Pre-Listing Review** — Agents must pass automated checks and manual review before going live
2. **Mandatory Demos & Disclosure** — Minimum 2 input/output demos, mandatory "what it does NOT do" section
3. **Escrow + Acceptance** — Buyer funds held on-chain until explicit acceptance or 7-day auto-release
4. **Outcome-Based Reviews** — "Did it do what it claimed?" / "Would you use it again?" — aggregated as percentages

Agents with >20% dispute rate get flagged. >40% gets auto-delisted.

## Security

- **Prompt encryption**: AES-256-GCM at rest, decrypted only during server-side execution
- **Zero client exposure**: Prompts never touch the frontend, API responses, or browser dev tools
- **Server-side LLM calls**: No client-side API keys for AI providers
- **Input hashing**: Execution logs store SHA-256 hashes, raw data expires after dispute window
- **Wallet auth**: SIWE with nonce validation and chain ID verification

## Development Status

### Completed
- Monorepo scaffolding (Turborepo, workspaces)
- Tempo chain configuration + wallet connection (wagmi v2)
- Authentication (SIWE via NextAuth.js v5)
- Database schema (Prisma — full model for users, agents, purchases, reviews, disputes)
- Encryption service (AES-256-GCM encrypt/decrypt/hash)
- Agent execution service (OpenAI + Anthropic providers)
- Marketplace pages (Home, Explore, Agent Detail)
- Seller Studio (dashboard, multi-step agent creation form)
- Agent CRUD API routes (create, read, update, delist)
- Seller dashboard API (agents + aggregated stats)
- Smart contract stubs (AgentRegistry, MarketplaceEscrow)

### In Progress
- Purchase flow (on-chain escrow + DB sync)
- Agent execution via API (post-purchase usage interface)
- Escrow acceptance/dispute flow
- Structured review submission + aggregation
- Pre-listing automated checks
- Smart contract deployment to Tempo Testnet

### Planned
- Reputation scoring algorithm
- Admin moderation tools
- User profiles + seller analytics
- Blockchain event listener service
- UI polish, animations, mobile optimization

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| **Wallet** | wagmi v2, viem, SIWE |
| **State** | Zustand (client), TanStack Query (server) |
| **Backend** | Node.js 20+, Express, Prisma, PostgreSQL, Redis, BullMQ |
| **Blockchain** | Tempo Testnet, Solidity, Foundry |
| **Auth** | NextAuth.js v5 (wallet-based SIWE) |

## Documentation

See for the complete project specification including smart contract specs, API routes, database schema, and UI requirements.

## License

All rights reserved.
