import type { ConfigService } from '../config';
import type { TextQualityEvaluation } from './ocr.types';

/**
 * Responsibility: Deterministic text-quality heuristics (no AI).
 *
 * Score combines:
 * - Non-empty length vs OCR_MIN_TEXT_LENGTH
 * - Alphanumeric character ratio
 * - Inverse whitespace ratio (too much whitespace ⇒ scanned garbage)
 * - Readable word count (tokens with letters/digits length ≥ 2)
 *
 * Acceptable when score >= OCR_QUALITY_THRESHOLD and length >= OCR_MIN_TEXT_LENGTH.
 */
export class QualityEvaluatorService {
  public constructor(private readonly config: ConfigService) {}

  /**
   * Evaluates extracted PDF text quality for DIRECT_TEXT acceptance.
   */
  public evaluate(text: string): TextQualityEvaluation {
    const normalized = (text ?? '').replace(/\u0000/g, '').trim();
    const length = normalized.length;
    const empty = length === 0;
    const reasons: string[] = [];

    if (empty) {
      reasons.push('empty_extraction');
    }

    const alphanumericCount = (normalized.match(/[A-Za-z0-9]/g) ?? []).length;
    const whitespaceCount = (normalized.match(/\s/g) ?? []).length;
    const alphanumericRatio = length === 0 ? 0 : alphanumericCount / length;
    const whitespaceRatio = length === 0 ? 1 : whitespaceCount / length;

    const readableWordCount = normalized
      .split(/\s+/)
      .filter((token) => /[A-Za-z0-9]{2,}/.test(token)).length;

    const minLength = this.config.ocr.minTextLength;
    const lengthScore = Math.min(1, length / Math.max(minLength, 1));
    const alphaScore = clamp01(alphanumericRatio / 0.45);
    const whitespaceScore = clamp01(1 - Math.max(0, whitespaceRatio - 0.35) / 0.65);
    const wordScore = Math.min(1, readableWordCount / 20);

    const score = clamp01(
      lengthScore * 0.35 + alphaScore * 0.3 + whitespaceScore * 0.15 + wordScore * 0.2,
    );

    if (length < minLength) {
      reasons.push(`length_below_min:${length}<${minLength}`);
    }
    if (alphanumericRatio < 0.25) {
      reasons.push(`low_alphanumeric_ratio:${alphanumericRatio.toFixed(3)}`);
    }
    if (whitespaceRatio > 0.7) {
      reasons.push(`high_whitespace_ratio:${whitespaceRatio.toFixed(3)}`);
    }
    if (readableWordCount < 5 && length > 0) {
      reasons.push(`few_readable_words:${readableWordCount}`);
    }

    const threshold = this.config.ocr.qualityThreshold;
    const acceptable =
      !empty && length >= minLength && score >= threshold && alphanumericRatio >= 0.2;

    if (!acceptable && score < threshold) {
      reasons.push(`score_below_threshold:${score.toFixed(3)}<${threshold}`);
    }

    return {
      acceptable,
      score: Number(score.toFixed(4)),
      metrics: {
        length,
        alphanumericRatio: Number(alphanumericRatio.toFixed(4)),
        whitespaceRatio: Number(whitespaceRatio.toFixed(4)),
        readableWordCount,
        empty,
      },
      reasons,
    };
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
