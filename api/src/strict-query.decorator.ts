import {
  createParamDecorator,
  ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';

export function createStrictQueryPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    validateCustomDecorators: true,
  });
}

const RawQuery = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest().query,
);

// Like @Query(), but unknown query parameters are rejected with 400.
// The global ValidationPipe skips custom decorators, so this local pipe is
// the only validation applied and global body validation is unchanged.
export const StrictQuery = () => RawQuery(createStrictQueryPipe());
