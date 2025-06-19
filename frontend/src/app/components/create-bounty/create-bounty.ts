import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Web3Service } from '../../services/web3';

@Component({
  selector: 'app-create-bounty',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './create-bounty.html',
  styleUrls: ['./create-bounty.scss']
})
export class CreateBountyComponent implements OnInit, OnDestroy {
  bountyForm: FormGroup;
  isConnected = false;
  currentAccount = '';
  tokenBalance = '0';
  isSubmitting = false;
  isMinting = false;
  minDate = new Date();
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private web3Service: Web3Service,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.minDate.setDate(this.minDate.getDate() + 1);
    
    this.bountyForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]],
      requirements: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      rewardAmount: ['', [Validators.required, Validators.min(0.01), Validators.max(10000)]],
      deadline: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.web3Service.isConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
        if (!connected) {
          this.router.navigate(['/']);
        }
      });

    this.web3Service.currentAccount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(account => {
        this.currentAccount = account;
        if (account) {
          this.loadTokenBalance();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadTokenBalance(): Promise<void> {
    if (this.currentAccount) {
      this.tokenBalance = await this.web3Service.getTokenBalance(this.currentAccount);
    }
  }

  async mintTestTokens(): Promise<void> {
    if (!this.currentAccount) return;
    
    this.isMinting = true;
    try {
      const txHash = await this.web3Service.mintTokens(this.currentAccount, '100');
      if (txHash) {
        this.snackBar.open(
          'Test tokens minted successfully! Transaction: ' + txHash.slice(0, 10) + '...',
          'Close',
          { duration: 5000 }
        );
        setTimeout(() => {
          this.loadTokenBalance();
        }, 2000);
      } else {
        throw new Error('Minting failed');
      }
    } catch (error: any) {
      console.error('Error minting tokens:', error);
      this.snackBar.open(
        'Failed to mint tokens: ' + (error.message || 'Unknown error'),
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.isMinting = false;
    }
  }

  async connectWallet(): Promise<void> {
    await this.web3Service.connectWallet();
  }

  getFieldError(fieldName: string): string {
    const field = this.bountyForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} is required`;
      }
      if (field.errors['minlength']) {
        return `${this.getFieldDisplayName(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['maxlength']) {
        return `${this.getFieldDisplayName(fieldName)} must be no more than ${field.errors['maxlength'].requiredLength} characters`;
      }
      if (field.errors['min']) {
        return `${this.getFieldDisplayName(fieldName)} must be at least ${field.errors['min'].min}`;
      }
      if (field.errors['max']) {
        return `${this.getFieldDisplayName(fieldName)} must be no more than ${field.errors['max'].max}`;
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      title: 'Title',
      description: 'Description',
      requirements: 'Requirements',
      rewardAmount: 'Reward Amount',
      deadline: 'Deadline'
    };
    return displayNames[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.bountyForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  hasInsufficientBalance(): boolean {
    const rewardAmount = this.bountyForm.get('rewardAmount')?.value;
    return rewardAmount && parseFloat(this.tokenBalance) < parseFloat(rewardAmount);
  }

  async onSubmit(): Promise<void> {
    if (this.bountyForm.valid && !this.hasInsufficientBalance()) {
      this.isSubmitting = true;

      try {
        const formValue = this.bountyForm.value;
        const deadlineTimestamp = Math.floor(new Date(formValue.deadline).getTime() / 1000);

        const txHash = await this.web3Service.createBounty(
          formValue.title,
          formValue.description,
          formValue.requirements,
          formValue.rewardAmount,
          deadlineTimestamp
        );

        if (txHash) {
          this.snackBar.open(
            'Bounty created successfully! Transaction: ' + txHash.slice(0, 10) + '...',
            'Close',
            { duration: 5000 }
          );
          this.router.navigate(['/']);
        } else {
          throw new Error('Transaction failed');
        }
      } catch (error: any) {
        console.error('Error creating bounty:', error);
        this.snackBar.open(
          'Failed to create bounty: ' + (error.message || 'Unknown error'),
          'Close',
          { duration: 5000 }
        );
      } finally {
        this.isSubmitting = false;
      }
    } else {
      Object.keys(this.bountyForm.controls).forEach(key => {
        this.bountyForm.get(key)?.markAsTouched();
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/']);
  }

  getTitleCount(): number {
    return this.bountyForm.get('title')?.value?.length || 0;
  }

  getDescriptionCount(): number {
    return this.bountyForm.get('description')?.value?.length || 0;
  }

  getRequirementsCount(): number {
    return this.bountyForm.get('requirements')?.value?.length || 0;
  }

  parseFloat(value: string): number {
    return parseFloat(value) || 0;
  }

  async debugConnection(): Promise<void> {
    console.log('Is connected:', this.isConnected);
    console.log('Current account:', this.currentAccount);
    
    const balance = await this.web3Service.getTokenBalance(this.currentAccount);
    console.log('Token balance:', balance);
    
    const totalBounties = await this.web3Service.getTotalBounties();
    console.log('Total bounties:', totalBounties);
  }
}
