/**
 * Add full URL to image path if it's a relative path
 * Paths starting with /api/img/ are left as-is (relative URLs work fine)
 */
export function addImageUrl(imgPath) {
  if (!imgPath) return null;
  // Already a full URL or API path - leave as-is
  if (imgPath.startsWith('http') || imgPath.startsWith('/api/img/')) return imgPath;
  // Convert old /uploads/ paths to /api/img/ paths
  if (imgPath.startsWith('/uploads/')) {
    return imgPath.replace('/uploads/', '/api/img/');
  }
  return `/api/img/${imgPath}`;
}

/**
 * Transform an entity with img field to have full URL
 */
export function withImageUrl(entity) {
  if (!entity) return entity;
  if (entity.img) {
    return { ...entity, img: addImageUrl(entity.img) };
  }
  return entity;
}

/**
 * Transform an array of entities with img field
 */
export function withImageUrls(entities) {
  if (!entities) return entities;
  return entities.map(withImageUrl);
}

/**
 * Transform nested entities (driver, car, team, track) with img
 */
export function withNestedImageUrls(entity) {
  if (!entity) return entity;

  const result = { ...entity };

  if (result.img) {
    result.img = addImageUrl(result.img);
  }

  if (result.driver) {
    result.driver = withImageUrl(result.driver);
  }

  if (result.car) {
    result.car = withImageUrl(result.car);
  }

  if (result.track) {
    result.track = withImageUrl(result.track);
  }

  if (result.team?.img) {
    result.team = { ...result.team, img: addImageUrl(result.team.img) };
  }

  if (result.drivers) {
    result.drivers = result.drivers.map(d => {
      if (d.driver) {
        return { ...d, driver: withImageUrl(d.driver) };
      }
      return withImageUrl(d);
    });
  }

  return result;
}
