import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, CircuitState> = new Map();
  private readonly threshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenTimeout: number;

  constructor(private configService: ConfigService) {
    this.threshold = this.configService.get<number>('CIRCUIT_BREAKER_THRESHOLD') || 5;
    this.resetTimeout = this.configService.get<number>('CIRCUIT_BREAKER_RESET_MS') || 60000;
    this.halfOpenTimeout = this.configService.get<number>('CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT_MS') || 30000;
  }

  private getOrCreateCircuit(serviceName: string): CircuitState {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
      });
    }
    return this.circuits.get(serviceName)!;
  }

  async callWithBreaker<T>(
    serviceName: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(serviceName);

    if (circuit.state === 'OPEN') {
      const elapsed = Date.now() - circuit.lastFailureTime;
      if (elapsed >= this.resetTimeout) {
        circuit.state = 'HALF_OPEN';
        this.logger.warn(`${serviceName} circuit HALF_OPEN - test ediliyor`);
      } else if (elapsed >= this.halfOpenTimeout) {
        circuit.state = 'HALF_OPEN';
      } else {
        this.logger.warn(`${serviceName} circuit OPEN - istek engellendi`);
        if (fallback) return fallback();
        throw new Error(`${serviceName} servisi su anda kullanilamiyor (circuit open)`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(serviceName);
      return result;
    } catch (error) {
      this.onFailure(serviceName);
      if (fallback) return fallback();
      throw error;
    }
  }

  private onSuccess(serviceName: string) {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.failures = 0;
      circuit.state = 'CLOSED';
    }
  }

  private onFailure(serviceName: string) {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.failures++;
      circuit.lastFailureTime = Date.now();
      if (circuit.failures >= this.threshold) {
        circuit.state = 'OPEN';
        this.logger.error(`${serviceName} circuit OPEN - ${this.resetTimeout}ms sonra tekrar denenecek`);
      }
    }
  }

  getCircuitState(serviceName: string): string {
    return this.circuits.get(serviceName)?.state || 'CLOSED';
  }

  resetCircuit(serviceName: string) {
    this.circuits.delete(serviceName);
    this.logger.log(`${serviceName} circuit sifirlandi`);
  }
}
