/**
 * Model Audit Engine
 *
 * Detects the current AI model and suggests cheaper alternatives
 * with cost estimates. Useful for reducing per-token API costs.
 */

// ── Minimal model type (avoids direct pi-ai dependency) ──────────

interface ModelLike {
  id?: string;
  modelId?: string;
  provider?: string;
  name?: string;
}

// ── Model Pricing Database ────────────────────────────────────────

export interface ModelPricing {
  /** Provider name */
  provider: string;
  /** Display label */
  label: string;
  /** Cost per million input tokens (USD) */
  inputCostPer1M: number;
  /** Cost per million output tokens (USD) */
  outputCostPer1M: number;
  /** Pricing tier */
  tier: 'free' | 'budget' | 'standard' | 'premium';
  /** Reasoning capability */
  reasoning: boolean;
  /** Typical context window */
  contextWindow: number;
  /** Alternative to this model (model ID for switching) */
  cheaperAlternative?: string;
}

/**
 * Known model pricing data (USD per 1M tokens).
 * Sourced from official provider pricing pages — may drift over time.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── Anthropic ──
  'claude-opus-4': {
    provider: 'anthropic',
    label: 'Claude Opus 4',
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    tier: 'premium',
    reasoning: true,
    contextWindow: 200000,
    cheaperAlternative: 'claude-sonnet-4',
  },
  'claude-sonnet-4': {
    provider: 'anthropic',
    label: 'Claude Sonnet 4',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    tier: 'standard',
    reasoning: true,
    contextWindow: 200000,
    cheaperAlternative: 'claude-haiku-3.5',
  },
  'claude-haiku-3.5': {
    provider: 'anthropic',
    label: 'Claude Haiku 3.5',
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
    tier: 'budget',
    reasoning: false,
    contextWindow: 200000,
  },
  'claude-opus-4-5': {
    provider: 'anthropic',
    label: 'Claude Opus 4.5',
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    tier: 'premium',
    reasoning: true,
    contextWindow: 200000,
    cheaperAlternative: 'claude-sonnet-4',
  },

  // ── OpenAI ──
  'gpt-4o': {
    provider: 'openai',
    label: 'GPT-4o',
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    tier: 'standard',
    reasoning: false,
    contextWindow: 128000,
    cheaperAlternative: 'gpt-4o-mini',
  },
  'gpt-4o-mini': {
    provider: 'openai',
    label: 'GPT-4o Mini',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    tier: 'budget',
    reasoning: false,
    contextWindow: 128000,
  },
  'o1': {
    provider: 'openai',
    label: 'o1',
    inputCostPer1M: 15.0,
    outputCostPer1M: 60.0,
    tier: 'premium',
    reasoning: true,
    contextWindow: 200000,
    cheaperAlternative: 'o3-mini',
  },
  'o3-mini': {
    provider: 'openai',
    label: 'o3-mini',
    inputCostPer1M: 1.1,
    outputCostPer1M: 4.4,
    tier: 'budget',
    reasoning: true,
    contextWindow: 200000,
  },

  // ── Google ──
  'gemini-2.5-pro': {
    provider: 'google',
    label: 'Gemini 2.5 Pro',
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    tier: 'standard',
    reasoning: true,
    contextWindow: 1048576,
    cheaperAlternative: 'gemini-2.5-flash',
  },
  'gemini-2.5-flash': {
    provider: 'google',
    label: 'Gemini 2.5 Flash',
    inputCostPer1M: 0.3,
    outputCostPer1M: 1.5,
    tier: 'budget',
    reasoning: false,
    contextWindow: 1048576,
  },
  'gemini-2.0-flash': {
    provider: 'google',
    label: 'Gemini 2.0 Flash',
    inputCostPer1M: 0.0,
    outputCostPer1M: 0.0,
    tier: 'free',
    reasoning: false,
    contextWindow: 1048576,
  },

  // ── DeepSeek ──
  'deepseek-chat': {
    provider: 'deepseek',
    label: 'DeepSeek V3',
    inputCostPer1M: 0.27,
    outputCostPer1M: 1.1,
    tier: 'budget',
    reasoning: false,
    contextWindow: 131072,
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    label: 'DeepSeek R1',
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    tier: 'budget',
    reasoning: true,
    contextWindow: 131072,
  },
};

// ── Model Detection ───────────────────────────────────────────────

export interface DetectedModel {
  id: string;
  label: string;
  provider: string;
  tier: ModelPricing['tier'];
  inputCostPer1M: number;
  outputCostPer1M: number;
  reasoning: boolean;
  contextWindow: number;
}

/**
 * Try to detect the current model from the Pi model object.
 */
export function detectCurrentModel(model: ModelLike | undefined | null): DetectedModel | null {
  if (!model) return null;

  const id = (model as any).id ?? (model as any).modelId ?? '';
  if (!id) return null;

  // Try exact match first
  const pricing = MODEL_PRICING[id];
  if (pricing) {
    return {
      id,
      label: pricing.label,
      provider: pricing.provider,
      tier: pricing.tier,
      inputCostPer1M: pricing.inputCostPer1M,
      outputCostPer1M: pricing.outputCostPer1M,
      reasoning: pricing.reasoning,
      contextWindow: pricing.contextWindow,
    };
  }

  // Try fuzzy match
  for (const [key, p] of Object.entries(MODEL_PRICING)) {
    if (id.includes(key) || key.includes(id)) {
      return {
        id: key,
        label: p.label,
        provider: p.provider,
        tier: p.tier,
        inputCostPer1M: p.inputCostPer1M,
        outputCostPer1M: p.outputCostPer1M,
        reasoning: p.reasoning,
        contextWindow: p.contextWindow,
      };
    }
  }

  // Partial heuristics
  const lowerId = id.toLowerCase();
  if (lowerId.includes('opus')) {
    const p = MODEL_PRICING['claude-opus-4'];
    return { id, label: `Claude Opus (${id})`, provider: p.provider, tier: p.tier, inputCostPer1M: p.inputCostPer1M, outputCostPer1M: p.outputCostPer1M, reasoning: p.reasoning, contextWindow: p.contextWindow };
  }
  if (lowerId.includes('sonnet')) {
    const p = MODEL_PRICING['claude-sonnet-4'];
    return { id, label: `Claude Sonnet (${id})`, provider: p.provider, tier: p.tier, inputCostPer1M: p.inputCostPer1M, outputCostPer1M: p.outputCostPer1M, reasoning: p.reasoning, contextWindow: p.contextWindow };
  }
  if (lowerId.includes('haiku')) {
    const p = MODEL_PRICING['claude-haiku-3.5'];
    return { id, label: `Claude Haiku (${id})`, provider: p.provider, tier: p.tier, inputCostPer1M: p.inputCostPer1M, outputCostPer1M: p.outputCostPer1M, reasoning: p.reasoning, contextWindow: p.contextWindow };
  }
  if (lowerId.includes('gemini')) {
    const p = MODEL_PRICING['gemini-2.0-flash'];
    return { id, label: `Gemini (${id})`, provider: p.provider, tier: p.tier, inputCostPer1M: p.inputCostPer1M, outputCostPer1M: p.outputCostPer1M, reasoning: false, contextWindow: p.contextWindow };
  }
  if (lowerId.includes('gpt')) {
    const p = MODEL_PRICING['gpt-4o-mini'];
    return { id, label: `OpenAI (${id})`, provider: p.provider, tier: p.tier, inputCostPer1M: p.inputCostPer1M, outputCostPer1M: p.outputCostPer1M, reasoning: false, contextWindow: p.contextWindow };
  }

  return null;
}

// ── Suggestions Engine ────────────────────────────────────────────

export interface ModelSuggestion {
  current: string;
  suggested: string;
  suggestedLabel: string;
  reason: string;
  monthlySaving: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Standard usage estimates for typical coding-agent workloads.
 */
const USAGE_ESTIMATES = {
  // Average tokens consumed per turn
  inputTokensPerTurn: 15000,
  outputTokensPerTurn: 2000,
  // Average turns per day for an active developer
  turnsPerDay: 50,
  daysPerMonth: 22,
};

/**
 * Estimate monthly cost for a model.
 */
export function estimateMonthlyCost(pricing: ModelPricing): number {
  const monthlyInputTokens = USAGE_ESTIMATES.inputTokensPerTurn * USAGE_ESTIMATES.turnsPerDay * USAGE_ESTIMATES.daysPerMonth;
  const monthlyOutputTokens = USAGE_ESTIMATES.outputTokensPerTurn * USAGE_ESTIMATES.turnsPerDay * USAGE_ESTIMATES.daysPerMonth;

  return (
    (monthlyInputTokens / 1_000_000) * pricing.inputCostPer1M +
    (monthlyOutputTokens / 1_000_000) * pricing.outputCostPer1M
  );
}

/**
 * Generate model switch suggestions.
 */
export function generateSuggestions(current: DetectedModel): ModelSuggestion[] {
  const suggestions: ModelSuggestion[] = [];

  // Only suggest if not already on the cheapest tier
  if (current.tier === 'free') {
    return suggestions;
  }

  const currentPricing = MODEL_PRICING[current.id];
  if (!currentPricing) return suggestions;

  const currentMonthly = estimateMonthlyCost(currentPricing);

  // Check for explicit cheaper alternative
  if (currentPricing.cheaperAlternative) {
    const altPricing = MODEL_PRICING[currentPricing.cheaperAlternative];
    if (altPricing) {
      const altMonthly = estimateMonthlyCost(altPricing);
      const saving = currentMonthly - altMonthly;

      if (saving > 1) { // Only suggest if saving > $1/month
        let reason: string;
        if (altPricing.tier === 'free') {
          reason = `${altPricing.label} is completely free for input and output. Great for background tasks, summaries, and simple code reviews if your provider has a free tier.`;
        } else {
          reason = `${altPricing.label} costs ${(altPricing.inputCostPer1M / currentPricing.inputCostPer1M * 100).toFixed(0)}% of ${currentPricing.label} per input token with similar quality for most tasks.`;
        }

        suggestions.push({
          current: current.label,
          suggested: currentPricing.cheaperAlternative,
          suggestedLabel: altPricing.label,
          reason,
          monthlySaving: saving,
          confidence: altPricing.tier === 'free' ? 'high' : 'medium',
        });
      }
    }
  }

  // Generic tier-based suggestions
  if (current.tier === 'premium' && suggestions.length === 0) {
    // Suggest standard tier alternative
    const standardModels = Object.entries(MODEL_PRICING).filter(
      ([_, p]) => p.tier === 'standard' && p.provider === current.provider,
    );
    if (standardModels.length > 0) {
      const [altId, altPricing] = standardModels[0];
      const altMonthly = estimateMonthlyCost(altPricing);
      const saving = currentMonthly - altMonthly;
      if (saving > 1) {
        suggestions.push({
          current: current.label,
          suggested: altId,
          suggestedLabel: altPricing.label,
          reason: `Most coding tasks work great on ${altPricing.label}. Reserve ${current.label} for complex multi-step reasoning only.`,
          monthlySaving: saving,
          confidence: 'medium',
        });
      }
    }
  }

  return suggestions;
}

// ── Audit Report Formatting ───────────────────────────────────────

export interface AuditReport {
  currentModel: DetectedModel | null;
  suggestions: ModelSuggestion[];
  estimatedMonthlyCost: number;
  potentialMonthlySavings: number;
}

/**
 * Run a full model audit and return a formatted report.
 */
export function runAudit(model: ModelLike | undefined | null): AuditReport {
  const current = detectCurrentModel(model);
  const suggestions = current ? generateSuggestions(current) : [];
  const estimatedMonthlyCost = current
    ? estimateMonthlyCost(MODEL_PRICING[current.id] ?? MODEL_PRICING['claude-sonnet-4'])
    : 0;
  const potentialMonthlySavings = suggestions.reduce((sum, s) => sum + s.monthlySaving, 0);

  return {
    currentModel: current,
    suggestions,
    estimatedMonthlyCost,
    potentialMonthlySavings,
  };
}

/**
 * Format the audit report for display.
 */
export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [
    '🤖 **Token Saver — Model Audit**',
    '',
  ];

  if (!report.currentModel) {
    lines.push('⚠️ Current model could not be detected. Here are general recommendations:');
    lines.push('');
  } else {
    const current = report.currentModel;
    const tierEmoji = current.tier === 'free' ? '🟢' : current.tier === 'budget' ? '🟡' : current.tier === 'standard' ? '🟠' : '🔴';
    lines.push(`**Current Model:** ${tierEmoji} ${current.label} (${current.provider})`);
    lines.push(`  Tier: ${current.tier} | Input: $${current.inputCostPer1M}/1M tokens | Context: ${(current.contextWindow / 1000).toFixed(0)}K`);
    lines.push(`  Est. Monthly Cost: $${report.estimatedMonthlyCost.toFixed(2)}`);
    lines.push('');
  }

  // Pricing reference
  lines.push('---');
  lines.push('');
  lines.push('### Model Pricing Reference');
  lines.push('');

  const tiers: Record<string, Array<[string, ModelPricing]>> = { free: [], budget: [], standard: [], premium: [] };
  for (const [id, p] of Object.entries(MODEL_PRICING)) {
    tiers[p.tier].push([id, p]);
  }

  for (const [tierName, models] of Object.entries(tiers)) {
    if (models.length === 0) continue;
    const emoji = tierName === 'free' ? '🟢' : tierName === 'budget' ? '🟡' : tierName === 'standard' ? '🟠' : '🔴';
    const monthlyMap = models.map(([_, p]) => ({ label: p.label, cost: estimateMonthlyCost(p) }));
    const cheapest = monthlyMap.reduce((a, b) => a.cost < b.cost ? a : b);
    const mostExpensive = monthlyMap.reduce((a, b) => a.cost > b.cost ? a : b);
    lines.push(`${emoji} **${tierName.charAt(0).toUpperCase() + tierName.slice(1)}** ($${cheapest.cost.toFixed(2)}–$${mostExpensive.cost.toFixed(2)}/month est.)`);
    for (const [_, p] of models) {
      const cost = estimateMonthlyCost(p);
      lines.push(`  • ${p.label} — $${p.inputCostPer1M}/1M in, $${p.outputCostPer1M}/1M out — ~$${cost.toFixed(2)}/mo`);
    }
    lines.push('');
  }

  // Suggestions
  if (report.suggestions.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('### 🔄 Suggestions');
    lines.push('');

    for (const s of report.suggestions) {
      const confEmoji = s.confidence === 'high' ? '✅' : s.confidence === 'medium' ? '💡' : '🤔';
      lines.push(`${confEmoji} **${s.current} → ${s.suggestedLabel}**`);
      lines.push(`   Saving: ~$${s.monthlySaving.toFixed(2)}/month`);
      lines.push(`   ${s.reason}`);
      lines.push('');
    }

    lines.push(`**Total possible savings:** ~$${report.potentialMonthlySavings.toFixed(2)}/month`);
  } else if (report.currentModel) {
    lines.push('✅ Your current model configuration looks cost-efficient!');
  }

  lines.push('');
  lines.push('> 💡 Model pricing may change. Check provider pricing pages for current rates.');
  lines.push('> To switch models, use `/model` or the Pi configuration.');

  return lines.join('\n');
}
