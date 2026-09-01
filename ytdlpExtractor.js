// A discord-player extractor backed by yt-dlp instead of a JS-based scraper.
//
// yt-dlp is a large, very actively maintained project (near-daily updates)
// specifically because YouTube keeps changing things — when YouTube breaks
// something, yt-dlp typically ships a fix within hours to days. That makes
// it far more reliable long-term than smaller JS libraries that scrape or
// reverse-engineer YouTube's player directly.

const { BaseExtractor, Track } = require('discord-player');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const os = require('os');
const path = require('path');

// If present, a manually-uploaded Netscape-format cookies.txt file on the
// persistent data volume takes priority.
const UPLOADED_COOKIES_PATH = path.join(__dirname, '..', '..', 'data', 'youtube-cookies.txt');
// Otherwise, cookies are generated at boot from the YOUTUBE_COOKIE env var
// (much easier to set in Railway than uploading a file) into a temp file,
// since yt-dlp's --cookies flag needs an actual file path either way.
const GENERATED_COOKIES_PATH = path.join(os.tmpdir(), 'youtube-cookies-generated.txt');

// Converts a browser "header string" cookie export (name1=value1; name2=value2; ...)
// into the Netscape cookies.txt format yt-dlp actually requires.
function headerStringToNetscape(headerString) {
  const lines = ['# Netscape HTTP Cookie File'];
  // A far-future expiration — 0 means "expired in 1970" in this format,
  // which caused every cookie to be silently dropped as already-expired.
  const farFutureExpiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 2; // +2 years
  const pairs = headerString.split(';').map((s) => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!name) continue;
    lines.push(['.youtube.com', 'TRUE', '/', 'TRUE', String(farFutureExpiry), name, value].join('\t'));
  }
  return lines.join('\n') + '\n';
}

// Resolves the cookies file to use, generating one from YOUTUBE_COOKIE the
// first time it's needed. Returns null if no cookies are configured at all.
let resolvedCookiesPath;
function getCookiesPath() {
  if (resolvedCookiesPath !== undefined) return resolvedCookiesPath;

  if (fs.existsSync(UPLOADED_COOKIES_PATH)) {
    resolvedCookiesPath = UPLOADED_COOKIES_PATH;
    return resolvedCookiesPath;
  }

  const raw = process.env.YOUTUBE_COOKIE;
  if (raw && raw.trim()) {
    // Already in Netscape format (starts with the standard header, or has
    // tab-separated fields) — use as-is. Otherwise assume it's a browser
    // "header string" export and convert it.
    const looksNetscape = raw.includes('# Netscape') || raw.includes('\t');
    const content = looksNetscape ? raw : headerStringToNetscape(raw);
    fs.writeFileSync(GENERATED_COOKIES_PATH, content);
    resolvedCookiesPath = GENERATED_COOKIES_PATH;
    return resolvedCookiesPath;
  }

  resolvedCookiesPath = null;
  return resolvedCookiesPath;
}

function getCommonFlags() {
  const cookiesPath = getCookiesPath();
  return {
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
    // "tv" client currently gets lighter bot-detection scrutiny than the
    // default "web" client and needs no extra token (unlike "android",
    // which was tried here before and made things worse — it requires a
    // separate PO token setup). Falls back to web if tv doesn't work for a
    // given video. This helps, but won't eliminate YouTube's bot-detection
    // being fundamentally inconsistent request-to-request — see README.
    extractorArgs: 'youtube:player_client=tv,web',
    ...(cookiesPath ? { cookies: cookiesPath } : {}),
    // Optional residential proxy — addresses the actual root cause (Railway's
    // shared datacenter IPs getting flagged) rather than working around the
    // symptom. Format: http://username:password@host:port
    ...(process.env.YT_PROXY ? { proxy: process.env.YT_PROXY } : {}),
  };
}

class YtDlpExtractor extends BaseExtractor {
  static identifier = 'ytdlp-extractor';

  async activate() {
    this.protocols = ['ytsearch', 'youtube'];
    const cookiesPath = getCookiesPath();
    if (cookiesPath) {
      console.log(`[ytdlp-extractor] Using YouTube cookies (${cookiesPath}).`);
    } else {
      console.log('[ytdlp-extractor] No YouTube cookies configured — running anonymously (more likely to hit "Sign in to confirm" errors). Set the YOUTUBE_COOKIE env var to fix this.');
    }

    if (process.env.YT_PROXY) {
      // Don't log the full value — it contains a password.
      const masked = process.env.YT_PROXY.replace(/:([^:@]+)@/, ':****@');
      console.log(`[ytdlp-extractor] Using proxy (${masked}).`);
    } else {
      console.log('[ytdlp-extractor] No YT_PROXY configured — requests go through this server\'s own IP.');
    }
  }

  async validate(query) {
    // This is the bot's only music source, so accept anything — plain
    // search text or a URL.
    return typeof query === 'string' && query.trim().length > 0;
  }

  async handle(query, context) {
    const isUrl = /^https?:\/\//i.test(query);
    const target = isUrl ? query : `ytsearch1:${query}`;

    let info;
    try {
      info = await youtubedl(target, { ...getCommonFlags(), dumpSingleJson: true, noPlaylist: true });
    } catch (err) {
      console.error(`[ytdlp-extractor] yt-dlp lookup failed for "${query}":`, err.stderr || err.message || err);
      return this.createResponse(null, []);
    }

    const video = info?.entries?.[0] ?? info;
    if (!video?.id) return this.createResponse(null, []);

    const track = new Track(this.context.player, {
      title: video.title ?? 'Unknown title',
      url: video.webpage_url || `https://www.youtube.com/watch?v=${video.id}`,
      duration: video.duration_string ?? '0:00',
      thumbnail: video.thumbnail ?? '',
      author: video.uploader ?? 'YouTube',
      requestedBy: context.requestedBy,
      source: 'youtube',
      queryType: 'youtubeVideo',
      metadata: video,
      requestMetadata: async () => video,
    });

    return this.createResponse(null, [track]);
  }

  // Streams audio by spawning yt-dlp with output piped straight to stdout —
  // discord-player then transcodes that with ffmpeg (already a dependency).
  async stream(info) {
    const subprocess = youtubedl.exec(
      info.url,
      { ...getCommonFlags(), output: '-', format: 'bestaudio', noPlaylist: true },
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    // youtube-dl-exec's return value is both the child process AND a
    // promise that rejects on a non-zero exit code. We use the streams
    // directly, but we must still handle that rejection — otherwise a
    // failed/killed process crashes the bot with an unhandled rejection,
    // and previously we were also discarding stderr entirely, which meant
    // failures gave zero information about what actually went wrong.
    let stderrOutput = '';
    subprocess.stderr?.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });

    subprocess.catch((err) => {
      console.error(
        `[ytdlp-extractor] yt-dlp stream failed for "${info.url}":`,
        stderrOutput.trim() || err.shortMessage || err.message
      );
    });

    subprocess.stdout.once('close', () => {
      if (!subprocess.killed) subprocess.kill();
    });

    return subprocess.stdout;
  }

  async getRelatedTracks() {
    return this.createResponse(null, []);
  }
}

module.exports = { YtDlpExtractor };
