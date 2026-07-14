import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../modules/users/user.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);
  private readonly maxRetries = 5;
  private readonly retryDelay = 3000; // 3 saniye

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedWithRetry();
  }

  private async seedWithRetry(retryCount = 0): Promise<void> {
    try {
      await this.seedAdminUser();
    } catch (error: any) {
      if (error.message?.includes('relation') || error.code === '42P01') {
        if (retryCount < this.maxRetries) {
          this.logger.warn(`Tablolar henuz hazir degil, ${retryCount + 1}/${this.maxRetries} tekrar deneniyor...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          return this.seedWithRetry(retryCount + 1);
        }
      }
      this.logger.error(`Seed islemi basarisiz: ${error.message}`);
    }
  }

  private async seedAdminUser() {
    const adminEmail = 'admin@dgstore.com';
    const adminPassword = 'admin123';

    const existingAdmin = await this.usersRepository.findOne({ where: { email: adminEmail } });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const admin = this.usersRepository.create({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'DG Store',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });

      await this.usersRepository.save(admin);
      this.logger.log('========================================');
      this.logger.log('  Admin kullanıcısı oluşturuldu!');
      this.logger.log(`  Email:    ${adminEmail}`);
      this.logger.log(`  Şifre:    ${adminPassword}`);
      this.logger.log('========================================');
    } else {
      // Admin varsa şifresini güncelle (her başlangıçta standart şifre)
      existingAdmin.password = await bcrypt.hash(adminPassword, 10);
      existingAdmin.status = UserStatus.ACTIVE;
      existingAdmin.role = UserRole.ADMIN;
      await this.usersRepository.save(existingAdmin);
      this.logger.log('========================================');
      this.logger.log('  Admin kullanıcısı güncellendi!');
      this.logger.log(`  Email:    ${adminEmail}`);
      this.logger.log(`  Şifre:    ${adminPassword}`);
      this.logger.log('========================================');
    }
  }
}