// Builds a styled "Welcome" image card: a gradient background, a decorative
// frame ring around the new member's avatar, and their name + member count.

const { createCanvas, loadImage } = require('@napi-rs/canvas');

const WIDTH = 1000;
const HEIGHT = 400;
const AVATAR_SIZE = 220;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function buildWelcomeImage(member) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // --- Background gradient ---
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#1e1f3b');
  bg.addColorStop(1, '#3a2a5d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // --- Decorative outer frame ---
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 6;
  roundRect(ctx, 16, 16, WIDTH - 32, HEIGHT - 32, 24);
  ctx.stroke();

  // --- Avatar with a glowing ring frame ---
  const avatarX = WIDTH / 2;
  const avatarY = 150;
  const avatarUrl = member.displayAvatarURL({ extension: 'png', size: 256 });

  const ringGradient = ctx.createLinearGradient(
    avatarX - AVATAR_SIZE / 2,
    avatarY - AVATAR_SIZE / 2,
    avatarX + AVATAR_SIZE / 2,
    avatarY + AVATAR_SIZE / 2
  );
  ringGradient.addColorStop(0, '#5865f2');
  ringGradient.addColorStop(1, '#ffce00');

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, AVATAR_SIZE / 2 + 10, 0, Math.PI * 2);
  ctx.fillStyle = ringGradient;
  ctx.fill();
  ctx.restore();

  try {
    const avatarImg = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      avatarImg,
      avatarX - AVATAR_SIZE / 2,
      avatarY - AVATAR_SIZE / 2,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
    ctx.restore();
  } catch {
    // If the avatar fails to load, the gradient ring alone still looks fine.
  }

  // --- "WELCOME" heading ---
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('WELCOME', avatarX, 300);

  // --- Username ---
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#c9c9f5';
  ctx.fillText(member.user.username, avatarX, 340);

  // --- Member count ---
  ctx.font = '20px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`MEMBER #${member.guild.memberCount}`, avatarX, 372);

  return canvas.toBuffer('image/png');
}

module.exports = { buildWelcomeImage };
