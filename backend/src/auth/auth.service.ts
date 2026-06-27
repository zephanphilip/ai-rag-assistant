import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './user.schema';
import { Role } from './roles.enum';
import { JwtPayload } from './jwt-auth.guard';

const SALT_ROUNDS = 10;

export interface AuthResult {
  access_token: string;
  user: { email: string; role: Role };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Seed a default admin on startup so the system is usable out of the box. */
  async onModuleInit(): Promise<void> {
    const email = (
      this.configService.get<string>('ADMIN_EMAIL') ?? 'admin@example.com'
    ).toLowerCase();
    const password =
      this.configService.get<string>('ADMIN_PASSWORD') ?? 'admin123';

    const existing = await this.userModel.findOne({ email });
    if (existing) {
      return;
    }

    await this.create(email, password, Role.Admin);
    this.logger.warn(
      `Seeded default admin "${email}". Change ADMIN_PASSWORD in production.`,
    );
  }

  async create(email: string, password: string, role: Role): Promise<User> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.userModel.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return this.userModel.create({
      email: normalizedEmail,
      password: hash,
      role,
    });
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    // password has `select: false`, so request it explicitly.
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: { email: user.email, role: user.role },
    };
  }
}
