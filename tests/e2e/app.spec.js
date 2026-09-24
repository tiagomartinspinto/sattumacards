/* global document, window */

const { expect, test } = require("@playwright/test");

async function expectAppReady(page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-state", "ready");
}

async function openLanding(page) {
  await page.goto("/?lang=en");
  await expectAppReady(page);
}

// Holds every request matching `pattern` until release() is called, so a test can
// act inside the startup window deterministically instead of racing it.
async function holdStartupRequest(page, pattern) {
  let release;
  let markRequested;
  const released = new Promise((resolve) => {
    release = resolve;
  });
  const requested = new Promise((resolve) => {
    markRequested = resolve;
  });

  await page.route(pattern, async (route) => {
    markRequested();
    await released;
    await route.continue();
  });

  return { release, requested };
}

// Records which elements actually receive clicks and form submissions, so a test
// can tell "the control ignored the input" apart from "the input never reached it".
function recordUserEvents(page) {
  return page.evaluate(() => {
    window.receivedEvents = [];
    ["click", "submit"].forEach((type) => {
      document.addEventListener(
        type,
        (event) => window.receivedEvents.push(`${type}:${event.target.id || ""}`),
        true
      );
    });
  });
}

async function clickCenter(page, selector) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

function activeElementInfo(page) {
  return page.evaluate(() => ({
    tag: document.activeElement.tagName,
    insideApp: Boolean(document.activeElement.closest("[data-inert-until-ready]")),
  }));
}

async function expectStartupWindowIsInert(page) {
  await expect(page.locator("#landingScreen")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-app-state", "loading");
  await expect(page.locator("body")).toHaveAttribute("aria-busy", "true");

  await recordUserEvents(page);
  await clickCenter(page, "#createRoomBtn");
  await clickCenter(page, ".menu-icon");
  await clickCenter(page, "#languageSelector");
  await clickCenter(page, "#joinRoomCode");
  await page.keyboard.type("ABC123");
  await page.keyboard.press("Enter");
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("Tab");
  }

  const received = await page.evaluate(() => window.receivedEvents);
  expect(received.filter((entry) => entry !== "click:")).toEqual([]);
  expect(await activeElementInfo(page)).toEqual({ tag: "BODY", insideApp: false });
  await expect(page.locator("#joinRoomCode")).toHaveValue("");
  await expect(page.locator("#menuContent")).toBeHidden();
}

async function createRoom(page) {
  await openLanding(page);
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

for (const heldRequest of ["**/app-config", "**/i18n/en.json"]) {
  test(`startup held on ${heldRequest}: early input is refused, first real use works`, async ({
    browser,
  }) => {
    const host = await (await browser.newContext()).newPage();
    const hostStartup = await holdStartupRequest(host, heldRequest);
    await host.goto("/?lang=en");
    await hostStartup.requested;

    await expectStartupWindowIsInert(host);
    await expect(host).not.toHaveURL(/[?&](create|room)=/);

    hostStartup.release();
    await expectAppReady(host);
    await expect(host.locator("body")).not.toHaveAttribute("aria-busy", /.*/);
    await host.keyboard.press("Tab");
    await expect(host.locator(".menu-icon")).toBeFocused();

    await host.locator("#createRoomBtn").click();
    await expect(host.locator("#gameBoardShell")).toBeVisible();
    await expect(host.locator("#roomCodeDisplay")).not.toHaveText("...");
    const roomCode = (await host.locator("#roomCodeDisplay").textContent()).trim();

    const guest = await (await browser.newContext()).newPage();
    const guestStartup = await holdStartupRequest(guest, heldRequest);
    await guest.goto("/?lang=en");
    await guestStartup.requested;

    await expectStartupWindowIsInert(guest);

    guestStartup.release();
    await expectAppReady(guest);
    await expect(guest.locator("#joinRoomCode")).toHaveValue("");
    await guest.locator("#joinRoomCode").fill(roomCode);
    await guest.getByRole("button", { name: "Join room" }).click();
    await expect(guest.locator("#roomCodeDisplay")).toHaveText(roomCode);

    await host.context().close();
    await guest.context().close();
  });
}

test("auto-start link keeps the page inert until the board is wired", async ({
  page,
}) => {
  const startup = await holdStartupRequest(page, "**/app-config");
  await page.goto("/?create=1&lang=en");
  await startup.requested;

  await expect(page.locator("#gameBoardShell")).toBeHidden();
  await expectStartupWindowIsInert(page);

  startup.release();
  await expectAppReady(page);
  await expect(page.locator("#gameBoardShell")).toBeVisible();
  await expect(page.locator("#roomCodeDisplay")).not.toHaveText("...");
  await page.locator("#copyRoomBtn").focus();
  await expect(page.locator("#copyRoomBtn")).toBeFocused();
});

test("an unusable app config still lets the app become ready", async ({ page }) => {
  await page.route("**/app-config", (route) =>
    route.fulfill({ contentType: "application/json", body: "{not json" })
  );
  await openLanding(page);
  await page.locator("#createRoomBtn").click();
  await expect(page.locator("#gameBoardShell")).toBeVisible();
});

// Collects uncaught errors (including unhandled promise rejections) and console
// errors, so fallback tests can assert failures were logged but never thrown.
function watchPageErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  return { pageErrors, consoleErrors };
}

function failRequest(page, pattern, { status = 500, body = "" } = {}) {
  return page.route(pattern, (route) =>
    route.fulfill({ status, contentType: "application/json", body })
  );
}

const RAW_LANDING_KEYS =
  /\b(landingTitle|landingIntro|createRoomButton|joinRoomLabel|joinRoomButton|joinRoomPlaceholder|landingNote|languageSelector|menuOpen)\b/;

async function expectLandingInLanguage(page, language) {
  await expectAppReady(page);
  await expect(page.locator("body")).not.toHaveAttribute("aria-busy", /.*/);
  await expect(page.locator("#landingScreen")).not.toHaveAttribute("inert", /.*/);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(page.locator("#languageSelector")).toHaveValue(language);
  await expect(page).toHaveURL(new RegExp(`[?&]lang=${language}(&|$)`));
}

async function expectNoRawLandingKeys(page) {
  const landing = page.locator("#landingScreen");
  await expect(landing).not.toContainText(RAW_LANDING_KEYS);
  const attributes = await page.evaluate(() =>
    [...document.querySelectorAll("[placeholder], [title], [aria-label]")].flatMap(
      (element) =>
        ["placeholder", "title", "aria-label"].map((name) => element.getAttribute(name))
    )
  );
  expect(attributes.filter((value) => value && RAW_LANDING_KEYS.test(value))).toEqual([]);
}

test("a failed requested dictionary falls back to Finnish and stays usable", async ({
  page,
}) => {
  const errors = watchPageErrors(page);
  await failRequest(page, "**/i18n/en.json");
  await page.goto("/?lang=en");

  await expectLandingInLanguage(page, "fi");
  await expect(page.locator("#landingTitle")).toHaveText("Luo huone tai liity mukaan");
  await expect(page.locator("#createRoomBtn")).toHaveText("Luo huone");
  await expectNoRawLandingKeys(page);
  expect(await page.evaluate(() => localStorage.getItem("sattumaLanguage"))).toBeNull();
  expect(errors.consoleErrors.some((text) => text.includes("en translation"))).toBe(true);

  await page.locator("#createRoomBtn").click();
  await expect(page.locator("#gameBoardShell")).toBeVisible();
  expect(errors.pageErrors).toEqual([]);
});

test("a failed Finnish dictionary does not block a working requested language", async ({
  page,
}) => {
  const errors = watchPageErrors(page);
  await failRequest(page, "**/i18n/fi.json");
  await page.goto("/?lang=en");

  await expectLandingInLanguage(page, "en");
  await expect(page.locator("#landingTitle")).toHaveText("Create a room or join one");
  await expectNoRawLandingKeys(page);

  await page.locator("#createRoomBtn").click();
  await expect(page.locator("#gameBoardShell")).toBeVisible();
  expect(errors.pageErrors).toEqual([]);
});

test("with no dictionary at all the served page text stays and the app works", async ({
  page,
}) => {
  const errors = watchPageErrors(page);
  await failRequest(page, "**/i18n/fi.json");
  await failRequest(page, "**/i18n/en.json", { status: 200, body: "{not json" });
  await page.goto("/?lang=en");

  await expectLandingInLanguage(page, "fi");
  await expect(page.locator("#landingTitle")).toHaveText("Luo huone tai liity mukaan");
  await expect(page.locator("#createRoomBtn")).toHaveText("Create room");
  await expect(page.locator("#joinRoomCode")).toHaveAttribute(
    "placeholder",
    "Enter room code"
  );
  await expect(page.locator("#languageSelector")).toHaveAttribute(
    "aria-label",
    "Vaihda kieltä"
  );
  await expectNoRawLandingKeys(page);

  await page.locator("#createRoomBtn").click();
  await expect(page.locator("#gameBoardShell")).toBeVisible();
  await expectAppReady(page);
  await expect(page.locator("#roomCodeDisplay")).not.toHaveText("...");
  expect(errors.pageErrors).toEqual([]);
});

test("a failed language switch keeps the current language intact", async ({ page }) => {
  const errors = watchPageErrors(page);
  await page.goto("/?lang=fi");
  await expectLandingInLanguage(page, "fi");

  let englishRequests = 0;
  await page.route("**/i18n/en.json", (route) => {
    englishRequests += 1;
    return route.fulfill({ status: 503, body: "" });
  });
  await page.locator("#languageSelector").selectOption("en");

  await expect.poll(() => englishRequests).toBe(1);
  await expectLandingInLanguage(page, "fi");
  await expect(page.locator("#landingTitle")).toHaveText("Luo huone tai liity mukaan");
  await expect(page.locator("#createRoomBtn")).toHaveText("Luo huone");
  expect(await page.evaluate(() => localStorage.getItem("sattumaLanguage"))).toBe("fi");

  // A failure is not cached: once English is reachable the same switch succeeds,
  // and after that the cached dictionary is used without another request.
  await page.unroute("**/i18n/en.json");
  await page.locator("#languageSelector").selectOption("en");
  await expectLandingInLanguage(page, "en");
  await expect(page.locator("#landingTitle")).toHaveText("Create a room or join one");

  englishRequests = 0;
  await page.route("**/i18n/en.json", (route) => {
    englishRequests += 1;
    return route.fulfill({ status: 503, body: "" });
  });
  await page.locator("#languageSelector").selectOption("fi");
  await expectLandingInLanguage(page, "fi");
  await page.locator("#languageSelector").selectOption("en");
  await expectLandingInLanguage(page, "en");
  expect(englishRequests).toBe(0);
  expect(errors.pageErrors).toEqual([]);
});

test("a missing modal page does not block the app", async ({ page }) => {
  const errors = watchPageErrors(page);
  await page.route("**/content/en/instructions.html", (route) =>
    route.fulfill({ status: 404, body: "" })
  );
  await page.goto("/?lang=en");

  await expectLandingInLanguage(page, "en");
  await expect(page.locator("#historyContent")).not.toBeEmpty();
  await expect(page.locator("#instructionsContent")).not.toContainText(/HTTP|Error/);
  expect(errors.consoleErrors.some((text) => text.includes("instructions.html"))).toBe(
    true
  );

  await page.locator("#createRoomBtn").click();
  await expect(page.locator("#gameBoardShell")).toBeVisible();
  expect(errors.pageErrors).toEqual([]);
});

test("landing screen logo is visually dominant before the room starts", async ({
  page,
}) => {
  await openLanding(page);

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

test("current phase and turn stay in view on a projector-sized screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await createRoom(page);

  const turnHelpBox = await page.locator("#gameTurnHelp").boundingBox();

  await expect(page.locator("#gamePhaseLabel")).toHaveText("Setting the table");
  expect(turnHelpBox).toBeTruthy();
  expect(turnHelpBox.y + turnHelpBox.height).toBeLessThanOrEqual(720);
});

test("board wordmark switches to dark ink on light table themes", async ({ page }) => {
  await createRoom(page);

  const boardWordmark = page.locator(".title-image");
  const landingWordmark = page.locator(".landing-logo");
  const themeSelector = page.locator("#backgroundColorSelector");

  await expect(boardWordmark).toHaveAttribute("src", "./imgs/sattuma-wordmark.png");

  for (const theme of ["sage", "mist", "sky", "rose", "dawn"]) {
    await themeSelector.selectOption(theme);
    await expect(boardWordmark).toHaveAttribute(
      "src",
      "./imgs/sattuma-wordmark-dark.png"
    );
  }

  await themeSelector.selectOption("default");
  await expect(boardWordmark).toHaveAttribute("src", "./imgs/sattuma-wordmark.png");

  await themeSelector.selectOption("sky");
  await page.reload();
  await expect(boardWordmark).toHaveAttribute("src", "./imgs/sattuma-wordmark-dark.png");
  await expect(landingWordmark).toHaveAttribute("src", "./imgs/sattuma-wordmark.png");
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
  await openLanding(guestPage);
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
  await openLanding(guestPage);
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
  await openLanding(page);

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
