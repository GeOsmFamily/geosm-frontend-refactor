import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { Role, User } from '../models/index';

describe('roleGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let urlTree: UrlTree;

  const mockUser = (role: Role): User => ({
    id: '1',
    email: 'a@a.com',
    firstName: 'A',
    lastName: 'B',
    avatar: null,
    role,
    isActive: true,
    emailVerified: true,
    createdAt: '',
    updatedAt: '',
  });

  beforeEach(() => {
    urlTree = {} as UrlTree;
    authServiceSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'getProfile'], {
      currentUser$: { value: null as User | null },
    });
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(urlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  function runGuard(allowedRoles: Role[]) {
    return TestBed.runInInjectionContext(() =>
      roleGuard(allowedRoles)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('redirects to /login when not authenticated', () => {
    authServiceSpy.isAuthenticated.and.returnValue(false);

    const result = runGuard([Role.SUPER_ADMIN]);

    expect(result).toBe(urlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('allows access using the cached user when role matches', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    (authServiceSpy.currentUser$ as unknown as { value: User | null }).value = mockUser(Role.SUPER_ADMIN);

    const result = runGuard([Role.SUPER_ADMIN, Role.ADMIN_INSTANCE]);

    expect(result).toBe(true);
  });

  it('redirects to /map using the cached user when role does not match', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    (authServiceSpy.currentUser$ as unknown as { value: User | null }).value = mockUser(Role.VIEWER);

    const result = runGuard([Role.SUPER_ADMIN]);

    expect(result).toBe(urlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/map']);
  });

  it('fetches the profile when currentUser$ is not yet populated and allows access on match', (done) => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.getProfile.and.returnValue(of(mockUser(Role.ADMIN_INSTANCE)));

    const result$ = runGuard([Role.SUPER_ADMIN, Role.ADMIN_INSTANCE]) as Observable<boolean | UrlTree>;

    result$.subscribe((result) => {
      expect(result).toBe(true);
      done();
    });
  });

  it('redirects to /login if fetching the profile fails', (done) => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.getProfile.and.returnValue(throwError(() => new Error('401')));

    const result$ = runGuard([Role.SUPER_ADMIN]) as Observable<boolean | UrlTree>;

    result$.subscribe((result) => {
      expect(result).toBe(urlTree);
      expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/login']);
      done();
    });
  });
});
