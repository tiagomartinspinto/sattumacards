/* global document */

const { expect, test } = require("@playwright/test");

async function createRoom(page) {
  await page.goto("/?lang=en");
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.locator("#gameBoardShell")).toBeVisible();
  await expect(page.locator("#roomCodeDisplay")).not.toHaveText("...");
  return page.locator("#roomCodeDisplay").textContent();
}

async function placeAndFlipSituationCard(page) {
  await page.locator("#card-situation-8").dragTo(page.locator("#dropzone-situation"));
  await page.locator("#dropzone-situation .card").click();
}

test("host can create a room and a guest can join and follow card movement", async ({
  browser,
}) => {
  const hostContext = await browser.newContext({
    viewport: { height: 900, width: 1400 },
  });
  const guestContext = await browser.newContext({
    viewport: { height: 900, width: 1400 },
  });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  const roomCode = await createRoom(hostPage);
  await guestPage.goto("/?lang=en");
  await guestPage.getByLabel("Room code").fill(roomCode.trim());
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(guestPage.locator("#roomCodeDisplay")).toHaveText(roomCode);
  await placeAndFlipSituationCard(hostPage);

  await expect(guestPage.locator("#dropzone-situation .card")).toBeVisible();
  await expect(guestPage.locator("#dropzone-situation .card")).toHaveClass(/flip/);

  await hostContext.close();
  await guestContext.close();
});

test("modal keyboard flow traps focus and Escape returns focus to the trigger", async ({
  page,
}) => {
  await page.goto("/?lang=en");

  const menuButton = page.locator(".menu-icon");
  const modalTrigger = page.locator('[data-modal-target="instructionsModal"]');
  const modalCloseButton = page.locator("#instructionsModal .close");

  await menuButton.focus();
  await page.keyboard.press("Enter");
  await modalTrigger.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#instructionsModal")).toBeVisible();
  await expect(modalCloseButton).toBeFocused();

  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.getElementById("instructionsModal")?.contains(document.activeElement)
        )
      )
      .toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(page.locator("#instructionsModal")).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test("reloading the same browser session resumes the room and mobile observer mode follows it", async ({
  browser,
}) => {
  const hostContext = await browser.newContext({
    viewport: { height: 900, width: 1400 },
  });
  const observerContext = await browser.newContext({
    viewport: { height: 844, width: 390 },
  });
  const hostPage = await hostContext.newPage();
  const observerPage = await observerContext.newPage();

  const roomCode = await createRoom(hostPage);

  await hostPage.reload();
  await expect(hostPage.locator("#gameNotice")).toContainText("Back in the room.");
  await expect(hostPage.locator("#roomCodeDisplay")).toHaveText(roomCode);

  await observerPage.goto(`/?room=${roomCode.trim()}&lang=en`);
  await expect(observerPage.locator("#mobileObserverPanel")).toBeVisible();
  await expect(observerPage.locator("#mobileObserverRoomCode")).toHaveText(roomCode);

  await placeAndFlipSituationCard(hostPage);
  await expect(
    observerPage.locator("#mobileObserverCards .mobile-observer-card")
  ).toHaveCount(1);
  await expect(observerPage.locator("#mobileObserverCards")).toContainText("Situation");

  await hostContext.close();
  await observerContext.close();
});
