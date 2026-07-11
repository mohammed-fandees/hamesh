import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

// Official, confirmed Chrome Web Store limits (docs/releases/RESEARCH.md §7). Only encode a
// limit here if it was actually confirmed against current official documentation — an
// unconfirmed number presented as a hard validation failure would be worse than no check at
// all, per the requirement not to present an unreliable check as authoritative.
export const PRODUCT_NAME_MAX_LENGTH = 75;
export const SHORT_DESCRIPTION_MAX_LENGTH = 132;

// No official hard cap was found for the detailed description. This is intentionally a soft,
// advisory-only threshold (see checkSoftLimits), not part of the schema's hard validation.
export const DETAILED_DESCRIPTION_SOFT_LIMIT = 16000;

const httpsUrl = z
  .string()
  .url('must be a well-formed URL')
  .refine((value) => value.startsWith('https://'), 'must use https://');

const optionalHttpsUrl = z.union([httpsUrl, z.literal('')]);

const localeSchema = z.object({
  shortDescription: z
    .string()
    .trim()
    .min(1, 'shortDescription must not be empty')
    .max(
      SHORT_DESCRIPTION_MAX_LENGTH,
      `shortDescription must be at most ${SHORT_DESCRIPTION_MAX_LENGTH} characters`,
    ),
  detailedDescription: z.string().trim().min(1, 'detailedDescription must not be empty'),
});

export const listingSchema = z.object({
  productName: z
    .string()
    .trim()
    .min(1, 'productName must not be empty')
    .max(
      PRODUCT_NAME_MAX_LENGTH,
      `productName must be at most ${PRODUCT_NAME_MAX_LENGTH} characters`,
    ),
  category: z.string().trim().min(1, 'category must not be empty'),
  homepageUrl: optionalHttpsUrl,
  supportUrl: optionalHttpsUrl,
  privacyPolicyUrl: httpsUrl,
  chromeWebStoreItemId: z.string().trim().min(1).optional(),
  locales: z.object({ en: localeSchema }).catchall(localeSchema),
});

export type Listing = z.infer<typeof listingSchema>;

export interface ListingValidationResult {
  success: boolean;
  data?: Listing;
  errors: string[];
  /** Non-fatal notices, e.g. an unconfirmed soft length limit — never blocks approval by itself. */
  warnings: string[];
}

/** Parses raw YAML text into an unknown value. Throws on malformed YAML (a hard failure). */
export function parseListingYaml(raw: string): unknown {
  return parseYaml(raw);
}

/** Validates a parsed listing against the schema. Never throws — collects every error found. */
export function validateListing(data: unknown): ListingValidationResult {
  const result = listingSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
      warnings: [],
    };
  }

  return { success: true, data: result.data, errors: [], warnings: checkSoftLimits(result.data) };
}

/** Advisory-only checks that have no confirmed official limit backing them. */
export function checkSoftLimits(listing: Listing): string[] {
  const warnings: string[] = [];

  for (const [locale, copy] of Object.entries(listing.locales)) {
    if (copy.detailedDescription.length > DETAILED_DESCRIPTION_SOFT_LIMIT) {
      warnings.push(
        `locales.${locale}.detailedDescription is ${copy.detailedDescription.length} characters. No official hard cap was confirmed (docs/releases/RESEARCH.md §7); this exceeds the advisory threshold of ${DETAILED_DESCRIPTION_SOFT_LIMIT}. Verify against the live dashboard field before submitting.`,
      );
    }
  }

  return warnings;
}

/** Convenience wrapper: parse YAML text and validate it in one call. */
export function loadAndValidateListing(raw: string): ListingValidationResult {
  let parsed: unknown;
  try {
    parsed = parseListingYaml(raw);
  } catch (error) {
    return {
      success: false,
      errors: [`listing.yaml is not valid YAML: ${(error as Error).message}`],
      warnings: [],
    };
  }
  return validateListing(parsed);
}
