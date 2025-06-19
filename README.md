# 🎯 Decentralized Bounty Platform

A modern Web3 freelancing platform built on Ethereum, enabling trustless collaboration between clients and developers.

## 🌟 Features

### 🔥 Core Functionality
- **Create Bounties**: Post tasks with token rewards and deadlines
- **Submit Solutions**: Developers can submit their work with descriptions and URLs
- **Automatic Payments**: Smart contract handles escrow and payments
- **Reputation System**: Track successful completions and submissions

### 🛡️ Security & Trust
- **Escrow System**: Funds locked in smart contract until completion
- **Reentrancy Protection**: Secure against common attack vectors
- **Access Controls**: Role-based permissions and ownership management
- **Transparent**: All transactions visible on blockchain

### 💎 Technical Highlights
- **ERC20 Token Economy**: Custom BOUNTY token for platform rewards
- **Gas Optimized**: Efficient smart contract design
- **Modern Frontend**: Angular + Material Design
- **Web3 Integration**: MetaMask wallet connection
- **Responsive Design**: Works on all devices

## 🏗️ Architecture

### Smart Contracts (Solidity)
```
contracts/
├── BountyPlatform.sol    # Main platform logic
├── BountyToken.sol       # ERC20 reward token
└── tests/               # Comprehensive test suite
```

### Frontend (Angular)
```
frontend/src/app/
├── components/          # UI components
├── services/           # Web3 service layer
└── models/            # TypeScript interfaces
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MetaMask browser extension
- Git

### Installation
```bash
# Clone repository
git clone <repository-url>
cd dapp2

# Install dependencies
cd contracts && npm install
cd ../frontend && npm install
```

### Development Setup
```bash
# Terminal 1: Start local blockchain
cd contracts
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy.js --network localhost

# Terminal 3: Start frontend
cd frontend
ng serve
```

### MetaMask Configuration
- **Network**: Add custom network
- **RPC URL**: http://127.0.0.1:8545
- **Chain ID**: 1337
- **Currency**: ETH

## 📊 Platform Economics

### Token Distribution
- **Initial Supply**: 1,000,000 BOUNTY tokens
- **Platform Fee**: 2.5% per completed bounty
- **Minting**: Owner can mint additional tokens

### Fee Structure
- **Bounty Creation**: Free (only gas fees)
- **Solution Submission**: Free (only gas fees)
- **Completion Fee**: 2.5% of bounty reward

## 🔧 Technical Stack

### Blockchain
- **Solidity**: Smart contract development
- **Hardhat**: Development framework
- **OpenZeppelin**: Security-audited contracts
- **Ethers.js**: Web3 interaction library

### Frontend
- **Angular 18**: Modern frontend framework
- **Angular Material**: UI component library
- **TypeScript**: Type-safe development
- **RxJS**: Reactive programming

### Testing
- **Hardhat Tests**: Smart contract testing
- **Jasmine/Karma**: Frontend unit tests

## 🛣️ Roadmap

### Phase 1 (Current)
- ✅ Core bounty platform
- ✅ Token economy
- ✅ Basic UI/UX

### Phase 2 (Next)
- [ ] IPFS file storage
- [ ] Reputation NFTs
- [ ] Multi-token support

### Phase 3 (Future)
- [ ] DAO governance
- [ ] Cross-chain deployment
- [ ] Mobile application

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request
