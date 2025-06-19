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
  status: number; 
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

  private _isConnected = new BehaviorSubject<boolean>(false);
  private _currentAccount = new BehaviorSubject<string>('');
  private _networkChainId = new BehaviorSubject<number>(0);

  public isConnected$ = this._isConnected.asObservable();
  public currentAccount$ = this._currentAccount.asObservable();
  public networkChainId$ = this._networkChainId.asObservable();

  private readonly CONTRACT_ADDRESSES = {
    BOUNTY_PLATFORM: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    BOUNTY_TOKEN: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  };

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

  async connectWallet(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        this.provider = new ethers.BrowserProvider((window as any).ethereum);
        
        await this.provider.send('eth_requestAccounts', []);
        
        this.signer = await this.provider.getSigner();
        const address = await this.signer.getAddress();
        const network = await this.provider.getNetwork();

        this._currentAccount.next(address);
        this._networkChainId.next(Number(network.chainId));
        this._isConnected.next(true);

        this.initializeContracts();

        (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length === 0) {
            this.disconnect();
          } else {
            this._currentAccount.next(accounts[0]);
          }
        });

        (window as any).ethereum.on('chainChanged', (chainId: string) => {
          this._networkChainId.next(parseInt(chainId, 16));
          window.location.reload();
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

  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.bountyPlatformContract = null;
    this.bountyTokenContract = null;
    this._currentAccount.next('');
    this._networkChainId.next(0);
    this._isConnected.next(false);
  }

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
      
      const approveTx = await this.bountyTokenContract['approve'](
        this.CONTRACT_ADDRESSES.BOUNTY_PLATFORM,
        rewardAmountWei
      );
      await approveTx.wait();

      const createTx = await this.bountyPlatformContract['createBounty'](
        title,
        description,
        requirements,
        this.CONTRACT_ADDRESSES.BOUNTY_TOKEN,
        rewardAmountWei,
        deadline
      );

      const receipt = await createTx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Error creating bounty:', error);
      return null;
    }
  }

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

  async getTotalBounties(): Promise<number> {
    try {
      if (!this.bountyPlatformContract) {
        throw new Error('Contract not initialized');
      }

      const result = await this.bountyPlatformContract['getTotalBounties']();
      return Number(result);
    } catch (error) {
      console.error('Error getting total bounties:', error);
      return 0;
    }
  }

  async getUserBounties(address: string): Promise<number[]> {
    try {
      if (!this.bountyPlatformContract) {
        throw new Error('Contract not initialized');
      }

      const result = await this.bountyPlatformContract['getUserBounties'](address);
      return result.map((id: any) => Number(id));
    } catch (error) {
      console.error('Error getting user bounties:', error);
      return [];
    }
  }

  async getTokenBalance(address: string): Promise<string> {
    try {
      if (!this.bountyTokenContract) {
        throw new Error('Contract not initialized');
      }

      const balance = await this.bountyTokenContract['balanceOf'](address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting token balance:', error);
      return '0';
    }
  }

  async mintTokens(to: string, amount: string): Promise<string | null> {
    try {
      if (!this.bountyTokenContract) {
        throw new Error('Contract not initialized');
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

  updateContractAddresses(bountyPlatform: string, bountyToken: string): void {
    (this.CONTRACT_ADDRESSES as any).BOUNTY_PLATFORM = bountyPlatform;
    (this.CONTRACT_ADDRESSES as any).BOUNTY_TOKEN = bountyToken;
    
    if (this.signer) {
      this.initializeContracts();
    }
  }
}
