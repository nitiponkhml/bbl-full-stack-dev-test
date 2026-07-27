import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  @Get()
  getMe(@Req() req: Request) {
    return { sub: (req.user as { sub: string }).sub };
  }
}
