import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BountyDetail } from './bounty-detail';

describe('BountyDetail', () => {
  let component: BountyDetail;
  let fixture: ComponentFixture<BountyDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BountyDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BountyDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
