import { expect, test } from "@playwright/test";

test("auth page opens without demo entry points", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByRole("heading", { name: "Real-Time Chat" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: /demo/i })).toHaveCount(0);
});

test("register form keeps required account fields", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "register" }).click();

  await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
  await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
  await expect(page.locator('input[autocomplete="bday"]')).toBeVisible();
  await expect(page.locator('input[autocomplete="new-password"]')).toBeVisible();
});

test("authenticated shell shows joined-room empty state when no room API is available", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("chat.session", JSON.stringify({
      tokens: {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
      },
      user: {
        id: "test-user",
        email: "user@example.com",
        username: "user",
      },
    }));
  });
  await page.reload();

  await expect(page.getByText("Secure workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rooms" })).toBeVisible();
  await expect(page.getByText(/Rooms unavailable|No room selected|No joined rooms yet/)).toBeVisible();
  await expect(page.getByText(/sequence/i)).toHaveCount(0);
  await expect(page.getByText(/demo/i)).toHaveCount(0);
});
