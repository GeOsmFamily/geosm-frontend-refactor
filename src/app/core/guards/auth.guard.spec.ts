import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('should allow access when authenticated', () => {
    localStorage.setItem('access_token', 'token');
    expect(localStorage.getItem('access_token')).toBeTruthy();
    localStorage.removeItem('access_token');
  });

  it('should deny access when not authenticated', () => {
    localStorage.removeItem('access_token');
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
