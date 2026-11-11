export default async function (page) {
  await page.click('#btnBegin');
  await page.mouse.move(600, 450);
  await page.waitForTimeout(2500);
}
