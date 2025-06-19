import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Web3Service, Bounty } from '../../services/web3';

@Component({
  selector: 'app-bounty-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './bounty-list.html',
  styleUrls: ['./bounty-list.scss']
})
export class BountyListComponent implements OnInit, OnDestroy {
  bounties: Bounty[] = [];
  loading = true;
  isConnected = false;
  currentAccount = '';
  private destroy$ = new Subject<void>();

  constructor(
    private web3Service: Web3Service,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to connection status
    this.web3Service.isConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
        if (connected) {
          this.loadBounties();
        }
      });

    // Subscribe to current account
    this.web3Service.currentAccount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(account => {
        this.currentAccount = account;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async connectWallet(): Promise<void> {
    await this.web3Service.connectWallet();
  }

  async loadBounties(): Promise<void> {
    try {
      this.loading = true;
      const totalBounties = await this.web3Service.getTotalBounties();
      this.bounties = [];

      // Load all bounties
      for (let i = 1; i <= totalBounties; i++) {
        const bounty = await this.web3Service.getBountyDetails(i);
        if (bounty) {
          this.bounties.push(bounty);
        }
      }

      // Sort bounties by creation date (newest first)
      this.bounties.sort((a, b) => b.id - a.id);
    } catch (error) {
      console.error('Error loading bounties:', error);
    } finally {
      this.loading = false;
    }
  }

  getStatusText(status: number): string {
    switch (status) {
      case 0: return 'Active';
      case 1: return 'Completed';
      case 2: return 'Cancelled';
      default: return 'Unknown';
    }
  }

  getStatusColor(status: number): string {
    switch (status) {
      case 0: return 'primary';
      case 1: return 'accent';
      case 2: return 'warn';
      default: return '';
    }
  }

  isExpired(deadline: number): boolean {
    return Date.now() > deadline * 1000;
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  viewBounty(bountyId: number): void {
    this.router.navigate(['/bounty', bountyId]);
  }

  createBounty(): void {
    this.router.navigate(['/create-bounty']);
  }

  isActiveBounty(bounty: Bounty): boolean {
    return bounty.status === 0 && !this.isExpired(bounty.deadline);
  }

  getActiveBounties(): Bounty[] {
    return this.bounties.filter(bounty => this.isActiveBounty(bounty));
  }

  getCompletedBounties(): Bounty[] {
    return this.bounties.filter(bounty => bounty.status === 1);
  }

  getExpiredBounties(): Bounty[] {
    return this.bounties.filter(bounty => 
      bounty.status === 0 && this.isExpired(bounty.deadline)
    );
  }

  trackByBountyId(index: number, bounty: Bounty): number {
    return bounty.id;
  }
}
