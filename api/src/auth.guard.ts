import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const [type, token] = authorizationHeader.split(' ');

    if (type !== 'Bearer' || token !== 'task-tracker-dev-token') {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }
}