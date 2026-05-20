import { test, expect } from "@playwright/test";
import { LoginPage } from "../../../pages/LoginPage";
import { IntegrationLocators } from "./IntegrationLocators";
import { waitForGraphQLAndValidate } from "../../utils/GraphQLNetworkWatcher";
const requiredEnv = ["POSTGRES_NAME", "POSTGRES_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

test("Add Postgresql Account Integration", async ({ page }) => {
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

  // verify Postgresql integration section
  await expect(locators.databaseTab).toBeVisible({ timeout: 15000 });
  await locators.databaseTab.click();

  await locators.postgresqlBtn.click();
  await locators.addPostgresqlAccountBtn.click();

  await locators.postgresqlConfigNameInput.fill(process.env.POSTGRES_NAME!);
  await locators.postgresqlAccountIdDropdown.click();
  await locators
    .postgresqlAccountIdOption(process.env.CLUSTER!)
    .first()
    .click();
  await locators.postgresqlAccountIdDropdown.press("Escape");
  await locators.postgresqlK8sSecretInput.fill(process.env.POSTGRES_SECRET!);

  // Test connection with GraphQL validation
  await waitForGraphQLAndValidate(
    page,
    async () => {
      await locators.postgresqlTestConnectionBtn.click();

      const successToast = locators.postgresqlTestConnectionSuccessToast;
      const errorToast = locators.genericErrorToast.first();

      await successToast
        .or(errorToast)
        .first()
        .waitFor({ state: "visible", timeout: 40000 });

      if (await successToast.isVisible()) {
        console.log("Test connection SUCCESS:", await successToast.innerText().catch(() => "Postgresql connection successful"));
        await expect(locators.saveBtn).toBeEnabled();
      } else if (await errorToast.isVisible()) {
        const errorText = (await errorToast.innerText().catch(() => "Unknown error")).trim();
        console.error("Test connection FAILED:", errorText);
        throw new Error(`Postgresql test connection failed: ${errorText}`);
      } else {
        throw new Error("Neither success nor error toast appeared within 40s");
      }
    },
    {
      testName: "Add Postgresql Account Integration - Test Connection",
      operationNames: ["TestIntegrationConnectionConfig"],
    },
  );

  await waitForGraphQLAndValidate(
    page,
    async () => {
      await locators.saveBtn.click();

      const successToast = locators.postgresqlSuccessToast;
      const errorToast = locators.genericErrorToast.first();

      await successToast
        .or(errorToast)
        .first()
        .waitFor({ state: "visible", timeout: 30000 });

      if (await successToast.isVisible()) {
        console.log("SUCCESS:", await successToast.innerText());
        await expect(successToast).toBeVisible();
      } else if (await errorToast.isVisible()) {
        const trimmed = (await errorToast.innerText().catch(() => "Unknown error")).trim();
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
      testName: "Add Postgresql Account Integration",
      operationNames: ["AddIntegrations"],
      ignoreErrorMessages: ["already has a 'postgresql' integration"],
    },
  );
});
