import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { ethers } from 'ethers';

export interface Bounty {
  id: number;
  creator: string;
  title: string;
  description: string;
  requirements: string;
  rewardToken: string;
  rewardAmount: string;
  deadline: number;
  status: number; // 0: Active, 1: Completed, 2: Cancelled
  winner: string;
  submissionCount: number;
}

export interface Submission {
  id: number;
  developer: string;
  solutionUrl: string;
  description: string;
  timestamp: number;
  isWinner: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private bountyPlatformContract: ethers.Contract | null = null;
  private bountyTokenContract: ethers.Contract | null = null;

  // Observables for reactive state management
  private _isConnected = new BehaviorSubject<boolean>(false);
  private _currentAccount = new BehaviorSubject<string>('');
  private _networkChainId = new BehaviorSubject<number>(0);

  public isConnected$ = this._isConnected.asObservable();
  public currentAccount$ = this._currentAccount.asObservable();
  public networkChainId$ = this._networkChainId.asObservable();

  // Contract addresses (should be updated after deployment)
  private readonly CONTRACT_ADDRESSES = {
    BOUNTY_PLATFORM: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    BOUNTY_TOKEN: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  };

  // Contract ABIs (simplified for this example)
  private readonly BOUNTY_PLATFORM_ABI = [
    'function createBounty(string title, string description, string requirements, address rewardToken, uint256 rewardAmount, uint256 deadline)',
    'function submitSolution(uint256 bountyId, string solutionUrl, string description)',
    'function selectWinner(uint256 bountyId, uint256 submissionId)',
    'function cancelBounty(uint256 bountyId)',
    'function getBountyDetails(uint256 bountyId) view returns (uint256, address, string, string, string, address, uint256, uint256, uint8, address, uint256)',
    'function getSubmission(uint256 bountyId, uint256 submissionId) view returns (uint256, address, string, string, uint256, bool)',
    'function getUserBounties(address user) view returns (uint256[])',
    'function getUserSubmissions(address user) view returns (uint256[])',
    'function getTotalBounties() view returns (uint256)',
    'event BountyCreated(uint256 indexed bountyId, address indexed creator, string title, address rewardToken, uint256 rewardAmount, uint256 deadline)',
    'event SubmissionCreated(uint256 indexed bountyId, uint256 indexed submissionId, address indexed developer, string solutionUrl)',
    'event BountyCompleted(uint256 indexed bountyId, address indexed winner, uint256 rewardAmount)'
  ];

  private readonly BOUNTY_TOKEN_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)'
  ];

  constructor() {
    this.checkConnection();
  }

  // Connect to MetaMask wallet
  async connectWallet(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        this.provider = new ethers.BrowserProvider((window as any).ethereum);
        
        // Request account access
        await this.provider.send('eth_requestAccounts', []);
        
        this.signer = await this.provider.getSigner();
        const address = await this.signer.getAddress();
        const network = await this.provider.getNetwork();

        this._currentAccount.next(address);
        this._networkChainId.next(Number(network.chainId));
        this._isConnected.next(true);

        // Initialize contracts
        this.initializeContracts();

        // Listen for account changes
        (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length === 0) {
            this.disconnect();
          } else {
            this._currentAccount.next(accounts[0]);
          }
        });

        // Listen for network changes
        (window as any).ethereum.on('chainChanged', (chainId: string) => {
          this._networkChainId.next(parseInt(chainId, 16));
          window.location.reload(); // Reload on network change
        });

        return true;
      } else {
        console.error('MetaMask not found');
        return false;
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      return false;
    }
  }

  // Check if already connected
  private async checkConnection(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        this.provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await this.provider.listAccounts();
        
        if (accounts.length > 0) {
          this.signer = await this.provider.getSigner();
          const address = await this.signer.getAddress();
          const network = await this.provider.getNetwork();

          this._currentAccount.next(address);
          this._networkChainId.next(Number(network.chainId));
          this._isConnected.next(true);

          this.initializeContracts();
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  }

  // Disconnect wallet
  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.bountyPlatformContract = null;
    this.bountyTokenContract = null;
    this._currentAccount.next('');
    this._networkChainId.next(0);
    this._isConnected.next(false);
  }

  // Initialize smart contracts
  private initializeContracts(): void {
    if (this.signer) {
      this.bountyPlatformContract = new ethers.Contract(
        this.CONTRACT_ADDRESSES.BOUNTY_PLATFORM,
        this.BOUNTY_PLATFORM_ABI,
        this.signer
      );

      this.bountyTokenContract = new ethers.Contract(
        this.CONTRACT_ADDRESSES.BOUNTY_TOKEN,
        this.BOUNTY_TOKEN_ABI,
        this.signer
      );
    }
  }

  // Create a new bounty
  async createBounty(
    title: string,
    description: string,
    requirements: string,
    rewardAmount: string,
    deadline: number
  ): Promise<string | null> {
    try {
      if (!this.bountyPlatformContract || !this.bountyTokenContract) {
        throw new Error('Contracts not initialized');
      }

      const rewardAmountWei = ethers.parseEther(rewardAmount);
      
      // First approve the bounty platform to spend tokens
      const approveTx = await this.bountyTokenContract['approve'](
        this.CONTRACT_ADDRESSES.BOUNTY_PLATFORM,
        rewardAmountWei
      );
      await approveTx.wait();

      // Create the bounty
      const tx = await this.bountyPlatformContract['createBounty'](
        title,
        description,
        requirements,
        this.CONTRACT_ADDRESSES.BOUNTY_TOKEN,
        rewardAmountWei,
        deadline
      );

      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Error creating bounty:', error);
      return null;
    }
  }

  // Submit a solution to a bounty
  async submitSolution(
    bountyId: number,
    solutionUrl: string,
    description: string
  ): Promise<string | null> {
    try {
      if (!this.bountyPlatformContract) {
        throw new Error('Contract not initialized');
      }

      const tx = await this.bountyPlatformContract['submitSolution'](
        bountyId,
        solutionUrl,
        description
      );

      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Error submitting solution:', error);
      return null;
    }
  }

  // Select winner for a bounty
  async selectWinner(bountyId: number, submissionId: number): Promise<string | null> {
    try {
      if (!this.bountyPlatformContract) {
        throw new Error('Contract not initialized');
      }

      const tx = await this.bountyPlatformContract['selectWinner'](bountyId, submissionId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Error selecting winner:', error);
      return null;
    }
  }

  // Get bounty details
  async getBountyDetails(bountyId: number): Promise<Bounty | null> {
    try {
      if (!this.bountyPlatformContract) {
        throw new Error('Contract not initialized');
      }

      const result = await this.bountyPlatformContract['getBountyDetails'](bountyId);
      
      return {
        id: Number(result[0]),
        creator: result[1],
        title: result[2],
        description: result[3],
        requirements: result[4],
        rewardToken: result[5],
        rewardAmount: ethers.formatEther(result[6]),
        deadline: Number(result[7]),
        status: Number(result[8]),
        winner: result[9],
        submissionCount: Number(result[10])
      };
    } catch (error) {
      console.error('Error getting bounty details:', error);
      return null;
    }
  }

  // Get submission details
  async getSubmission(bountyId: number, submissionId: number): Promise<Submission | null> {
    try {
      if (!this.bountyPlatformContract) {
        throw new Error('Contract not initialized');
      }

      const result = await this.bountyPlatformContract['getSubmission'](bountyId, submissionId);
      
      return {
        id: Number(result[0]),
        developer: result[1],
        solutionUrl: result[2],
        description: result[3],
        timestamp: Number(result[4]),
        isWinner: result[5]
      };
    } catch (error) {
      console.error('Error getting submission:', error);
      return null;
    }
  }

  // Get all bounties count
  async getTotalBounties(): Promise<number> {
    try {
      if (!this.bountyPlatformContract) {
        throw new Error('Contract not initialized');
      }

      const total = await this.bountyPlatformContract['getTotalBounties']();
      return Number(total);
    } catch (error) {
      console.error('Error getting total bounties:', error);
      return 0;
    }
  }

  // Get user bounties
  async getUserBounties(address: string): Promise<number[]> {
    try {
      if (!this.bountyPlatformContract) {
        throw new Error('Contract not initialized');
      }

      const bountyIds = await this.bountyPlatformContract['getUserBounties'](address);
      return bountyIds.map((id: any) => Number(id));
    } catch (error) {
      console.error('Error getting user bounties:', error);
      return [];
    }
  }

  // Get token balance
  async getTokenBalance(address: string): Promise<string> {
    try {
      if (!this.bountyTokenContract) {
        throw new Error('Token contract not initialized');
      }

      const balance = await this.bountyTokenContract['balanceOf'](address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting token balance:', error);
      return '0';
    }
  }

  // Mint tokens (for testing purposes - only contract owner can call this)
  async mintTokens(to: string, amount: string): Promise<string | null> {
    try {
      if (!this.bountyTokenContract) {
        throw new Error('Token contract not initialized');
      }

      const amountWei = ethers.parseEther(amount);
      const tx = await this.bountyTokenContract['mint'](to, amountWei);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Error minting tokens:', error);
      return null;
    }
  }

  // Update contract addresses (call this after deployment)
  updateContractAddresses(bountyPlatform: string, bountyToken: string): void {
    (this.CONTRACT_ADDRESSES.BOUNTY_PLATFORM as any) = bountyPlatform;
    (this.CONTRACT_ADDRESSES.BOUNTY_TOKEN as any) = bountyToken;
    
    if (this.signer) {
      this.initializeContracts();
    }
  }
}
