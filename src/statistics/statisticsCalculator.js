function normalizeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(value) {
  return `$${normalizeNumber(value).toFixed(2)}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${value.toFixed(1)}%`;
}

function buildBucketLabels(buckets, suffix = '') {
  return buckets.map((bucket) => `${bucket.label}${suffix}`);
}

function createDistributionBuckets(values, boundaries) {
  const buckets = boundaries.map((boundary, index) => ({
    label: index === 0 ? `≤ ${boundary}` : `${boundaries[index - 1] + 1}–${boundary}`,
    count: 0
  }));
  buckets.push({ label: `> ${boundaries[boundaries.length - 1]}`, count: 0 });

  values.forEach((value) => {
    const numericValue = normalizeNumber(value);
    const bucket = buckets.find((bucket, index) => {
      if (index === buckets.length - 1) {
        return numericValue > boundaries[boundaries.length - 1];
      }
      const boundary = boundaries[index];
      return numericValue <= boundary;
    });
    if (bucket) {
      bucket.count += 1;
    }
  });

  return buckets;
}

function buildChartData(rawData, valueKey = 'value', labelKey = 'label') {
  return rawData.map((item) => ({
    label: String(item[labelKey] || 'Unknown'),
    value: normalizeNumber(item[valueKey])
  }));
}

module.exports = {
  normalizeNumber,
  formatCurrency,
  formatPercent,
  buildBucketLabels,
  createDistributionBuckets,
  buildChartData
};
