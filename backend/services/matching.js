const ProviderProfile = require('../models/ProviderProfile');

const DEFAULT_RADIUS_METERS = Number(process.env.DEFAULT_MATCH_RADIUS_METERS) || 10000;
const MAX_CANDIDATES = 5;

/**
 * Finds nearby, available, verified providers for a given category and ranks them
 * by a blend of distance, rating, and acceptance rate - not distance alone.
 *
 * @param {Object} params
 * @param {[number, number]} params.coordinates - [longitude, latitude] of the request
 * @param {string} params.categoryId
 * @param {string} params.city
 * @param {number} [params.radiusMeters]
 * @returns {Promise<Array<{ provider: Object, distanceMeters: number, score: number }>>}
 */
async function findRankedCandidates({ coordinates, categoryId, city, radiusMeters }) {
  const radius = radiusMeters || DEFAULT_RADIUS_METERS;

  // $geoNear must be the first stage in the aggregation pipeline.
  // It both filters by distance AND returns the computed distance per document.
  const nearby = await ProviderProfile.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates },
        distanceField: 'distanceMeters',
        maxDistance: radius,
        query: {
          city,
          categories: categoryId,
          available: true,
          verified: true,
        },
        spherical: true,
      },
    },
    { $limit: 50 }, // pull a reasonable pool before ranking, keeps aggregation cheap
  ]);

  if (nearby.length === 0) return [];

  const ranked = nearby
    .map((p) => {
      const acceptanceRate = p.jobsOffered ? p.jobsAccepted / p.jobsOffered : 0.5; // neutral prior for new providers
      // Distance is normalized against the search radius so it contributes 0-1, same scale as rating/acceptance.
      const distanceScore = 1 - Math.min(p.distanceMeters / radius, 1);
      const ratingScore = (p.ratingAverage || 0) / 5;

      // Weights: distance matters most, but a bad acceptance rate or low rating can drop a close provider down the list.
      const score = distanceScore * 0.5 + ratingScore * 0.3 + acceptanceRate * 0.2;

      return { provider: p, distanceMeters: p.distanceMeters, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  return ranked;
}

module.exports = { findRankedCandidates, DEFAULT_RADIUS_METERS, MAX_CANDIDATES };
