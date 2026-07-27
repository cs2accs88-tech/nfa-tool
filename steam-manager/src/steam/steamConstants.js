/**
 * @module steamConstants
 * @description Centralized constants for the Steam Profile Link Management System.
 * Contains URL patterns, validation rules, allowed domains, and configuration values.
 */

/** Base URL for Steam Community */
const STEAM_COMMUNITY_BASE = 'https://steamcommunity.com';

/** URL path for SteamID64-based profiles */
const STEAM_PROFILE_PATH = '/profiles/';

/** URL path for custom vanity URL profiles */
const STEAM_CUSTOM_PATH = '/id/';

/** Full URL prefix for SteamID64-based profiles */
const STEAM_PROFILE_URL_PREFIX = `${STEAM_COMMUNITY_BASE}${STEAM_PROFILE_PATH}`;

/** Full URL prefix for custom vanity URL profiles */
const STEAM_CUSTOM_URL_PREFIX = `${STEAM_COMMUNITY_BASE}${STEAM_CUSTOM_PATH}`;

/** Allowed hostname for Steam profile URLs */
const ALLOWED_HOSTNAME = 'steamcommunity.com';

/** Allowed hostnames including www variant */
const ALLOWED_HOSTNAMES = new Set([
  'steamcommunity.com',
  'www.steamcommunity.com'
]);

/** Only HTTPS protocol is allowed */
const ALLOWED_PROTOCOL = 'https:';

/** Blocked protocols that must be rejected */
const BLOCKED_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'file:',
  'ftp:',
  'blob:',
  'vbscript:'
]);

/** Regex pattern for valid SteamID64 (17 digits) */
const STEAM_ID64_REGEX = /^\d{17}$/;

/** SteamID64 minimum value (first valid Steam account) */
const STEAM_ID64_MIN = BigInt('76561197960265728');

/** SteamID64 maximum value (reasonable upper bound) */
const STEAM_ID64_MAX = BigInt('76561202255233023');

/** Regex for valid custom URL slugs (alphanumeric, underscores, hyphens) */
const CUSTOM_URL_SLUG_REGEX = /^[a-zA-Z0-9_-]{2,32}$/;

/** Allowed path prefixes for Steam profile URLs */
const ALLOWED_PATHS = [STEAM_PROFILE_PATH, STEAM_CUSTOM_PATH];

/** Profile URL types */
const PROFILE_URL_TYPES = Object.freeze({
  STEAM_ID64: 'steamid64',
  CUSTOM: 'custom',
  UNKNOWN: 'unknown'
});

/** Profile validation statuses */
const VALIDATION_STATUS = Object.freeze({
  VALID: 'valid',
  INVALID: 'invalid',
  PENDING: 'pending',
  UNCHECKED: 'unchecked'
});

/** Profile history action types */
const HISTORY_ACTIONS = Object.freeze({
  CREATED: 'created',
  UPDATED: 'updated',
  VALIDATED: 'validated',
  DELETED: 'deleted'
});

/** IP address detection patterns */
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^\[?([a-fA-F0-9:]+)\]?$/;

/** Localhost patterns to reject */
const LOCALHOST_PATTERNS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]'
]);

module.exports = {
  STEAM_COMMUNITY_BASE,
  STEAM_PROFILE_PATH,
  STEAM_CUSTOM_PATH,
  STEAM_PROFILE_URL_PREFIX,
  STEAM_CUSTOM_URL_PREFIX,
  ALLOWED_HOSTNAME,
  ALLOWED_HOSTNAMES,
  ALLOWED_PROTOCOL,
  BLOCKED_PROTOCOLS,
  STEAM_ID64_REGEX,
  STEAM_ID64_MIN,
  STEAM_ID64_MAX,
  CUSTOM_URL_SLUG_REGEX,
  ALLOWED_PATHS,
  PROFILE_URL_TYPES,
  VALIDATION_STATUS,
  HISTORY_ACTIONS,
  IPV4_REGEX,
  IPV6_REGEX,
  LOCALHOST_PATTERNS
};
