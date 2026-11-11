export default async function (page) {
  await page.click('#btnBegin');
  await page.evaluate(() => { window.__simPause = true; });
  const box = await page.locator('#ov').boundingBox();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.evaluate(() => { const s = window.__sim; for (let i = 0; i < 60; i++) s.tick(0.033); s.S.labels = true; for (let i = 0; i < 30; i++) s.tick(0.033); s.render(); });
  await page.waitForTimeout(300);
}
