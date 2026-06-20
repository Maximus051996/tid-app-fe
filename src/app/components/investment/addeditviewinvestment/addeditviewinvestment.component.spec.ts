import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddeditviewinvestmentComponent } from './addeditviewinvestment.component';

describe('AddeditviewinvestmentComponent', () => {
  let component: AddeditviewinvestmentComponent;
  let fixture: ComponentFixture<AddeditviewinvestmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddeditviewinvestmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddeditviewinvestmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
