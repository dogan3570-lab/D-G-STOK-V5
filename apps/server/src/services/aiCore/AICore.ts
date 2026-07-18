import { PromptBuilder } from './utils/PromptBuilder.ts';
import { AIResponseParser } from './utils/AIResponseParser.ts';
import { ModelConnector } from './utils/ModelConnector.ts';

export interface AIRequest {
  module: string; // ErrorAnalyzer | ForbiddenWordEngine | PreflightChecker
  input: any;
}

export interface AIResponse {
  success: boolean;
  module: string;
  analysis: string;
  suggestion: string;
  confidence: number;
  data: any;
  latencyMs: number;
  error?: string;
}

export class AICore {
  private promptBuilder: PromptBuilder;
  private responseParser: AIResponseParser;
  private modelConnector: ModelConnector;

  constructor() {
    this.promptBuilder = new PromptBuilder();
    this.responseParser = new AIResponseParser();
    this.modelConnector = new ModelConnector();
  }

  async process(module: string, input: any): Promise<AIResponse> {
    const start = Date.now();

    try {
      // 1. Prompt olustur
      const prompt = this.promptBuilder.build(module, input);

      // 2. AI modeline gonder
      const modelResponse = await this.modelConnector.send(prompt, module);
      if (!modelResponse.success) {
        return this.errorResponse(module, modelResponse.error || 'Model hatasi', start);
      }

      // 3. Cevabi parse et
      const parsedData = typeof modelResponse.data === 'string'
        ? this.responseParser.parse(modelResponse.data)
        : { success: true, data: modelResponse.data };

      if (!parsedData.success) {
        return this.errorResponse(module, 'Cevap parse edilemedi', start);
      }

      // 4. Sonucu olustur
      return {
        success: true,
        module,
        analysis: this.responseParser.extractField(parsedData.data, 'analysis', 'Analiz yapilamadi'),
        suggestion: this.responseParser.getSuggestion(parsedData.data),
        confidence: this.responseParser.getConfidence(parsedData.data),
        data: parsedData.data,
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      return this.errorResponse(module, error.message, start);
    }
  }

  private errorResponse(module: string, error: string, start: number): AIResponse {
    return {
      success: false,
      module,
      analysis: 'AI analizi basarisiz',
      suggestion: 'Manuel kontrol onerilir',
      confidence: 0,
      data: null,
      latencyMs: Date.now() - start,
      error,
    };
  }

  setModel(model: 'openai' | 'azure' | 'huggingface' | 'mock'): void {
    this.modelConnector.setModel(model);
  }
}
