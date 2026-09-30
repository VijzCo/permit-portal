import { expect, test, type Page } from "@playwright/test";

/**
 * Happy path on seeded emulator data (npm run seed):
 * admin signs in → dashboard → employee → renew work permit → history kept →
 * dashboard updates; RW Design HR cannot see other companies.
 */
const PASSWORD = "Demo#12345";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /Demo Admin|HR RW Design/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test("admin renews an expiring work permit and the dashboard updates", async ({ page }) => {
  await signIn(page, "admin@demo.local");

  const actionTable = page.getByTestId("action-table");
  await expect(actionTable).toBeVisible();
  const rajeshRow = actionTable.getByRole("row", { name: /Rajesh Kumar/ });
  await expect(rajeshRow).toHaveCount(1);
  const badge = page.getByTestId("action-badge");
  const before = Number(await badge.textContent());

  await rajeshRow.getByRole("link", { name: "Rajesh Kumar" }).click();
  await expect(page.getByRole("heading", { name: "Rajesh Kumar" })).toBeVisible();

  const wpCard = page.getByTestId("card-WORK_PERMIT");
  await expect(wpCard.getByText("Expiring")).toBeVisible();
  await wpCard.getByRole("button", { name: "Renew" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reference number").fill("WP-RWD-001-C");
  await dialog.getByRole("button", { name: "Renew" }).click();
  await expect(dialog).toBeHidden();

  await expect(wpCard.getByText("Valid")).toBeVisible();
  const history = page.getByTestId("history-WORK_PERMIT");
  await expect(history.getByText("WP-RWD-001-C")).toBeVisible();
  await expect(history.getByText("WP-RWD-001-B")).toBeVisible();
  await expect(history.getByText("WP-RWD-001-A")).toBeVisible();
  await expect(history.getByText("Superseded")).toHaveCount(2);

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("action-table").getByRole("row", { name: /Rajesh Kumar.*Work Permit/ })).toHaveCount(0);
  await expect(page.getByTestId("action-badge")).toHaveText(String(before - 1));

  await signOut(page);
});

test("RW Design HR only sees RW Design", async ({ page }) => {
  await signIn(page, "hr.rwd@demo.local");
  await page.getByRole("link", { name: "Employees" }).click();
  const table = page.getByTestId("employee-table");
  await expect(table.getByText("Li Wei")).toBeVisible();
  await expect(table.getByText("Tendai Moyo")).toHaveCount(0);
  await expect(table.getByText("Farhan Rahman")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.goto("/employees/emp-005"); // DFS employee
  await expect(page.getByText("Cannot open employee")).toBeVisible();
});
