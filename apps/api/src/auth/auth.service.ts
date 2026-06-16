import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { generateToken, hashToken } from "../common/crypto/tokens";
import { JobsService } from "../jobs/jobs.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly jobs: JobsService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.usersService.findByEmail(email);

    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name?.trim() || null,
        passwordHash
      }
    });

    const verificationToken = await this.createEmailVerificationToken(user.id);
    await this.jobs.enqueueEmail({
      to: user.email,
      template: "verify-email",
      data: { token: verificationToken }
    });

    return this.issueAuthResponse(user.id, user.email, user.name, user.emailVerifiedAt);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueAuthResponse(user.id, user.email, user.name, user.emailVerifiedAt);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const nextRefreshToken = this.generateToken();
    const nextRefreshTokenHash = this.hashToken(nextRefreshToken);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revokedAt: new Date(),
          replacedBy: nextRefreshTokenHash
        }
      }),
      this.prisma.refreshToken.create({
        data: {
          tokenHash: nextRefreshTokenHash,
          userId: storedToken.userId,
          expiresAt: this.refreshTokenExpiry()
        }
      })
    ]);

    return {
      accessToken: await this.signAccessToken(storedToken.user.id, storedToken.user.email),
      refreshToken: nextRefreshToken,
      user: this.serializeUser(storedToken.user)
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { success: true };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.serializeUser(user);
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    const storedToken = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!storedToken || storedToken.usedAt || storedToken.expiresAt < new Date()) {
      throw new BadRequestException("Invalid verification token");
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() }
      }),
      this.prisma.user.update({
        where: { id: storedToken.userId },
        data: { emailVerifiedAt: new Date() }
      })
    ]);

    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (user) {
      const token = await this.createPasswordResetToken(user.id);
      await this.jobs.enqueueEmail({
        to: user.email,
        template: "reset-password",
        data: { token }
      });
    }

    return {
      success: true,
      message: "If that account exists, a reset email will be sent."
    };
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = this.hashToken(token);
    const storedToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash }
    });

    if (!storedToken || storedToken.usedAt || storedToken.expiresAt < new Date()) {
      throw new BadRequestException("Invalid password reset token");
    }

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() }
      }),
      this.prisma.user.update({
        where: { id: storedToken.userId },
        data: { passwordHash: await argon2.hash(password) }
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: storedToken.userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      })
    ]);

    return { success: true };
  }

  private async issueAuthResponse(
    userId: string,
    email: string,
    name: string | null,
    emailVerifiedAt: Date | null
  ) {
    const refreshToken = this.generateToken();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId,
        expiresAt: this.refreshTokenExpiry()
      }
    });

    return {
      accessToken: await this.signAccessToken(userId, email),
      refreshToken,
      user: {
        id: userId,
        email,
        name,
        emailVerifiedAt
      }
    };
  }

  private async signAccessToken(userId: string, email: string) {
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET", "devsync-access-secret"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m")
      }
    );
  }

  private async createEmailVerificationToken(userId: string) {
    const token = this.generateToken();

    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + DAY_IN_MS)
      }
    });

    return token;
  }

  private async createPasswordResetToken(userId: string) {
    const token = this.generateToken();

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + HOUR_IN_MS)
      }
    });

    return token;
  }

  private refreshTokenExpiry() {
    return new Date(Date.now() + 7 * DAY_IN_MS);
  }

  private generateToken() {
    return generateToken();
  }

  private hashToken(token: string) {
    return hashToken(token);
  }

  private serializeUser(user: {
    id: string;
    email: string;
    name: string | null;
    emailVerifiedAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt
    };
  }
}

