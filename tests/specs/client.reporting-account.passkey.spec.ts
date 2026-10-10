/**
 * CI Playwright, virtual authenticator: the chat link's Account step in the compiled dev client,
 * against the Agent's reporting driver. Unit tests and stories run without the React Compiler, so
 * a stale render that only the compiled page shows is caught here and nowhere below.
 *
 * Both journeys stop at Sign to Continue. The driver checks wallet signatures only, so a passkey
 * account's proof cannot pass it. That signature, a real device and a synced passkey need their
 * own proof.
 */
// TEST-QUALITY: allow-small-test-file - one journey per way in; each page load costs seconds on the dev client
import { expect, type Page, test } from "@playwright/test";
import { requestAccountLink, standInBehindAccountStep } from "../helpers/reporting-ceremony";
import { TEST_URLS } from "../helpers/test-utils";

test.use({
  baseURL: TEST_URLS.client,
  serviceWorkers: "block",
  viewport: { width: 390, height: 844 },
});
// A journey loads the unbundled dev client. The first load of a run compiles the route, and on
// a cold dependency cache that alone took half a minute on a quiet machine.
test.describe.configure({ timeout: 150_000 });
const FIRST_PAINT = 90_000;
/** A passkey prompt, the directory and the address read sit between a press and its outcome. */
const CEREMONY = { timeout: 30_000 };

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const bar = (page: Page) => page.getByRole("region", { name: "Next step" });
const acts = (page: Page) => bar(page).getByRole("button");
const act = (page: Page, name: string) => bar(page).getByRole("button", { name, exact: true });
const said = (page: Page) => page.getByRole("alert");
const nameField = (page: Page) => page.getByLabel("Account name");
const otherAccount = (page: Page) =>
  page.getByRole("button", { name: /^Not 0x.+\? Use a different account$/ });

/** Opens the link as a phone would and presses Continue, which lands on the Account step. */
async function arrive(page: Page, link: string) {
  await page.goto(link, { waitUntil: "domcontentloaded" });
  await act(page, "Continue").click({ timeout: FIRST_PAINT });
}

/** From the two choices: Create Account, a name, and the passkey prompt. */
async function createAccount(page: Page, name: string) {
  await act(page, "Create Account").click();
  await expect(heading(page)).toHaveText("Create Your Account");
  await nameField(page).fill(name);
  await act(page, "Create Account").click();
}

/** Kept with the run's report, so a reviewer can see the screen a journey reached. */
async function keep(page: Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

/** The account the page is connected as, read from the link that offers to let it go. */
async function connectedAccount(page: Page) {
  await expect(act(page, "Sign to Continue")).toBeEnabled(CEREMONY);
  const account = await otherAccount(page).locator("span[title]").getAttribute("title");
  expect(account).toMatch(/^0x[0-9a-fA-F]{40}$/);
  return account;
}

test.describe("on a phone that last saw someone else's account", () => {
  // modules/auth/session.ts keeps the last account under this key, and the app remounts when a
  // different one signs in.
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: TEST_URLS.client,
          localStorage: [{ name: "greengoods_last_account", value: `0x${"00".repeat(19)}b2` }],
        },
      ],
    },
  });

  test("a newcomer creates an account past a taken name and a closed prompt", async ({
    page,
    request,
  }) => {
    const world = await standInBehindAccountStep(page);
    world.directory.takeName("ada");
    await arrive(page, await requestAccountLink(request));

    await test.step("the step opens on two choices", async () => {
      await expect(heading(page)).toHaveText("New to Green Goods?");
      await expect(acts(page)).toHaveText(["Create Account", "I Have an Account"]);
      await keep(page, "two-choices");
    });
    await test.step("a name another account has is refused before any prompt", async () => {
      await createAccount(page, "ada");
      await expect(said(page)).toHaveText(
        "That name is taken. Pick another, or go back if it's yours.",
        CEREMONY
      );
      expect(await world.passkeys()).toBe(0);
    });
    await test.step("a prompt that closes makes no account", async () => {
      await world.closePrompts(true);
      await nameField(page).fill("bea");
      await act(page, "Create Account").click();
      await expect(said(page)).toHaveText(
        "The passkey prompt closed, so no account was made. Try again.",
        CEREMONY
      );
      expect(await world.passkeys()).toBe(0);
      expect(world.directory.holds("bea")).toBe(false);
    });
    await test.step("trying again makes one account and returns to the step by itself", async () => {
      await world.closePrompts(false);
      await act(page, "Create Account").click();
      // The app remounts for an account this phone has not seen, and the page opens its link
      // again. Nobody presses Continue a second time.
      await expect.poll(world.linkOpenings, CEREMONY).toBe(2);
      await connectedAccount(page);
      expect(world.linkOpenings()).toBe(2);
      expect(await world.passkeys()).toBe(1);
      expect(world.directory.holds("bea")).toBe(true);
      await keep(page, "account-created");
    });
    expect(world.pageErrors).toEqual([]);
  });
});

test("someone with an account gets back in, by its passkey and then by its name", async ({
  page,
  request,
}) => {
  const world = await standInBehindAccountStep(page);
  await arrive(page, await requestAccountLink(request));
  await createAccount(page, "cleo");
  const account = await connectedAccount(page);

  await test.step("letting the account go offers its passkey, not a second account", async () => {
    await otherAccount(page).click();
    await expect(acts(page)).toHaveText(["Use Passkey", "Use Wallet"]);
  });
  await test.step("a prompt that closes says so", async () => {
    await world.closePrompts(true);
    await act(page, "Use Passkey").click();
    await expect(said(page)).toHaveText(
      "The passkey prompt closed. Try again, or use another way in.",
      CEREMONY
    );
  });
  await test.step("the next try signs in to the same account", async () => {
    await world.closePrompts(false);
    await act(page, "Use Passkey").click();
    expect(await connectedAccount(page)).toBe(account);
    // In a browser nobody had used, none of this opened the link a second time.
    expect(world.linkOpenings()).toBe(1);
  });
  await test.step("a browser that has forgotten the account opens on the two choices", async () => {
    // The same device and passkey, in a browser that no longer knows the account.
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await arrive(page, await requestAccountLink(request));
    await expect(acts(page)).toHaveText(["Create Account", "I Have an Account"]);
  });
  await test.step("I Have an Account asks for the name before any prompt", async () => {
    await act(page, "I Have an Account").click();
    await expect(acts(page)).toHaveText(["Use Passkey", "Use Wallet"]);
    await act(page, "Use Passkey").click();
    await expect(heading(page)).toHaveText("Find Your Account");
  });
  await test.step("a name no account has is said to be unknown", async () => {
    await nameField(page).fill("nobody");
    await act(page, "Find Account").click();
    await expect(said(page)).toHaveText(
      "No account has that name. Check the spelling, or go back.",
      CEREMONY
    );
  });
  await test.step("its own name signs in to the same account, with no new passkey", async () => {
    await nameField(page).fill("cleo");
    await act(page, "Find Account").click();
    expect(await connectedAccount(page)).toBe(account);
    expect(await world.passkeys()).toBe(1);
    await keep(page, "account-found-by-name");
  });
  expect(world.pageErrors).toEqual([]);
});
