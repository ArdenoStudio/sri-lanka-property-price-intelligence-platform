"""
Stealth mode utilities for bypassing captchas and anti-bot detection.
Includes browser fingerprint randomization, anti-detection scripts, and bypass helpers.
"""
import random
import asyncio
from typing import Optional
from playwright.async_api import Page, BrowserContext
import structlog

log = structlog.get_logger()

# Expanded user agent pool with real browser fingerprints
USER_AGENTS = [
    # Chrome on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    # Chrome on Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    # Firefox
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    # Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    # Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
]

# Realistic viewport sizes (common resolutions)
VIEWPORTS = [
    {"width": 1920, "height": 1080},  # Full HD
    {"width": 1366, "height": 768},   # Laptop
    {"width": 1536, "height": 864},   # Laptop HD
    {"width": 1440, "height": 900},   # MacBook
    {"width": 2560, "height": 1440},  # 2K
    {"width": 1280, "height": 720},   # HD
]

# Languages and locales
LOCALES = ["en-US", "en-GB", "en-AU"]

# Timezone IDs
TIMEZONES = [
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Asia/Kolkata",
    "Asia/Dubai",
]


def get_random_fingerprint():
    """Generate randomized browser fingerprint."""
    return {
        "user_agent": random.choice(USER_AGENTS),
        "viewport": random.choice(VIEWPORTS),
        "locale": random.choice(LOCALES),
        "timezone_id": random.choice(TIMEZONES),
    }


async def setup_stealth_context(context: BrowserContext):
    """
    Apply stealth settings to browser context.
    Hides automation indicators and mimics real browsers.
    """
    # Anti-detection scripts
    await context.add_init_script("""
        // Overwrite navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {
                    0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                    name: "Chrome PDF Plugin",
                    filename: "internal-pdf-viewer",
                    length: 1
                },
                {
                    0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
                    name: "Chromium PDF Plugin",
                    filename: "internal-pdf-viewer",
                    length: 1
                }
            ]
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        // Hide automation
        window.navigator.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };

        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Mock battery
        Object.defineProperty(navigator, 'getBattery', {
            get: () => () => Promise.resolve({
                charging: true,
                chargingTime: 0,
                dischargingTime: Infinity,
                level: 1.0
            })
        });

        // Canvas fingerprint randomization (slight noise)
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (type === 'image/png' && this.width === 16 && this.height === 16) {
                // Likely fingerprinting canvas
                const context = this.getContext('2d');
                const imageData = context.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = imageData.data[i] ^ Math.floor(Math.random() * 3);
                }
                context.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, arguments);
        };

        // WebGL vendor randomization
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            return getParameter.apply(this, arguments);
        };
    """)


async def setup_stealth_page(page: Page):
    """
    Configure page with stealth settings.
    """
    # Set extra HTTP headers to mimic real browser
    await page.set_extra_http_headers({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    })

    # Add random mouse movements to simulate human behavior
    await page.evaluate("""
        () => {
            // Simulate random mouse movements
            setInterval(() => {
                const event = new MouseEvent('mousemove', {
                    clientX: Math.random() * window.innerWidth,
                    clientY: Math.random() * window.innerHeight
                });
                document.dispatchEvent(event);
            }, 5000 + Math.random() * 5000);
        }
    """)


async def detect_captcha(page: Page) -> dict:
    """
    Detect various types of captchas on the page.
    Returns dict with captcha type and elements if found.
    """
    captcha_info = {
        "detected": False,
        "type": None,
        "elements": []
    }

    try:
        content = await page.content()
        content_lower = content.lower()

        # Check for common captcha keywords
        captcha_keywords = [
            "recaptcha",
            "hcaptcha",
            "captcha",
            "cloudflare",
            "challenge",
            "verify you are human",
            "security check",
            "unusual traffic",
            "cf-challenge",
            "turnstile",
        ]

        for keyword in captcha_keywords:
            if keyword in content_lower:
                captcha_info["detected"] = True

                # Determine captcha type
                if "recaptcha" in content_lower:
                    captcha_info["type"] = "reCAPTCHA"
                elif "hcaptcha" in content_lower:
                    captcha_info["type"] = "hCaptcha"
                elif "cloudflare" in content_lower or "cf-challenge" in content_lower:
                    captcha_info["type"] = "Cloudflare"
                elif "turnstile" in content_lower:
                    captcha_info["type"] = "Cloudflare Turnstile"
                else:
                    captcha_info["type"] = "Generic"

                break

        # Check for captcha iframes
        recaptcha = await page.query_selector("iframe[src*='recaptcha']")
        if recaptcha:
            captcha_info["detected"] = True
            captcha_info["type"] = "reCAPTCHA"
            captcha_info["elements"].append("recaptcha_iframe")

        hcaptcha = await page.query_selector("iframe[src*='hcaptcha']")
        if hcaptcha:
            captcha_info["detected"] = True
            captcha_info["type"] = "hCaptcha"
            captcha_info["elements"].append("hcaptcha_iframe")

        # Check for Cloudflare challenge
        cf_challenge = await page.query_selector("#challenge-form, .cf-challenge-running, #cf-wrapper")
        if cf_challenge:
            captcha_info["detected"] = True
            captcha_info["type"] = "Cloudflare"
            captcha_info["elements"].append("cloudflare_challenge")

    except Exception as e:
        log.debug("captcha_detection_error", error=str(e))

    return captcha_info


async def wait_for_cloudflare(page: Page, timeout: int = 30000) -> bool:
    """
    Wait for Cloudflare challenge to complete.
    Returns True if challenge passed, False if timeout.
    """
    try:
        log.info("cloudflare_wait_starting", timeout=timeout)

        # Wait for challenge form to disappear
        await page.wait_for_selector(
            "#challenge-form, .cf-challenge-running, #cf-wrapper",
            state="detached",
            timeout=timeout
        )

        # Additional wait for page to stabilize
        await asyncio.sleep(2)

        # Verify we're not still on challenge page
        content = await page.content()
        if "checking if the site connection is secure" in content.lower():
            return False

        log.info("cloudflare_challenge_passed")
        return True

    except Exception as e:
        log.warning("cloudflare_wait_timeout", error=str(e))
        return False


async def human_delay(min_seconds: float = 1.0, max_seconds: float = 3.0):
    """
    Add random human-like delay.
    """
    delay = random.uniform(min_seconds, max_seconds)
    await asyncio.sleep(delay)


async def random_scroll(page: Page):
    """
    Perform random scrolling to mimic human behavior.
    """
    try:
        # Get page height
        height = await page.evaluate("document.body.scrollHeight")

        # Random scroll positions
        scroll_positions = [
            random.randint(100, min(500, height // 4)),
            random.randint(height // 4, height // 2),
            random.randint(height // 2, min(height, height * 3 // 4)),
        ]

        for pos in scroll_positions:
            await page.evaluate(f"window.scrollTo(0, {pos})")
            await asyncio.sleep(random.uniform(0.5, 1.5))

        # Scroll back to top
        await page.evaluate("window.scrollTo(0, 0)")
        await asyncio.sleep(random.uniform(0.3, 0.8))

    except Exception as e:
        log.debug("random_scroll_error", error=str(e))


async def bypass_cloudflare_turnstile(page: Page) -> bool:
    """
    Attempt to bypass Cloudflare Turnstile challenge.
    This works for "managed" mode but not "invisible" mode.
    """
    try:
        # Check if Turnstile checkbox is present
        checkbox = await page.query_selector("input[type='checkbox'][id*='turnstile']")
        if checkbox:
            log.info("turnstile_checkbox_found", message="Attempting to click")
            await checkbox.click()
            await asyncio.sleep(3)

            # Wait for verification
            success = await wait_for_cloudflare(page, timeout=15000)
            return success

        return False

    except Exception as e:
        log.debug("turnstile_bypass_error", error=str(e))
        return False


async def smart_goto(page: Page, url: str, wait_for_captcha: bool = True) -> bool:
    """
    Navigate to URL with automatic captcha detection and bypass attempts.
    Returns True if successful, False if blocked.
    """
    try:
        # Navigate
        response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # Check for blocks
        if response and response.status in {403, 429, 503, 520, 521, 522, 524}:
            log.warning("smart_goto_blocked", url=url, status=response.status)
            return False

        # Wait a moment for page to load
        await asyncio.sleep(random.uniform(1, 2))

        # Detect captcha
        captcha = await detect_captcha(page)

        if captcha["detected"]:
            log.warning("captcha_detected", type=captcha["type"], url=url)

            if wait_for_captcha:
                # Attempt bypass based on type
                if captcha["type"] == "Cloudflare" or captcha["type"] == "Cloudflare Turnstile":
                    # Try Turnstile bypass first
                    turnstile_success = await bypass_cloudflare_turnstile(page)
                    if turnstile_success:
                        return True

                    # Otherwise wait for automatic challenge
                    cf_success = await wait_for_cloudflare(page, timeout=30000)
                    return cf_success

                else:
                    # For other captcha types, log and return False
                    log.error("unsupported_captcha", type=captcha["type"])
                    return False
            else:
                return False

        return True

    except Exception as e:
        log.error("smart_goto_error", url=url, error=str(e))
        return False


def get_stealth_browser_args() -> list:
    """
    Get browser launch arguments for maximum stealth.
    """
    return [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-infobars",
        "--window-size=1920,1080",
        "--start-maximized",
        "--disable-extensions",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
    ]
