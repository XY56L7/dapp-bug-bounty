import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateBounty } from './create-bounty';

describe('CreateBounty', () => {
  let component: CreateBounty;
  let fixture: ComponentFixture<CreateBounty>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateBounty]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateBounty);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
