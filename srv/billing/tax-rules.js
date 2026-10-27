const SAMPLE_TAX_RATES = [0, 5, 12, 18];

// Development-only sample rates, not legal or jurisdiction-specific tax advice.
module.exports = function getSampleTaxRate(configuredRate, req) {
  const rate = Number(configuredRate ?? 18);
  if (!SAMPLE_TAX_RATES.includes(rate)) {
    req.reject(400, 'Project tax_rate must be one of the configured sample rates: 0, 5, 12, or 18 percent.');
  }
  return rate;
};
