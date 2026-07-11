import { describe, it, expect } from 'vitest';
import {
  validateListing,
  loadAndValidateListing,
  checkSoftLimits,
  SHORT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  DETAILED_DESCRIPTION_SOFT_LIMIT,
  type Listing,
} from '../../tooling/release/metadata-schema';

function validListing(overrides: Partial<Listing> = {}): unknown {
  return {
    productName: 'Hamesh — Contextual Notes',
    category: 'Productivity',
    homepageUrl: 'https://hamesh.app',
    supportUrl: 'https://github.com/mohammed-fandees/hamesh/issues',
    privacyPolicyUrl: 'https://hamesh.app/privacy.html',
    locales: {
      en: {
        shortDescription: 'Attach a note to any element.',
        detailedDescription: 'Full description text.',
      },
    },
    ...overrides,
  };
}

describe('validateListing', () => {
  it('accepts a well-formed listing', () => {
    const result = validateListing(validListing());
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts optional homepageUrl/supportUrl as empty strings', () => {
    const result = validateListing(validListing({ homepageUrl: '', supportUrl: '' }));
    expect(result.success).toBe(true);
  });

  it('rejects a missing required field', () => {
    const listing = validListing() as Record<string, unknown>;
    delete listing.privacyPolicyUrl;
    const result = validateListing(listing);
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('privacyPolicyUrl'))).toBe(true);
  });

  it(`rejects a productName over ${PRODUCT_NAME_MAX_LENGTH} characters`, () => {
    const result = validateListing(
      validListing({ productName: 'x'.repeat(PRODUCT_NAME_MAX_LENGTH + 1) }),
    );
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('productName'))).toBe(true);
  });

  it(`rejects a shortDescription over ${SHORT_DESCRIPTION_MAX_LENGTH} characters`, () => {
    const result = validateListing(
      validListing({
        locales: {
          en: {
            shortDescription: 'x'.repeat(SHORT_DESCRIPTION_MAX_LENGTH + 1),
            detailedDescription: 'desc',
          },
        },
      }),
    );
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('shortDescription'))).toBe(true);
  });

  it('rejects a non-https privacyPolicyUrl', () => {
    const result = validateListing(
      validListing({ privacyPolicyUrl: 'http://hamesh.app/privacy.html' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a malformed URL', () => {
    const result = validateListing(validListing({ privacyPolicyUrl: 'not-a-url' }));
    expect(result.success).toBe(false);
  });

  it('accepts an optional ar locale alongside required en', () => {
    const result = validateListing(
      validListing({
        locales: {
          en: { shortDescription: 'EN summary', detailedDescription: 'EN detail' },
          ar: { shortDescription: 'ملخص', detailedDescription: 'تفاصيل' },
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a malformed ar locale even though en is valid', () => {
    const result = validateListing(
      validListing({
        locales: {
          en: { shortDescription: 'EN summary', detailedDescription: 'EN detail' },
          ar: { shortDescription: '', detailedDescription: 'تفاصيل' },
        },
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe('checkSoftLimits', () => {
  it('returns no warnings for a normal-length description', () => {
    const listing = validateListing(validListing()).data as Listing;
    expect(checkSoftLimits(listing)).toEqual([]);
  });

  it(`warns (but does not fail schema validation) past the advisory ${DETAILED_DESCRIPTION_SOFT_LIMIT}-char threshold`, () => {
    const listing = validateListing(
      validListing({
        locales: {
          en: {
            shortDescription: 'short',
            detailedDescription: 'x'.repeat(DETAILED_DESCRIPTION_SOFT_LIMIT + 1),
          },
        },
      }),
    ).data as Listing;

    const warnings = checkSoftLimits(listing);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('locales.en.detailedDescription');
  });
});

describe('loadAndValidateListing', () => {
  it('parses valid YAML and validates it', () => {
    const yaml = `
productName: Hamesh
category: Productivity
homepageUrl: https://hamesh.app
supportUrl: ''
privacyPolicyUrl: https://hamesh.app/privacy.html
locales:
  en:
    shortDescription: A short summary.
    detailedDescription: A longer description.
`;
    const result = loadAndValidateListing(yaml);
    expect(result.success).toBe(true);
  });

  it('fails cleanly on malformed YAML instead of throwing', () => {
    const result = loadAndValidateListing('productName: [unterminated');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('not valid YAML');
  });
});
