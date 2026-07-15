/**
 * Selenium-webdriver smoke tests against the Bun-served demo harness.
 *
 * The demo server is started by tests/e2e/setup/globalSetup.cjs; Selenium
 * Manager (bundled with selenium-webdriver) provisions the chromedriver.
 */
import { Builder, By, until, type WebDriver } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';

const DEMO_URL = 'http://localhost:3000';

let driver: WebDriver;

beforeAll(async () => {
  const options = new ChromeOptions();
  options.addArguments('--headless=new', '--window-size=1400,900', '--disable-gpu');
  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
}, 120000);

afterAll(async () => {
  if (driver) await driver.quit();
});

const byTestId = (id: string) => By.css(`[data-testid="${id}"]`);

describe('demo harness', () => {
  it('loads the dashboard', async () => {
    await driver.get(DEMO_URL);
    const root = await driver.wait(until.elementLocated(byTestId('dashboard-root')), 15000);
    expect(await root.isDisplayed()).toBe(true);
  });

  it('streams simulated telemetry — the dashboard text changes over time', async () => {
    const before = await driver.findElement(By.css('body')).getText();
    await driver.sleep(3000);
    const after = await driver.findElement(By.css('body')).getText();
    expect(after).not.toEqual(before);
  });

  it('renders the radius visualizer with its radar rings', async () => {
    const radar = await driver.wait(until.elementLocated(byTestId('radius-visualizer')), 10000);
    expect(await radar.isDisplayed()).toBe(true);
    const circles = await radar.findElements(By.css('circle'));
    expect(circles.length).toBeGreaterThanOrEqual(3); // outer ring + range rings + ping
  });

  it('renders the ship rudder visualizer with a rudder readout', async () => {
    const panel = await driver.wait(until.elementLocated(byTestId('rudder-visualizer')), 10000);
    expect(await panel.isDisplayed()).toBe(true);
    expect(await panel.getText()).toMatch(/RUDDER: -?\d+°/);
  });

  it('collapses and expands the log drawer', async () => {
    const header = await driver.findElement(
      By.xpath(`//*[text()='Demo Log']/ancestor::*[contains(@class,'MuiBox-root')][1]`),
    );
    await header.click();
    await driver.wait(until.elementLocated(By.xpath("//*[text()='Expand']")), 5000);
    await header.click();
    await driver.wait(until.elementLocated(By.xpath("//*[text()='Collapse']")), 5000);
  });

  it('has no unexpected severe console errors', async () => {
    const logs = await driver.manage().logs().get('browser');
    const severe = logs.filter(
      (entry) =>
        entry.level.name === 'SEVERE' &&
        // the demo intentionally has no basestation — connection refusals are expected
        !entry.message.includes('ERR_CONNECTION_REFUSED') &&
        !entry.message.includes('/health'),
    );
    expect(severe).toEqual([]);
  });
});
