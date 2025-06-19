import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BountyList } from './bounty-list';

describe('BountyList', () => {
  let component: BountyList;
  let fixture: ComponentFixture<BountyList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BountyList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BountyList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
