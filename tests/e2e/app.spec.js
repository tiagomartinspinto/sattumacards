/* global document */

const { expect, test } = require("@playwright/test");

async function createRoom(page) {
  await page.goto("/?lang=en");
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.locator("#gameBoardShell")).toBeVisible();
  await expect(page.locator("#roomCodeDisplay")).not.toHaveText("...");
  return (await page.locator("#roomCodeDisplay").textContent()).trim();
}

async function placeAndFlipSituationCard(page) {
  await page.locator("#card-situation-8").dragTo(page.locator("#dropzone-situation"));
  await page.locator("#dropzone-situation .card").click();
}

function acceptNextDialog(page) {
  page.once("dialog", (dialog) => dialog.accept());
}

test("landing screen logo is visually dominant before the room starts", async ({
  page,
}) => {
  await page.goto("/?lang=en");

  const landingLogo = page.locator(".landing-logo");
  await expect(landingLogo).toBeVisible();
  const landingLogoBox = await landingLogo.boundingBox();

  expect(landingLogoBox?.width ?? 0).toBeGreaterThan(320);
});

test("board logo stays clear of the lifted deck cards on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await createRoom(page);

  const titleBox = await page.locator(".title").boundingBox();
  const deckContainerBox = await page.locator(".deck-container").boundingBox();

  expect(titleBox).toBeTruthy();
  expect(deckContainerBox).toBeTruthy();
  const titleBottom = titleBox.y + titleBox.height;
  const deckTop = deckContainerBox.y;

  expect(deckTop - titleBottom).toBeGreaterThanOrEqual(8);
});

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

test("leave room returns cleanly to the landing screen and clears room params", async ({
  page,
}) => {
  await createRoom(page);
  acceptNextDialog(page);
  await page.getByRole("button", { name: "Leave room" }).click();

  await expect(page.locator("#landingScreen")).toBeVisible();
  await expect(page.locator("#gameBoardShell")).toBeHidden();
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return `${url.searchParams.has("room")}|${url.searchParams.has("create")}`;
    })
    .toBe("false|false");
});

test("host can close the room for everyone and both pages return to the landing screen", async ({
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
  await guestPage.getByLabel("Room code").fill(roomCode);
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(hostPage.getByRole("button", { name: "Close room" })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Close room" })).toBeHidden();

  acceptNextDialog(hostPage);
  await hostPage.getByRole("button", { name: "Close room" }).click();

  await expect(hostPage.locator("#landingScreen")).toBeVisible();
  await expect(guestPage.locator("#landingScreen")).toBeVisible();
  await expect(hostPage.locator("#gameNotice")).toContainText("Room closed.");
  await expect(guestPage.locator("#gameNotice")).toContainText("Room closed.");
  await expect
    .poll(() => {
      const hostUrl = new URL(hostPage.url());
      const guestUrl = new URL(guestPage.url());
      return [
        hostUrl.searchParams.has("room"),
        hostUrl.searchParams.has("create"),
        guestUrl.searchParams.has("room"),
        guestUrl.searchParams.has("create"),
      ].join("|");
    })
    .toBe("false|false|false|false");

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
  await menuButton.press("Enter");
  await expect(page.locator("#menuContent")).toBeVisible();
  await modalTrigger.focus();
  await modalTrigger.press("Enter");

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
