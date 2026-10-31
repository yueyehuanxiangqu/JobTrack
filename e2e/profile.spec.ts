import { test, expect } from "./fixtures";

test("legacy files remain accessible without global creation or editing controls", async ({ page }) => {
  await page.goto("/dashboard/profile");
  await expect(page.getByText("Legacy Files", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/existing library is preserved/)).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true })).toHaveCount(0);
  await expect(page.getByText("Add New Resume", { exact: true })).toHaveCount(0);
});
