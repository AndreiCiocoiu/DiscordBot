// A discord-player extractor backed by yt-dlp instead of a JS-based scraper.
//
// yt-dlp is a large, very actively maintained project (near-daily updates)
// specifically because YouTube keeps changing things — when YouTube breaks
// something, yt-dlp typically ships a fix within hours to days. That makes
// it far more reliable long-term than smaller JS libraries that scrape or
// reverse-engineer YouTube's player directly.

const { BaseExtractor, Track } = require('discord-player');
const youtubedl = require('youtube-dl-exec');

const COMMON_FLAGS = {
  noWarnings: true,
  noCheckCertificates: true,
  preferFreeFormats: true,
  addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
};

class YtDlpExtractor extends BaseExtractor {
  static identifier = 'ytdlp-extractor';

  async activate() {
    this.protocols = ['ytsearch', 'youtube'];
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
      info = await youtubedl(target, { ...COMMON_FLAGS, dumpSingleJson: true, noPlaylist: true });
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
      { ...COMMON_FLAGS, output: '-', format: 'bestaudio', noPlaylist: true },
      { stdio: ['ignore', 'pipe', 'ignore'] }
    );

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
