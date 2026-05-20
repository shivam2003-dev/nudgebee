import { Page, expect, TestInfo } from "@playwright/test";
import { LoginPage } from "../../../pages/LoginPage";
import { ensureSwitchEnabled } from "../../utils/helpers";
import { waitForGraphQLAndValidate } from "../../utils/GraphQLNetworkWatcher";
import { NotificationLocators } from "./NotificationLocators";

async function selectFromFilterDropdown(
  page: Page,
  dropdownLocator: import("@playwright/test").Locator,
  optionText: string
): Promise<boolean> {
  const searchInput = page.locator('input[placeholder="Search..."]');
  // Only open the dropdown if it isn't already open — clicking again on a multi-select toggles it closed.
  const isAlreadyOpen = await searchInput.isVisible().catch(() => false);
  if (!isAlreadyOpen) {
    await dropdownLocator.click();
  }
  // waitFor instead of isVisible — dropdown opens async so we must wait for the input to render
  const isSearchVisible = await searchInput.waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (isSearchVisible) {
    await searchInput.fill(optionText);
  }
  const option = page
    .locator('[role="option"]')
    .filter({ has: page.getByText(optionText, { exact: true }) })
    .first();
  await option.waitFor({ state: "visible" }).catch(() => {});
  const found = await option.isVisible().catch(() => false);
  if (!found) {
    console.warn(`Option "${optionText}" not found in dropdown — skipping.`);
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }
  await option.click();
  return true;
}

export interface ChannelConfig {
  slack?: string;
  msTeamsGroup?: string;
  msTeamsChannel?: string;
  gChat?: string;
  email?: string;
  excludeUsers?: string[];
}

export async function navigateToNewNotificationRule(
  page: Page
): Promise<NotificationLocators> {
  const loginPage = new LoginPage(page);
  const locators = new NotificationLocators(page);

  await loginPage.doFullLogin();
  await locators.adminBtn.waitFor({ state: "visible" });
  await locators.adminBtn.click();

  await locators.notificationsTab.waitFor({ state: "visible" });
  await locators.notificationsTab.click();

  await expect(locators.notificationRuleBtn).toBeVisible();
  await locators.notificationRuleBtn.click();

  await ensureSwitchEnabled(page, locators.enableNotificationSwitch);

  return locators;
}

//Selects the cluster from the account dropdown using the CLUSTER_NAME env var.
export async function selectCluster(
  locators: NotificationLocators,
  page: Page
): Promise<void> {
  const clusterName = process.env.CLUSTER_NAME || process.env.CLUSTER;
  if (!clusterName) throw new Error("CLUSTER_NAME or CLUSTER env var is not set");
  await locators.clusterSelector.waitFor({ state: "visible" });
  await selectFromFilterDropdown(page, locators.clusterSelector, clusterName);
}

// Configures Slack, MS Teams, and Google Chat channels if their badges are visible.
// Returns true if at least one channel was successfully configured.
 
export async function configureChannels(
  page: Page,
  locators: NotificationLocators,
  channelConfig: ChannelConfig
): Promise<boolean> {
  let anyConfigured = false;

  if (channelConfig.slack && (await locators.slackBadge.isVisible())) {
    await locators.slackBadge.click();
    await locators.slackChannelSelector.waitFor({ state: "visible" });
    const slackSelected = await selectFromFilterDropdown(page, locators.slackChannelSelector, channelConfig.slack);
    if (slackSelected) anyConfigured = true;
  }

  if (
    channelConfig.msTeamsGroup &&
    channelConfig.msTeamsChannel &&
    (await locators.msTeamsBadge.isVisible())
  ) {
    await locators.msTeamsBadge.click();
    await locators.msTeamsGroupSelector.waitFor({ state: "visible" });
    const groupSelected = await selectFromFilterDropdown(page, locators.msTeamsGroupSelector, channelConfig.msTeamsGroup);

    if (groupSelected) {
      await locators.msTeamsChannelSelector.waitFor({ state: "visible" });
      const channelSelected = await selectFromFilterDropdown(page, locators.msTeamsChannelSelector, channelConfig.msTeamsChannel);
      if (channelSelected) anyConfigured = true;
    }
  }

  if (channelConfig.gChat && (await locators.gChatBadge.isVisible())) {
    await locators.gChatBadge.click();
    await locators.gChatChannelSelector.waitFor({ state: "visible" });
    const gChatSelected = await selectFromFilterDropdown(page, locators.gChatChannelSelector, channelConfig.gChat);
    if (gChatSelected) anyConfigured = true;
  }

  if (
    (channelConfig.email || channelConfig.excludeUsers?.length) &&
    (await locators.emailBadge.isVisible())
  ) {
    await locators.emailBadge.click();

    if (channelConfig.email) {
      await locators.emailInput.waitFor({ state: "visible" });
      await locators.emailInput.fill(channelConfig.email);
      anyConfigured = true;
    }

    if (channelConfig.excludeUsers?.length) {
      await locators.excludeUsersSelector.waitFor({ state: "visible" });
      for (const userEmail of channelConfig.excludeUsers) {
        await selectFromFilterDropdown(page, locators.excludeUsersSelector, userEmail);
      }
      anyConfigured = true;
    }
  }

  return anyConfigured;
}

export async function submitAndVerify(
  page: Page,
  locators: NotificationLocators,
  ruleName: string,
  anyChannelConfigured: boolean,
  testInfo: TestInfo
): Promise<void> {
  if (!anyChannelConfigured) {
    console.warn(
      `\n⚠️  No messaging channels installed — suppressing rule "${ruleName}" to allow creation.\n` +
        "   Install Slack, MS Teams, or Google Chat to test channel routing.\n"
    );
    await page.locator(locators.enableNotificationSwitch).click();
  }

  await locators.notificationNameInput.fill(ruleName);

  await waitForGraphQLAndValidate(
    page,
    async () => {
      await locators.submitBtn.click();
      await expect(
        locators.successToast
          .or(locators.updatedSuccessToast)
          .or(locators.getDuplicateError())
          .or(locators.duplicateConstraintError)
      ).toBeVisible();
    },
    {
      testName: testInfo.title,
      operationNames: [],
      ignoreErrorMessages: ["unique constraint"],
    }
  );
}
