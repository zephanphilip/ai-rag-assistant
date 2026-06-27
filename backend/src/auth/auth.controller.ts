import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Role } from './roles.enum';
import { CurrentUser } from './current-user.decorator';
import type { JwtPayload } from './jwt-auth.guard';

interface LoginDto {
  email: string;
  password: string;
}

interface RegisterDto {
  email: string;
  password: string;
  role?: Role;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  // Only admins may provision new accounts (and assign roles).
  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async register(@Body() body: RegisterDto) {
    const user = await this.authService.create(
      body.email,
      body.password,
      body.role ?? Role.Employee,
    );
    return { email: user.email, role: user.role };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return { email: user.email, role: user.role };
  }
}
