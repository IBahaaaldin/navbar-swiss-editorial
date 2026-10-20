const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

(async () => {
  const dir = __dirname;
  const fileUrl = 'file://' + path.join(dir, 'index.html');
  const tempDir = path.join(dir, '.temp_record');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=metal']
  });

  const injectCursor = async (page) => {
    await page.addStyleTag({
      content: `
        .custom-cursor {
          position: fixed;
          top: 0; left: 0;
          width: 20px; height: 20px;
          border-radius: 50%;
          background: rgba(255, 59, 48, 0.45);
          border: 2px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 0 14px rgba(255, 59, 48, 0.8);
          pointer-events: none;
          z-index: 999999;
          transform: translate(-50%, -50%);
          transition: transform 0.08s ease;
        }
        .custom-cursor.clicking {
          transform: translate(-50%, -50%) scale(0.75);
          background: rgba(255, 59, 48, 0.9);
        }
      `
    });
    await page.evaluate(() => {
      const cursor = document.createElement('div');
      cursor.className = 'custom-cursor';
      document.body.appendChild(cursor);
      window.addEventListener('mousemove', e => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
      window.addEventListener('mousedown', () => cursor.classList.add('clicking'));
      window.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
    });
  };

  // ==========================================
  // 1. DESKTOP RECORDING (1200x900)
  // ==========================================
  console.log('--- [11] Recording Desktop Version ---');
  const desktopVideoDir = path.join(tempDir, 'desktop');
  fs.mkdirSync(desktopVideoDir);

  const desktopContext = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: desktopVideoDir, size: { width: 1200, height: 900 } }
  });

  const dPage = await desktopContext.newPage();
  await dPage.goto(fileUrl, { waitUntil: 'load' });
  await dPage.waitForTimeout(600);

  // Take Desktop Screenshot (2400x1800 @ 2x)
  await dPage.screenshot({ path: path.join(dir, 'screenshot-desktop.png') });
  console.log('Saved screenshot-desktop.png');

  await injectCursor(dPage);
  await dPage.mouse.move(600, 450);
  await dPage.waitForTimeout(400);

  // Hover over ticker
  await dPage.mouse.move(600, 415, { steps: 10 });
  await dPage.waitForTimeout(400);

  // Tab Navigation Clicks
  const tabSelectors = [
    'button[data-tab="catalog"]',
    'button[data-tab="editions"]',
    'button[data-tab="archive"]',
    'button[data-tab="manifesto"]'
  ];

  for (const sel of tabSelectors) {
    const tab = await dPage.$(sel);
    if (tab) {
      const box = await tab.boundingBox();
      if (box) {
        await dPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
        await dPage.waitForTimeout(200);
        await dPage.mouse.down();
        await dPage.waitForTimeout(100);
        await dPage.mouse.up();
        await dPage.waitForTimeout(450);
      }
    }
  }

  // Click Index Accordion Toggle
  const indexBtn = await dPage.$('#indexToggleBtn');
  if (indexBtn) {
    const box = await indexBtn.boundingBox();
    if (box) {
      await dPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
      await dPage.waitForTimeout(200);
      await dPage.mouse.down();
      await dPage.waitForTimeout(100);
      await dPage.mouse.up();
      await dPage.waitForTimeout(800); // Index drawer open
    }
  }

  // Click Inquire ("Connect")
  const inquireBtn = await dPage.$('#inquireBtn');
  if (inquireBtn) {
    const box = await inquireBtn.boundingBox();
    if (box) {
      await dPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
      await dPage.waitForTimeout(200);
      await dPage.mouse.down();
      await dPage.waitForTimeout(120);
      await dPage.mouse.up();
      await dPage.waitForTimeout(1000); // Show "COPIED! ✨"
    }
  }

  // Toggle Theme (Switch to Stark White Gallery)
  const themeBtn = await dPage.$('#themeToggleBtn');
  if (themeBtn) {
    const tBox = await themeBtn.boundingBox();
    if (tBox) {
      await dPage.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 14 });
      await dPage.waitForTimeout(200);
      await dPage.mouse.down();
      await dPage.waitForTimeout(100);
      await dPage.mouse.up();
      await dPage.waitForTimeout(800); // White gallery mode
    }
  }

  // Switch back to Dark Mode
  if (themeBtn) {
    const tBox = await themeBtn.boundingBox();
    if (tBox) {
      await dPage.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 12 });
      await dPage.mouse.down();
      await dPage.waitForTimeout(100);
      await dPage.mouse.up();
      await dPage.waitForTimeout(600);
    }
  }

  await dPage.close();
  await desktopContext.close();

  // Convert desktop video
  const dVideos = fs.readdirSync(desktopVideoDir).filter(f => f.endsWith('.webm'));
  if (dVideos.length > 0) {
    execSync(`ffmpeg -y -i "${path.join(desktopVideoDir, dVideos[0])}" -c:v libx264 -pix_fmt yuv420p -r 30 -b:v 3M "${path.join(dir, 'video-desktop.mp4')}"`);
    console.log('Saved video-desktop.mp4');
  }

  // ==========================================
  // 2. MOBILE RECORDING (390x844)
  // ==========================================
  console.log('--- [11] Recording Mobile Version ---');
  const mobileVideoDir = path.join(tempDir, 'mobile');
  fs.mkdirSync(mobileVideoDir);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: mobileVideoDir, size: { width: 390, height: 844 } }
  });

  const mPage = await mobileContext.newPage();
  await mPage.goto(fileUrl, { waitUntil: 'load' });
  await mPage.waitForTimeout(600);

  // Take Mobile Screenshot (780x1688 @ 2x)
  await mPage.screenshot({ path: path.join(dir, 'screenshot-mobile.png') });
  console.log('Saved screenshot-mobile.png');

  await injectCursor(mPage);
  await mPage.mouse.move(195, 300);
  await mPage.waitForTimeout(400);

  // Open Mobile Sidebar Sheet
  const mMenuBtn = await mPage.$('#mobileMenuOpenBtn');
  if (mMenuBtn) {
    const box = await mMenuBtn.boundingBox();
    if (box) {
      await mPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
      await mPage.waitForTimeout(200);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(800); // Sidebar opened
    }
  }

  // Tap mobile tab inside sheet
  const mTabs = await mPage.$$('.mobile-tab-btn');
  if (mTabs.length > 1) {
    const tBox = await mTabs[1].boundingBox();
    if (tBox) {
      await mPage.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 12 });
      await mPage.waitForTimeout(150);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(600);
    }
  }

  // Tap close sidebar button
  const mCloseBtn = await mPage.$('#mobileMenuCloseBtn');
  if (mCloseBtn) {
    const cBox = await mCloseBtn.boundingBox();
    if (cBox) {
      await mPage.mouse.move(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2, { steps: 12 });
      await mPage.waitForTimeout(150);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(700);
    }
  }

  await mPage.close();
  await mobileContext.close();
  await browser.close();

  // Convert mobile video
  const mVideos = fs.readdirSync(mobileVideoDir).filter(f => f.endsWith('.webm'));
  if (mVideos.length > 0) {
    execSync(`ffmpeg -y -i "${path.join(mobileVideoDir, mVideos[0])}" -c:v libx264 -pix_fmt yuv420p -r 30 -b:v 2M "${path.join(dir, 'video-mobile.mp4')}"`);
    console.log('Saved video-mobile.mp4');
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('11 Desktop & Mobile assets recorded successfully!');
})();
