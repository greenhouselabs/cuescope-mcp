/**
 * Shared confidence and assumption metadata for Review Mode outputs
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type AssumptionImpact = 'low' | 'medium' | 'high';

export interface ConfidenceSignal {
  name: string;
  score: number;
  weight?: number;
  reason: string;
}

export interface AnalysisConfidence {
  score: number;
  level: ConfidenceLevel;
  summary: string;
  signals: Array<{
    name: string;
    score: number;
    weight: number;
    reason: string;
  }>;
}

export interface AssumptionDetail {
  statement: string;
  basis: string;
  impact: AssumptionImpact;
  confidence: number;
}

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'high';
  if (score >= 0.65) return 'medium';
  return 'low';
}

export function buildAnalysisConfidence(
  signals: ConfidenceSignal[],
  summary?: string
): AnalysisConfidence {
  const normalizedSignals = signals.map((signal) => ({
    name: signal.name,
    score: Number(clampScore(signal.score).toFixed(2)),
    weight: signal.weight ?? 1,
    reason: signal.reason,
  }));
  const totalWeight = normalizedSignals.reduce((sum, signal) => sum + signal.weight, 0);
  const weightedScore =
    totalWeight > 0
      ? normalizedSignals.reduce((sum, signal) => sum + signal.score * signal.weight, 0) / totalWeight
      : 0.5;
  const score = Number(weightedScore.toFixed(2));
  const level = confidenceLevel(score);

  return {
    score,
    level,
    summary: summary ?? `Overall analysis confidence is ${level}.`,
    signals: normalizedSignals,
  };
}

export function assumptionDetail(
  statement: string,
  basis: string,
  impact: AssumptionImpact,
  confidence: number
): AssumptionDetail {
  return {
    statement,
    basis,
    impact,
    confidence: Number(clampScore(confidence).toFixed(2)),
  };
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
