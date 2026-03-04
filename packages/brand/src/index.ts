/**
 * @mimi/brand — White-label distribution system.
 *
 * Depends on: @mimi/core
 */

export { BrandLoader, DEFAULT_BRAND } from './loader.js';
export { brandConfigSchema, validateBrandConfig } from './schema.js';
export type { ValidatedBrandConfig } from './schema.js';
export type {
  BrandConfig,
  BrandPromptConfig,
  BrandThemeConfig,
  BrandPermissionConfig,
} from './types.js';

export {
  banner,
  bannerPlain,
  promptIcon,
  promptIconPlain,
  faceSuccess,
  faceError,
  faceWarning,
  faceWaiting,
  spinnerFrames,
  parrotLarge,
  goodbye,
  welcomeBack,
} from './banner.js';
