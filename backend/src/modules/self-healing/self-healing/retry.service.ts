import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);
  private readonly maxRetries: number;
  private readonly baseDelay: number;

  constructor(private configService: ConfigService) {
    this.maxRetries = this.configService.get<number>('MAX_RETRY_ATTEMPTS') || 3;
    this.baseDelay = this.configService.get<number>('DB_RETRY_DELAY_MS') || 5000;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    options?: {
      maxRetries?: number;
      baseDelay?: number;
      retryOn?: (error: any) => boolean;
    },
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? this.maxRetries;
    const baseDelay = options?.baseDelay ?? this.baseDelay;
    const retryOn = options?.retryOn ?? (() => true);

    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`${context} - Deneme ${attempt}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;

        if (!retryOn(error) || attempt === maxRetries) {
          this.logger.error(`${context} - Basarisiz (${attempt}/${maxRetries}): ${error.message}`);
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        this.logger.warn(`${context} - Deneme ${attempt} basarisiz, ${Math.round(delay)}ms sonra tekrar...`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
