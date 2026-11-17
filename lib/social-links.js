const socialPlatforms = /** @type {const} */ (["instagram", "facebook", "youtube", "tiktok"]);
/** @typedef {typeof socialPlatforms[number]} SocialPlatform */
/** @typedef {Partial<Record<SocialPlatform, string>>} SocialLinks */

const socialProfiles = {
  instagram: {
    label: "Instagram",
    host: "instagram.com",
    example: "https://www.instagram.com/yourstore/",
    path: /^\/(?!(?:p|reel|reels|stories|explore|accounts)(?:\/|$))([a-z0-9._]{1,30})\/?$/i,
  },
  facebook: {
    label: "Facebook",
    host: "facebook.com",
    example: "https://www.facebook.com/yourstore/",
    path: /^\/(?:(?:people|pages)\/[a-z0-9._-]+\/\d+|(?!(?:share|watch|groups|reel|login|help)\/?$)(?![^/]*\.php\/?$)[a-z0-9.]+)\/?$/i,
  },
  youtube: {
    label: "YouTube",
    host: "youtube.com",
    example: "https://www.youtube.com/@yourstore",
    path: /^\/(?:@[^/]+|(?:channel|c|user)\/[a-z0-9._-]+)\/?$/i,
  },
  tiktok: {
    label: "TikTok",
    host: "tiktok.com",
    example: "https://www.tiktok.com/@yourstore",
    path: /^\/@[a-z0-9._]+\/?$/i,
  },
};

/** @param {SocialPlatform} platform @param {unknown} value */
function profileUrl(platform, value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const profile = socialProfiles[platform];
  const isPlatformHost = [profile.host, `www.${profile.host}`, `m.${profile.host}`].includes(url.hostname)
    || (platform === "facebook" && url.hostname === "web.facebook.com");
  if (url.protocol !== "https:" || url.username || url.password || url.port || !isPlatformHost) {
    return null;
  }
  const facebookId = platform === "facebook" && url.pathname === "/profile.php"
    ? url.searchParams.get("id")
    : null;
  if (platform === "facebook" && url.pathname === "/profile.php") {
    if (!facebookId || !/^\d+$/.test(facebookId)) return null;
  } else if (!profile.path.test(url.pathname)) {
    return null;
  }
  url.search = "";
  if (facebookId) url.searchParams.set("id", facebookId);
  url.hash = "";
  return url.href;
}

/** @param {unknown} input @returns {SocialLinks} */
function parseSocialLinks(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    Object.keys(input).some((key) => !Object.hasOwn(socialProfiles, key))) {
    throw new TypeError("Enter supported social profile links.");
  }
  const links = {};
  const values = /** @type {Record<string, unknown>} */ (input);
  for (const platform of socialPlatforms) {
    const value = values[platform];
    if (value === undefined || (typeof value === "string" && !value.trim())) continue;
    const url = profileUrl(platform, value);
    if (!url) throw new TypeError(`Enter a valid HTTPS ${socialProfiles[platform].label} profile link.`);
    Object.assign(links, { [platform]: url });
  }
  return links;
}

module.exports = { socialPlatforms, socialProfiles, parseSocialLinks };
