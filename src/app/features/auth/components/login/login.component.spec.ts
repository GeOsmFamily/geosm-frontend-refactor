import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../../core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'login',
      'getOsmStatus',
      'getOsmLoginUrl',
    ]);
    authServiceSpy.getOsmStatus.and.returnValue(of({ configured: false }));

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        NoopAnimationsModule,
        RouterTestingModule,
        TranslateModule.forRoot(),
      ],
      providers: [{ provide: AuthService, useValue: authServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show error when email and password are empty', () => {
    component.email = '';
    component.password = '';
    component.login();
    expect(component.errorMessage()).toBeTruthy();
  });

  it('should call authService.login with credentials', () => {
    authServiceSpy.login.and.returnValue(of({ accessToken: 'a', refreshToken: 'b' }));
    component.email = 'user@test.com';
    component.password = 'pass123';
    component.login();
    // rememberMe est coché par défaut (voir login.component.ts) - session persistante tant
    // que l'utilisateur ne décoche pas explicitement la case.
    expect(authServiceSpy.login).toHaveBeenCalledWith('user@test.com', 'pass123', true);
  });

  it('should set loading during login', () => {
    authServiceSpy.login.and.returnValue(of({ accessToken: 'a', refreshToken: 'b' }));
    component.email = 'user@test.com';
    component.password = 'pass';
    expect(component.loading()).toBeFalse();
    component.login();
    expect(component.loading()).toBeFalse(); // completed synchronously
  });

  it('should show the real backend error message on login failure (matches the actual API error envelope {success, error: {code, message}})', () => {
    authServiceSpy.login.and.returnValue(
      throwError(() => ({
        error: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
      })),
    );
    component.email = 'user@test.com';
    component.password = 'wrong';
    component.login();
    expect(component.errorMessage()).toContain('Invalid credentials');
  });

  it('should fall back to a generic message when the error body has no nested message', () => {
    authServiceSpy.login.and.returnValue(throwError(() => ({ error: {} })));
    component.email = 'user@test.com';
    component.password = 'wrong';
    component.login();
    expect(component.errorMessage()).toBeTruthy();
  });

  it('should toggle password visibility', () => {
    expect(component.hidePassword).toBeTrue();
    component.hidePassword = !component.hidePassword;
    expect(component.hidePassword).toBeFalse();
  });

  it('should render the login form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.login-form')).toBeTruthy();
    expect(compiled.querySelector('.form-header h2')?.textContent).toContain('Connexion');
  });

  it('should render the brand area', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('GeOSM');
  });
});
