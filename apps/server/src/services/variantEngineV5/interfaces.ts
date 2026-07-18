// ==================== VARYANT MOTORU V5.0 - INTERFACES ====================
// DG STOK V5.0 - Category-Based Smart Variant Engine
// ================================================================

import type {
  V5Product,
  VariantDecision,
  CategoryVariantConfig,
  ProductFamily,
  AIExtractionResult,
  ExtractedVariant,
  MarketplaceVariantRule,
  PipelineConfig,
  PipelineState,
  PipelineResult,
} from './types.ts';

// ==================== KATEGORİ MOTORU ====================

export interface ICategoryEngine {
  getCategoryConfig(categoryId: string): Promise<CategoryVariantConfig | null>;
  getCategoryConfigs(categoryIds: string[]): Promise<Map<string, CategoryVariantConfig>>;
  updateCategoryConfig(categoryId: string, config: Partial<CategoryVariantConfig>): Promise<void>;
  isVariantRequired(categoryId: string): Promise<boolean>;
}

// ==================== KARAR MOTORU ====================

export interface IDecisionEngine {
  decide(product: V5Product, categoryConfig: CategoryVariantConfig | null): Promise<VariantDecision>;
  decideBatch(products: V5Product[]): Promise<VariantDecision[]>;
}

// ==================== ÜRÜN AİLESİ MOTORU ====================

export interface IFamilyEngine {
  findFamilies(products: V5Product[], existingDecisions: Map<string, VariantDecision>): Promise<Map<string, ProductFamily>>;
  createFamily(modelName: string, products: V5Product[]): ProductFamily;
  mergeFamilies(families: Map<string, ProductFamily>): Promise<Map<string, ProductFamily>>;
}

// ==================== AI ÇIKARICI ====================

export interface IAIExtractor {
  extractFromTitle(title: string, categoryConfig: CategoryVariantConfig | null): Promise<ExtractedVariant[]>;
  extractFromDescription(description: string, categoryConfig: CategoryVariantConfig | null): Promise<ExtractedVariant[]>;
  analyzeProduct(product: V5Product, categoryConfig: CategoryVariantConfig | null): Promise<AIExtractionResult>;
  extractModelName(title: string): string;
}

// ==================== DOĞRULAYICI ====================

export interface IValidator {
  validate(decision: VariantDecision, product: V5Product): Promise<boolean>;
  validateBatch(decisions: VariantDecision[], products: Map<string, V5Product>): Promise<Map<string, boolean>>;
}

// ==================== PIPELINE ====================

export interface IPipeline {
  run(xmlSourceId?: string): Promise<PipelineResult>;
  resume(stateId: string): Promise<PipelineResult>;
  getState(stateId: string): Promise<PipelineState | null>;
  cancel(stateId: string): Promise<void>;
}

// ==================== LOGLAYICI ====================

export interface ILogger {
  logDecision(decision: VariantDecision, product: V5Product): Promise<void>;
  logBatch(decisions: VariantDecision[], products: Map<string, V5Product>): Promise<void>;
  getDecisionHistory(productId: string, limit?: number): Promise<VariantDecision[]>;
}

// ==================== ÖNBELLEK ====================

export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ==================== PAZARYERİ KURAL MOTORU ====================

export interface IMarketplaceRuleEngine {
  getRules(marketplaceKey: string, categoryId?: string): Promise<MarketplaceVariantRule[]>;
  applyRules(decision: VariantDecision, marketplaceKey: string): Promise<VariantDecision>;
}
