import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvestmentlistComponent } from './investmentlist.component';

describe('InvestmentlistComponent', () => {
  let component: InvestmentlistComponent;
  let fixture: ComponentFixture<InvestmentlistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvestmentlistComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InvestmentlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
