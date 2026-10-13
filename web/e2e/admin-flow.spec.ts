import { expect, test } from "@playwright/test";

// Runs once (desktop) against the isolated server on 3101: it loads sample
// activity and publishes a property, which would disturb the other specs.
test.use({ baseURL: "http://localhost:3101" });
test.skip(({ isMobile }) => isMobile, "Admin flow runs once, on desktop");

test("Super Admin: queue, reassignment, leave, verification, policies, waivers, refunds, credit, audit", async ({ page }) => {
  test.setTimeout(120_000);
  await expect.poll(async () => (await page.request.get("/login")).status(), { timeout: 30_000 }).toBe(200);
  await page.goto("/login");
  await page.fill("#phone", "9800000001");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.fill("#code", "123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Load sample activity" }).click();
  await expect(page.getByRole("link", { name: /Unassigned Queue\s*1/ })).toBeVisible();

  // Unassigned Queue → manual reassignment with a reason, kept in history.
  await page.goto("/admin/allocation");
  const queued = page.locator("li", { hasText: "Kabir Shah" });
  await queued.getByLabel("Assign to").selectOption("u-broker-ravi");
  await expect(queued.getByRole("button", { name: "Reassign" })).toBeDisabled();
  await queued.getByLabel("Reason (required)").fill("Neha is on leave; Ravi covers Hill Road");
  await queued.getByRole("button", { name: "Reassign" }).click();
  await expect(page.getByText("The queue is empty.")).toBeVisible();
  await page.getByRole("row", { name: /Kabir Shah/ }).getByRole("link").click();
  await expect(page.getByText("Manual reassignment · Manual")).toBeVisible();
  await expect(page.getByText("“Neha is on leave; Ravi covers Hill Road”")).toBeVisible();

  // Broker leave: end it early.
  await page.goto("/admin/brokers");
  const neha = page.locator("li", { hasText: "Neha Joshi" });
  await expect(neha.getByText("On leave", { exact: true })).toBeVisible();
  await neha.getByRole("button", { name: "End now" }).click();
  await expect(neha.getByText("Eligible now")).toBeVisible();

  // Verification: approval requires the photo privacy check.
  await page.goto("/admin/properties");
  const approve = page.getByRole("button", { name: "Approve and publish" });
  await expect(approve).toBeDisabled();
  await page.getByLabel(/I checked the public photos/).check();
  await approve.click();
  await expect(page.getByText("Nothing waiting.")).toBeVisible();
  await expect(page.getByRole("row", { name: /PR-1008/ })).toContainText("Published");

  // Brokerage: waive the owner, refund part of the student's payment, change credit.
  await page.goto("/admin/brokerage");
  const row = (party: string) => page.getByRole("row").filter({ has: page.getByRole("cell", { name: party, exact: true }) });
  const owner = row("owner");
  await owner.getByRole("button", { name: "Waive" }).click();
  await owner.getByLabel("Reason").fill("Owner referred three students");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner).toContainText("Waived");

  const student = row("student");
  await student.getByRole("button", { name: "Refund" }).click();
  await student.getByLabel("Refund amount").fill("500");
  await student.getByLabel("Reason").fill("Moved in a week late");
  await student.getByRole("button", { name: "Save" }).click();
  await expect(student).toContainText("Refund pending");
  await student.getByRole("button", { name: "Mark refund paid" }).click();
  await student.getByLabel("Refund reference").fill("UPI-REFUND-1");
  await student.getByRole("button", { name: "Save" }).click();
  await expect(student).toContainText("Refunded");

  await student.getByRole("button", { name: "Change credit" }).click();
  await student.getByLabel("Credit to").selectOption({ label: "Ravi Menon" });
  await student.getByLabel("Reason").fill("Ravi did the visit");
  await student.getByRole("button", { name: "Save" }).click();
  await expect(student).toContainText("Ravi Menon");

  // Policies: a new version replaces the old one.
  await page.getByRole("button", { name: "Change…" }).first().click();
  await page.getByLabel("Who pays").selectOption("owner");
  await page.getByLabel("Owner calculation").selectOption("months_of_rent");
  await page.getByLabel("Owner value").fill("1");
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByText("Previous versions (1)")).toBeVisible();
  await expect(page.getByRole("cell", { name: "1 month(s) of rent" })).toBeVisible();

  // Audit trail.
  await page.goto("/admin/audit?action=brokerage.");
  for (const action of ["brokerage.waived", "brokerage.refund_completed", "brokerage.credit_changed", "brokerage.policy_created"]) {
    await expect(page.getByRole("cell", { name: action, exact: true }).first()).toBeVisible();
  }

  // Super Admin stays in the admin app.
  await page.goto("/broker");
  await expect(page).toHaveURL(/\/admin$/);
});
