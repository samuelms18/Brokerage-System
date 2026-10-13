import { expect, test, type Browser, type Page } from "@playwright/test";

// Two people, two browser sessions: a student and the property's broker (Asha).
let seq = Math.floor(Math.random() * 1e6);

async function loginStudent(page: Page, name: string) {
  await page.goto("/p/PR-1001");
  await page.fill("#phone", `97${String(++seq).padStart(8, "0")}`);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.fill("#code", "123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.fill("#name", name);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/p\/PR-1001$/);
}

async function loginBroker(browser: Browser, phone = "9800000011") {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.fill("#phone", phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.fill("#code", "123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/broker$/);
  return page;
}

test("request → broker accepts → visit → assignment with brokerage disclosure → payment", async ({ page: student, browser }) => {
  test.setTimeout(120_000);
  const name = `Meera ${seq}`;
  await loginStudent(student, name);
  await student.getByRole("button", { name: "Request visit" }).first().click();
  await student.getByRole("button", { name: "Send visit request" }).click();
  await expect(student.getByRole("heading", { name: "Request Received" })).toBeVisible();
  const requestUrl = student.url().replace("?received=1", "");

  // Broker: the lead is offered, student phone hidden until accepted.
  const broker = await loginBroker(browser);
  await expect(broker.getByText("New leads waiting for you")).toBeVisible();
  await broker.locator("li", { hasText: name }).getByRole("link", { name: "Review" }).click();
  await expect(broker.getByText("Visible after you accept")).toBeVisible();
  expect(await broker.content()).not.toContain("+9197");
  await broker.getByRole("button", { name: "Accept lead" }).click();
  await expect(broker.getByRole("link", { name: /^\+9197/ })).toBeVisible();

  // Student now sees the broker's business contact.
  await student.goto(requestUrl);
  await expect(student.getByText("+912040000011")).toBeVisible();

  // Broker proposes a time; student confirms; broker records the visit.
  await broker.getByRole("button", { name: "Propose time" }).click();
  await expect(broker.getByText("waiting for the student to confirm")).toBeVisible();
  await student.reload();
  await student.getByRole("button", { name: "Confirm this time" }).click();
  await expect(student.getByText(/Confirmed · 1 person/)).toBeVisible();
  await broker.reload();
  await broker.getByRole("button", { name: "Mark visited" }).click();

  // Assignment on a specific bed.
  await broker.getByRole("button", { name: "Reserve bed and start assignment" }).click();
  await expect(broker).toHaveURL(/\/broker\/assignments\//);
  await expect(broker.getByText("Owner Details · Admin only")).toBeVisible();

  // Confirm is blocked until both parties have been shown their amount.
  const confirm = broker.getByRole("button", { name: "Confirm assignment" });
  await expect(confirm).toBeDisabled();
  await expect(broker.getByText("Show the current brokerage amount to the student and owner before confirming.")).toBeVisible();
  await broker.getByRole("button", { name: "Show to student" }).click();
  await expect(broker.getByText("Shown in the app")).toBeVisible();
  await broker.getByRole("button", { name: "Record shown to owner" }).click();
  await expect(broker.getByText("Shown on WhatsApp")).toBeVisible();

  // Student sees only their own amount and acknowledges it.
  await student.reload();
  const card = student.locator("section", { has: student.getByRole("heading", { name: "Brokerage" }) });
  await expect(card).toBeVisible();
  const studentAmount = (await card.locator("p").nth(0).textContent())!.trim();
  await student.getByRole("button", { name: "I've seen this amount" }).click();
  await expect(student.getByText("You have acknowledged this amount.")).toBeVisible();
  expect(await student.content()).not.toContain("Prakash Deshmukh");

  await broker.reload();
  await expect(broker.getByText("Shown in the app · acknowledged")).toBeVisible();
  await broker.getByRole("button", { name: "Confirm assignment" }).click();
  await expect(broker.getByText("Confirmed", { exact: true })).toBeVisible();

  // Record the student's payment (manual, MVP).
  const form = broker.locator("li", { hasText: "student" }).filter({ has: broker.getByRole("button", { name: "Record payment" }) });
  await form.getByLabel(/Reference/).fill("UPI-TEST-1");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(broker.getByText(/RC-\d{4}-\d{6}/)).toBeVisible();

  await student.reload();
  await expect(student.getByText(studentAmount).first()).toBeVisible();
  await expect(student.getByText(/Status: Paid/)).toBeVisible();

  await broker.goto("/broker/brokerage");
  await expect(broker.getByRole("heading", { name: "Brokerage credited to you" })).toBeVisible();
});

test("students cannot open the broker app, brokers cannot use student APIs", async ({ page, browser }) => {
  await loginStudent(page, "Curious Student");
  await page.goto("/broker");
  await expect(page).toHaveURL(/localhost:3100\/$/);
  expect((await page.request.get("/api/v1/broker/dashboard")).status()).toBe(403);

  const broker = await loginBroker(browser, "9800000012");
  expect((await broker.request.get("/api/v1/listings")).status()).toBe(403);

  // Log out is reachable at every screen size.
  await broker.getByRole("button", { name: "Log out" }).click();
  await expect(broker).toHaveURL(/\/login$/);
});
