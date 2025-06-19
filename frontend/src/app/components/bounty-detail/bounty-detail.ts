import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, takeUntil } from 'rxjs';
import { Web3Service, Bounty, Submission } from '../../services/web3';

@Component({
  selector: 'app-bounty-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatDividerModule
  ],
  templateUrl: './bounty-detail.html',
  styleUrls: ['./bounty-detail.scss']
})
export class BountyDetailComponent implements OnInit, OnDestroy {
  bounty: Bounty | null = null;
  submissions: Submission[] = [];
  submissionForm: FormGroup;
  
  bountyId: number = 0;
  loading = true;
  isConnected = false;
  currentAccount = '';
  isSubmitting = false;
  isSelectingWinner = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private web3Service: Web3Service,
    private snackBar: MatSnackBar
  ) {
    this.submissionForm = this.fb.group({
      solutionUrl: ['', [Validators.required, Validators.pattern('https?://.+')]],
      description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(500)]]
    });
  }

  ngOnInit(): void {
    // Get bounty ID from route
    this.route.params.subscribe(params => {
      this.bountyId = +params['id'];
      if (this.bountyId) {
        this.loadBountyDetails();
      }
    });

    // Subscribe to connection status
    this.web3Service.isConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
        if (connected && this.bountyId) {
          this.loadBountyDetails();
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

  async loadBountyDetails(): Promise<void> {
    if (!this.isConnected || !this.bountyId) {
      this.loading = false;
      return;
    }

    try {
      this.loading = true;
      
      // Load bounty details
      this.bounty = await this.web3Service.getBountyDetails(this.bountyId);
      
      if (this.bounty) {
        // Load submissions
        this.submissions = [];
        for (let i = 1; i <= this.bounty.submissionCount; i++) {
          const submission = await this.web3Service.getSubmission(this.bountyId, i);
          if (submission) {
            this.submissions.push(submission);
          }
        }
        
        // Sort submissions by timestamp (newest first)
        this.submissions.sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch (error) {
      console.error('Error loading bounty details:', error);
      this.snackBar.open('Failed to load bounty details', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  async onSubmitSolution(): Promise<void> {
    if (this.submissionForm.valid && this.bounty) {
      this.isSubmitting = true;

      try {
        const formValue = this.submissionForm.value;
        const txHash = await this.web3Service.submitSolution(
          this.bountyId,
          formValue.solutionUrl,
          formValue.description
        );

        if (txHash) {
          this.snackBar.open(
            'Solution submitted successfully! Transaction: ' + txHash.slice(0, 10) + '...',
            'Close',
            { duration: 5000 }
          );
          
          // Reset form and reload bounty details
          this.submissionForm.reset();
          await this.loadBountyDetails();
        } else {
          throw new Error('Transaction failed');
        }
      } catch (error: any) {
        console.error('Error submitting solution:', error);
        this.snackBar.open(
          'Failed to submit solution: ' + (error.message || 'Unknown error'),
          'Close',
          { duration: 5000 }
        );
      } finally {
        this.isSubmitting = false;
      }
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.submissionForm.controls).forEach(key => {
        this.submissionForm.get(key)?.markAsTouched();
      });
    }
  }

  async selectWinner(submissionId: number): Promise<void> {
    if (!this.bounty) return;

    this.isSelectingWinner = true;

    try {
      const txHash = await this.web3Service.selectWinner(this.bountyId, submissionId);

      if (txHash) {
        this.snackBar.open(
          'Winner selected successfully! Transaction: ' + txHash.slice(0, 10) + '...',
          'Close',
          { duration: 5000 }
        );
        
        // Reload bounty details
        await this.loadBountyDetails();
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Error selecting winner:', error);
      this.snackBar.open(
        'Failed to select winner: ' + (error.message || 'Unknown error'),
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.isSelectingWinner = false;
    }
  }

  // Helper methods
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

  canSubmitSolution(): boolean {
    return !!(this.bounty && 
             this.bounty.status === 0 && 
             !this.isExpired(this.bounty.deadline) &&
             this.currentAccount &&
             this.currentAccount.toLowerCase() !== this.bounty.creator.toLowerCase());
  }

  canSelectWinner(): boolean {
    return !!(this.bounty && 
             this.bounty.status === 0 &&
             this.currentAccount &&
             this.currentAccount.toLowerCase() === this.bounty.creator.toLowerCase() &&
             this.submissions.length > 0);
  }

  hasAlreadySubmitted(): boolean {
    return this.submissions.some(s => 
      s.developer.toLowerCase() === this.currentAccount.toLowerCase()
    );
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  getFieldError(fieldName: string): string {
    const field = this.submissionForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} is required`;
      }
      if (field.errors['pattern']) {
        return 'Please enter a valid URL starting with http:// or https://';
      }
      if (field.errors['minlength']) {
        return `${this.getFieldDisplayName(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['maxlength']) {
        return `${this.getFieldDisplayName(fieldName)} must be no more than ${field.errors['maxlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      solutionUrl: 'Solution URL',
      description: 'Description'
    };
    return displayNames[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.submissionForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getDescriptionCount(): number {
    return this.submissionForm.get('description')?.value?.length || 0;
  }

  trackBySubmissionId(index: number, submission: Submission): number {
    return submission.id;
  }
}
