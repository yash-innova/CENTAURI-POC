import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';

function contextWithHeaders(
  headers: Record<string, string>,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard();

  it('allows the POC bearer token', () => {
    expect(
      guard.canActivate(
        contextWithHeaders({ authorization: 'Bearer task-tracker-dev-token' }),
      ),
    ).toBe(true);
  });

  it('rejects a request without an Authorization header', () => {
    expect(() => guard.canActivate(contextWithHeaders({}))).toThrow(
      new UnauthorizedException('Authorization header is required'),
    );
  });

  it.each([
    ['a wrong token', 'Bearer wrong-token'],
    ['a non-Bearer scheme', 'Basic task-tracker-dev-token'],
    ['a lowercase scheme', 'bearer task-tracker-dev-token'],
    ['a missing token', 'Bearer'],
  ])('rejects %s', (_description, authorization) => {
    expect(() =>
      guard.canActivate(contextWithHeaders({ authorization })),
    ).toThrow(new UnauthorizedException('Invalid token'));
  });
});
