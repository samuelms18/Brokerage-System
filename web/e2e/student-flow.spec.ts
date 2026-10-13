import { expect, test, type Page } from "@playwright/test";

// Private demo values that must never reach a student's browser.
const PRIVATE = ["Prakash Deshmukh", "+919822000101", "9822000101", "prakash.owner@example.com",
  "Plot 14, Shanti Niwas", "Opposite Gupta Medicals", "18.53247", "73.84822", "Front gate with house number"];

let phoneSeq = Math.floor(Math.random() * 1e6);
const nextPhone = () => `98${String(++phoneSeq).padStart(8, "0")}`;

async function login(page: Page, name = "Test Student") {
  await page.fill("#phone", nextPhone());
  await page.getByRole("button", { name: "Send code" }).click();
  await page.fill("#code", "123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.fill("#name", name);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("shared link → login → back to the property → request visit → Request Received", async ({ page }) => {
  // Signed out: the shared link goes to login, remembering the property.
  await page.goto("/p/PR-1001");
  await expect(page).toHaveURL(/\/login\?next=%2Fp%2FPR-1001/);
  await expect(page.getByText("Log in to view this property")).toBeVisible();

  await login(page, "Priya Sharma");
  await expect(page).toHaveURL(/\/p\/PR-1001$/);
  await expect(page.getByRole("heading", { name: "Sunrise Residency for Students" })).toBeVisible();

  // Owner data is not in the page at all (not just hidden).
  const html = await page.content();
  for (const v of PRIVATE) expect(html, `leaked ${v}`).not.toContain(v);

  // Shortlisting does not create a request.
  await page.getByRole("button", { name: /Save to shortlist|Shortlist/ }).first().click();
  await page.goto("/requests");
  await expect(page.getByText("No requests yet")).toBeVisible();

  await page.goto("/p/PR-1001");
  await page.getByRole("button", { name: "Request visit" }).first().click();
  await page.getByRole("button", { name: "Send visit request" }).click();

  await expect(page).toHaveURL(/\/requests\/.+\?received=1/);
  await expect(page.getByRole("heading", { name: "Request Received" })).toBeVisible();
  await expect(page.getByText("Your property request has been received. Our broker will contact you shortly.")).toBeVisible();

  // Broker contact appears only after the broker accepts.
  await expect(page.getByText("Their name and number appear here once they take up your request")).toBeVisible();
  await page.getByRole("button", { name: "Simulate: broker accepts" }).click();
  await expect(page.getByText("+912040000011")).toBeVisible();

  // The property page now points to the existing request instead of creating a duplicate.
  await page.goto("/p/PR-1001");
  await expect(page.getByRole("link", { name: "View your request" }).first()).toBeVisible();
});

test("open-redirect attempts after login land on the marketplace", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.example%2F");
  await login(page);
  await expect(page).toHaveURL(/localhost:3100\/$/);
});

test("marketplace filters and empty-state suggestions", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await expect(page.getByRole("heading", { name: /6 properties/ })).toBeVisible();
  // Unverified (PR-1008) and fully occupied (PR-1007) properties are not listed.
  await expect(page.getByText("Draft: New Riverside PG")).toHaveCount(0);
  await expect(page.getByText("Campus Edge Shared House")).toHaveCount(0);

  await page.goto("/?rent_max=5000&sharing=1");
  await expect(page.getByText("No properties match these filters")).toBeVisible();
  await page.getByRole("link", { name: "Any sharing type" }).click();
  await expect(page.getByRole("heading", { name: /1 property/ })).toBeVisible();
});

test("API rejects signed-out access", async ({ request }) => {
  for (const path of ["/api/v1/listings", "/api/v1/listings/PR-1001", "/api/v1/student/requests"]) {
    const res = await request.get(path);
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
  }
});
