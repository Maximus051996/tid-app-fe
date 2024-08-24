import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddedittaskComponent } from './addedittask.component';

describe('AddedittaskComponent', () => {
  let component: AddedittaskComponent;
  let fixture: ComponentFixture<AddedittaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddedittaskComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddedittaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
