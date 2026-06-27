import { test, expect } from "@playwright/test";

const stamp = Date.now();
const password = "Password123!";

async function registerAndLogin(page, email, username) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();

  await page.getByRole("button", { name: "register" }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="bday"]').fill("1995-05-07");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Account created")).toBeVisible();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Rooms" })).toBeVisible();
}

test("live users can create, join, connect, and send messages", async ({ browser }) => {
  const roomName = `playwright-room-${stamp}`;
  const ownerMessage = `owner message ${stamp}`;
  const joinerMessage = `joiner message ${stamp}`;

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await registerAndLogin(owner, `owner-${stamp}@example.com`, `owner${stamp}`);

  await owner.getByPlaceholder("New room").fill(roomName);
  await owner.getByRole("button", { name: "Add" }).click();
  await expect(owner.getByRole("heading", { name: roomName }).first()).toBeVisible();
  await expect(owner.getByText("Connected").first()).toBeVisible({ timeout: 10000 });

  await owner.getByPlaceholder("Message this room").fill(ownerMessage);
  await owner.getByRole("button", { name: "Send message" }).click();
  await expect(owner.getByText(ownerMessage)).toBeVisible({ timeout: 10000 });
  await expect(owner.getByText("Failed")).toHaveCount(0);

  const joinerContext = await browser.newContext();
  const joiner = await joinerContext.newPage();
  await registerAndLogin(joiner, `joiner-${stamp}@example.com`, `joiner${stamp}`);

  await joiner.getByRole("button", { name: new RegExp(roomName) }).first().click();
  await expect(joiner.getByPlaceholder("Join this room to send")).toBeVisible();
  await joiner.getByRole("button", { name: "Join" }).click();
  await expect(joiner.getByRole("button", { name: "Joined" })).toBeVisible();
  await expect(joiner.getByText("Connected").first()).toBeVisible({ timeout: 10000 });

  await joiner.getByPlaceholder("Message this room").fill(joinerMessage);
  await joiner.getByRole("button", { name: "Send message" }).click();
  await expect(joiner.getByText(joinerMessage)).toBeVisible({ timeout: 10000 });
  await expect(joiner.getByText("Failed")).toHaveCount(0);

  await ownerContext.close();
  await joinerContext.close();
});

test("live user search can start a direct chat and send a message", async ({ browser }) => {
  const directStamp = `${stamp}-direct`;
  const searcherUsername = `searcher${directStamp}`;
  const targetUsername = `target${directStamp}`;
  const directMessage = `direct hello ${directStamp}`;

  const targetContext = await browser.newContext();
  const target = await targetContext.newPage();
  await registerAndLogin(target, `target-${directStamp}@example.com`, targetUsername);
  await targetContext.close();

  const searcherContext = await browser.newContext();
  const searcher = await searcherContext.newPage();
  await registerAndLogin(searcher, `searcher-${directStamp}@example.com`, searcherUsername);

  await searcher.getByRole("button", { name: "People" }).click();
  await searcher.getByPlaceholder("Search username").fill(targetUsername);
  await searcher.getByRole("button", { name: "Search" }).click();
  await expect(searcher.getByText(targetUsername).first()).toBeVisible({ timeout: 10000 });

  await searcher.getByRole("button", { name: "Chat" }).click();
  await expect(searcher.getByText("Connected").first()).toBeVisible({ timeout: 10000 });
  await searcher.getByPlaceholder("Message this room").fill(directMessage);
  await searcher.getByRole("button", { name: "Send message" }).click();
  await expect(searcher.getByText(directMessage)).toBeVisible({ timeout: 10000 });
  await expect(searcher.getByText("Failed")).toHaveCount(0);

  await searcherContext.close();
});
