import { prisma } from '../../db/prisma.ts';

export interface WordCheckResult {
  found: boolean;
  word: string;
  category: string;
  riskLevel: string;
  suggestion?: string;
  position: number;
}

export interface ContentCheckResult {
  title: WordCheckResult[];
  description: WordCheckResult[];
  brand: WordCheckResult[];
  totalIssues: number;
  score: number;
  autoFixable: boolean;
}

export class ForbiddenWordEngine {
  async check(text: string, marketplaceKey?: string): Promise<WordCheckResult[]> {
    const results: WordCheckResult[] = [];
    const lowerText = text.toLowerCase();

    const words = await prisma.forbiddenWord.findMany({
      where: {
        isActive: true,
        ...(marketplaceKey ? {
          OR: [
            { marketplaces: { contains: marketplaceKey } },
            { marketplaces: null },
          ],
        } : {}),
      },
    });

    for (const w of words) {
      const idx = lowerText.indexOf(w.word.toLowerCase());
      if (idx !== -1) {
        results.push({
          found: true,
          word: w.word,
          category: w.category,
          riskLevel: w.riskLevel,
          suggestion: w.autoFix || undefined,
          position: idx,
        });
      }
    }

    return results;
  }

  async checkProduct(title: string | null, description: string | null, brand: string | null, marketplaceKey?: string): Promise<ContentCheckResult> {
    const [titleIssues, descIssues, brandIssues] = await Promise.all([
      title ? this.check(title, marketplaceKey) : Promise.resolve([]),
      description ? this.check(description, marketplaceKey) : Promise.resolve([]),
      brand ? this.check(brand, marketplaceKey) : Promise.resolve([]),
    ]);

    const totalIssues = titleIssues.length + descIssues.length + brandIssues.length;
    const autoFixable = totalIssues > 0 && [...titleIssues, ...descIssues, ...brandIssues].every(r => !!r.suggestion);

    return {
      title: titleIssues,
      description: descIssues,
      brand: brandIssues,
      totalIssues,
      score: Math.max(0, 100 - totalIssues * 10),
      autoFixable,
    };
  }

  suggestFix(text: string, issues: WordCheckResult[]): string {
    let fixed = text;
    for (const issue of issues) {
      if (issue.suggestion) {
        fixed = fixed.replace(new RegExp(issue.word, 'gi'), issue.suggestion);
      }
    }
    return fixed;
  }
}
