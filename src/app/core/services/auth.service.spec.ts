import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

describe('AuthService', () => {
  let service: AuthService;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockTokens = { accessToken: 'access-123', refreshToken: 'refresh-456' };
  const mockUser = {
    id: '1',
    email: 'test@test.com',
    firstName: 'John',
    lastName: 'Doe',
    avatar: null,
    role: 'VIEWER' as any,
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: ApiService, useValue: apiSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should store tokens on successful login', (done) => {
      apiSpy.post.and.returnValue(of(mockTokens));

      service.login('test@test.com', 'password').subscribe(() => {
        expect(localStorage.getItem('access_token')).toBe('access-123');
        expect(localStorage.getItem('refresh_token')).toBe('refresh-456');
        done();
      });
    });

    it('should call API with correct endpoint', () => {
      apiSpy.post.and.returnValue(of(mockTokens));
      service.login('test@test.com', 'pass');
      expect(apiSpy.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@test.com',
        password: 'pass',
      });
    });
  });

  describe('register', () => {
    it('should store tokens on successful registration', (done) => {
      apiSpy.post.and.returnValue(of(mockTokens));
      const dto = { email: 'new@test.com', password: 'pass', firstName: 'Jane', lastName: 'Doe' };

      service.register(dto).subscribe(() => {
        expect(localStorage.getItem('access_token')).toBe('access-123');
        done();
      });
    });
  });

  describe('logout', () => {
    it('should clear tokens and navigate to login', () => {
      localStorage.setItem('access_token', 'token');
      localStorage.setItem('refresh_token', 'refresh');

      service.logout();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(service.currentUser$.value).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token', () => {
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should return true when token exists', () => {
      localStorage.setItem('access_token', 'some-token');
      expect(service.isAuthenticated()).toBeTrue();
    });
  });

  describe('getProfile', () => {
    it('should update currentUser$ on success', (done) => {
      apiSpy.get.and.returnValue(of(mockUser));

      service.getProfile().subscribe((user) => {
        expect(user.email).toBe('test@test.com');
        expect(service.currentUser$.value).toEqual(mockUser);
        done();
      });
    });
  });

  describe('getToken', () => {
    it('should return null when no token', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should return token when present', () => {
      localStorage.setItem('access_token', 'my-token');
      expect(service.getToken()).toBe('my-token');
    });
  });
});
