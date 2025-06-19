import { Routes } from '@angular/router';
import { BountyListComponent } from './components/bounty-list/bounty-list';
import { CreateBountyComponent } from './components/create-bounty/create-bounty';
import { BountyDetailComponent } from './components/bounty-detail/bounty-detail';

export const routes: Routes = [
  { 
    path: '', 
    component: BountyListComponent,
    title: 'Bounty Platform - Discover and Complete Bounties'
  },
  { 
    path: 'create-bounty', 
    component: CreateBountyComponent,
    title: 'Create New Bounty - Bounty Platform'
  },
  { 
    path: 'bounty/:id', 
    component: BountyDetailComponent,
    title: 'Bounty Details - Bounty Platform'
  },
  { 
    path: '**', 
    redirectTo: '',
    pathMatch: 'full'
  }
];
