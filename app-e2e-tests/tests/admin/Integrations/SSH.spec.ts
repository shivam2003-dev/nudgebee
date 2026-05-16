import { test, expect } from "@playwright/test";
import { LoginPage } from "../../../pages/LoginPage";
import { IntegrationLocators } from "./IntegrationLocators";
import { waitForGraphQLAndValidate } from "../../utils/GraphQLNetworkWatcher";
const requiredEnv = ["SSH_HOST", "SSH_INTEGRATION_CONFIG_NAME", "SSH_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

test("Add SSH Account Integration", async ({ page }) => {
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

  // verify SSH integration section
  await expect(locators.serversTab).toBeVisible({ timeout: 15000 });
  await locators.serversTab.click();

  await locators.sshBtn.click();
  await locators.addSshAccountBtn.click();

  // Fill the SSH integration form
  await locators.sshAccountIdDropdown.click();
  await locators.sshAccountIdOption(process.env.CLUSTER!).first().click();
  await locators.sshAccountIdDropdown.press("Escape");
  await locators.sshHostInput.fill(process.env.SSH_HOST!);
  await locators.sshConfigNameInput.fill(
    process.env.SSH_INTEGRATION_CONFIG_NAME!,
  );
  await locators.sshK8sSecretInput.fill(process.env.SSH_SECRET!);

  // Test connection with GraphQL validation
  await waitForGraphQLAndValidate(
    page,
    async () => {
      await locators.sshTestConnectionBtn.click();

      const successToast = locators.sshTestConnectionSuccessToast;
      const errorToast = locators.genericErrorToast.first();

      await successToast
        .or(errorToast)
        .first()
        .waitFor({ state: "visible", timeout: 40000 });

      if (await successToast.isVisible()) {
        console.log("Test connection SUCCESS:", await successToast.innerText().catch(() => "Ssh connection successful"));
        await expect(locators.saveBtn).toBeEnabled();
      } else if (await errorToast.isVisible()) {
        const errorText = (await errorToast.innerText().catch(() => "Unknown error")).trim();
        console.error("Test connection FAILED:", errorText);
        throw new Error(`SSH test connection failed: ${errorText}`);
      } else {
        throw new Error("Neither success nor error toast appeared within 40s");
      }
    },
    {
      testName: "Add SSH Account Integration - Test Connection",
      operationNames: ["TestIntegrationConnectionConfig"],
    },
  );

  await waitForGraphQLAndValidate(
    page,
    async () => {
      await locators.saveBtn.click();

      const successToast = locators.sshSuccessToast;
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
      testName: "Add SSH Account Integration",
      operationNames: ["AddIntegrations"],
      ignoreErrorMessages: ["already has a 'ssh' integration"],
    },
  );
});
