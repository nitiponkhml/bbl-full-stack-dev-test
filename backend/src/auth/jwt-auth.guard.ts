import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext): TUser {
    if (err || !user) {
      this.logger.warn('Auth failed');
      return super.handleRequest(err, user, info, context);
    }

    this.logger.log('Auth success');
    return super.handleRequest(err, user, info, context);
  }
}
