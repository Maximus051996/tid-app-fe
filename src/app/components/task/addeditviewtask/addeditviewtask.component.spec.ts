import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddeditviewtaskComponent } from './addeditviewtask.component';

describe('AddeditviewtaskComponent', () => {
  let component: AddeditviewtaskComponent;
  let fixture: ComponentFixture<AddeditviewtaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddeditviewtaskComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddeditviewtaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
