import { TestBed } from '@angular/core/testing';
import { UpdateBannerComponent } from './update-banner.component';
import { UpdateCheckerService } from './update-checker.service';

describe('UpdateBannerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateBannerComponent],
      providers: [UpdateCheckerService]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(UpdateBannerComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render update banner when update is available', async () => {
    const fixture = TestBed.createComponent(UpdateBannerComponent);
    fixture.componentRef.setInput('currentVersion', '1.0.0');
    const updateChecker = TestBed.inject(UpdateCheckerService);
    updateChecker.updateAvailable.set(true);
    updateChecker.latestVersion.set('1.1.0');

    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.update-banner')).toBeTruthy();
  });

  it('should not render banner when no update is available', async () => {
    const fixture = TestBed.createComponent(UpdateBannerComponent);
    fixture.componentRef.setInput('currentVersion', '1.0.0');
    const updateChecker = TestBed.inject(UpdateCheckerService);
    updateChecker.updateAvailable.set(false);

    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.update-banner')).toBeFalsy();
  });
});
