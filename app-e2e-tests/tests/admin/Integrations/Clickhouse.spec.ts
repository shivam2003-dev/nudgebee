import { test, expect } from "@playwright/test";
import { LoginPage } from "../../../pages/LoginPage";
import { IntegrationLocators } from "./IntegrationLocators";
import { waitForGraphQLAndValidate } from "../../utils/GraphQLNetworkWatcher";
const requiredEnv = ["CLICKHOUSE_INTEGRATION_CONFIG_NAME", "CLICKHOUSE_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

test("Add Clickhouse Account Integration", async ({ page }) => {
  test.skip(
    missingEnv.length > 0,
    `Missing required env vars: ${missingEnv.join(", ")} — add them to the E2E_TEST_ENV secret`,
  );
  const loginPage = new LoginPage(page);
  const locators = new IntegrationLocators(page);
  await loginPage.doFullLogin();
  await locators.adminBtn.waitFor({ state: "visible" });
  await locators.adminBtn.click();
  console.log("Clicked on Admin button");

  await locators.integrationsTab.click();

  // verify Clickhouse integration section
  await expect(locators.databaseTab).toBeVisible({ timeout: 15000 });
  await locators.databaseTab.click();

  await locators.clickhouseBtn.click();
  await locators.addClickhouseAccountBtn.click();

  await locators.clickhouseConfigNameInput.fill(
    process.env.CLICKHOUSE_INTEGRATION_CONFIG_NAME!,
  );
  await locators.clickhouseAccountIdDropdown.click();
  await locators
    .clickhouseAccountIdOption(process.env.CLUSTER!)
    .first()
    .click();
  await locators.clickhouseAccountIdDropdown.press("Escape");
  await locators.clickhouseK8sSecretInput.fill(process.env.CLICKHOUSE_SECRET!);

  // Test connection with GraphQL validation
  await waitForGraphQLAndValidate(
    page,
    async () => {
      await locators.clickhouseTestConnectionBtn.click();

      const successToast = locators.clickhouseTestConnectionSuccessToast;
      const errorToast = locators.genericErrorToast.first();

      await successToast
        .or(errorToast)
        .first()
        .waitFor({ state: "visible", timeout: 40000 });

      if (await successToast.isVisible()) {
        console.log("Test connection SUCCESS:", await successToast.innerText().catch(() => "Clickhouse connection successful"));
        await expect(locators.saveBtn).toBeEnabled();
      } else if (await errorToast.isVisible()) {
        const errorText = (await errorToast.innerText().catch(() => "Unknown error")).trim();
        console.error("Test connection FAILED:", errorText);
        throw new Error(`Clickhouse test connection failed: ${errorText}`);
      } else {
        throw new Error("Neither success nor error toast appeared within 30s");
      }
    },
    {
      testName: "Add Clickhouse Account Integration - Test Connection",
      operationNames: []
    },
  );

  await waitForGraphQLAndValidate(
    page,
    async () => {
      await locators.saveBtn.click();

      // Handle either success OR duplicate error
      const successToast = locators.clickhouseSuccessToast;
      const errorToast = locators.genericErrorToast.first();

      await Promise.race([
        successToast.waitFor({ state: "visible", timeout: 30000 }),
        errorToast.waitFor({ state: "visible", timeout: 30000 }),
      ]);

      if (await successToast.isVisible()) {
        console.log("SUCCESS:", await successToast.innerText());
        await expect(successToast).toBeVisible();
      } else if (await errorToast.isVisible()) {
        const errorText = await errorToast.innerText();
        const trimmed = errorText.trim();
        if (trimmed.includes("already exists") || trimmed.includes("already has")) {
          console.log("ALREADY_EXISTS:", trimmed);
        } else {
          console.error("FAILED:", trimmed);
          throw new Error(`Account creation failed: ${trimmed}`);
        }
      } else {
        console.error("FAILED: No success or error toast found");
        throw new Error("Neither success nor error toast appeared");
      }
    },
    {
      testName: "Add Clickhouse Account Integration",
      operationNames: ["AddIntegrations"],
      ignoreErrorMessages: ["account 'iteration-test' already has a 'clickhouse' integration ('clickhouse-test'); only one 'clickhouse' integration per account is supported — edit the existing one or remove it before adding another"],
    },
  );
});
