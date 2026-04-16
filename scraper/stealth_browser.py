"""
Enhanced browser stealth techniques for bypassing captchas and bot detection.
Uses advanced anti-fingerprinting and browser automation detection bypass methods.
"""
import random
import asyncio
from typing import Optional
from playwright.async_api import Browser, BrowserContext, Page, async_playwright
import structlog

log = structlog.get_logger()

# Extensive user agent pool (real browsers only)
USER_AGENT_POOL = [
    # Chrome on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    # Chrome on Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    # Firefox
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    # Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    # Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
]

# Common screen resolutions (realistic distributions)
SCREEN_RESOLUTIONS = [
    {"width": 1920, "height": 1080},  # Full HD (most common)
    {"width": 1366, "height": 768},   # Laptop standard
    {"width": 1536, "height": 864},   # Windows scaled
    {"width": 1440, "height": 900},   # Mac
    {"width": 2560, "height": 1440},  # 2K
    {"width": 1280, "height": 720},   # HD
]

# Anti-fingerprinting JavaScript injection
STEALTH_SCRIPTS = """
// Override webdriver detection
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
});

// Override plugins to appear more realistic
Object.defineProperty(navigator, 'plugins', {
    get: () => [
        {
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format'
        },
        {
            name: 'Chrome PDF Viewer',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            description: ''
        },
        {
            name: 'Native Client',
            filename: 'internal-nacl-plugin',
            description: ''
        }
    ]
});

// Override permissions
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
);

// Mask chrome automation
if (window.chrome) {
    delete window.chrome.runtime;
}

// Randomize canvas fingerprint slightly
const getImageData = CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData = function(...args) {
    const imageData = getImageData.apply(this, args);
    for (let i = 0; i < imageData.data.length; i += 4) {
        // Add tiny noise that's imperceptible but changes fingerprint
        imageData.data[i] = imageData.data[i] + Math.random() * 0.1;
    }
    return imageData;
};

// Make toString return native code
const oldToString = Function.prototype.toString;
Function.prototype.toString = function() {
    if (this === CanvasRenderingContext2D.prototype.getImageData) {
        return 'function getImageData() { [native code] }';
    }
    return oldToString.call(this);
};

// Languages should match user agent
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en']
});
"""


class StealthBrowser:
    """Enhanced browser with anti-detection capabilities."""

    def __init__(self, proxy_url: Optional[str] = None, headless: bool = True):
        self.proxy_url = proxy_url
        self.headless = headless
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def start(self):
        """Start the browser with stealth settings."""
        self.playwright = await async_playwright().start()

        # Parse proxy settings
        proxy_settings = None
        if self.proxy_url:
            from urllib.parse import urlparse
            parsed = urlparse(self.proxy_url)
            proxy_settings = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
            if parsed.username:
                proxy_settings["username"] = parsed.username
            if parsed.password:
                proxy_settings["password"] = parsed.password
            log.info("using_proxy", proxy=f"{parsed.hostname}:{parsed.port}")

        # Launch with stealth args
        try:
            # Try to use real Chrome first (better for bypassing Cloudflare)
            self.browser = await self.playwright.chromium.launch(
                channel="chrome",
                headless=self.headless,
                proxy=proxy_settings,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins,site-per-process",
                    "--disable-infobars",
                    "--window-size=1920,1080",
                    "--start-maximized",
                    "--disable-extensions",
                    "--disable-default-apps",
                ]
            )
            log.info("browser_launched", type="chrome")
        except Exception as e:
            log.warning("chrome_not_available_using_chromium", error=str(e))
            # Fallback to bundled Chromium
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                proxy=proxy_settings,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins,site-per-process",
                    "--disable-infobars",
                    "--window-size=1920,1080",
                    "--start-maximized",
                ]
            )
            log.info("browser_launched", type="chromium")

        return self.browser

    async def new_context(self, **kwargs) -> BrowserContext:
        """Create a new browser context with stealth settings."""
        if not self.browser:
            await self.start()

        # Random but realistic viewport
        viewport = random.choice(SCREEN_RESOLUTIONS)
        user_agent = random.choice(USER_AGENT_POOL)

        # Merge with user-provided kwargs
        context_options = {
            "viewport": viewport,
            "user_agent": user_agent,
            "locale": "en-US",
            "timezone_id": "America/New_York",
            "permissions": ["geolocation"],
            "geolocation": {"latitude": 6.9271, "longitude": 79.8612},  # Colombo
            "color_scheme": random.choice(["light", "dark"]),
            "device_scale_factor": random.choice([1, 1.5, 2]),
            "has_touch": random.choice([True, False]),
            "is_mobile": False,
            **kwargs
        }

        self.context = await self.browser.new_context(**context_options)

        # Inject stealth scripts
        await self.context.add_init_script(STEALTH_SCRIPTS)

        log.info("context_created", viewport=viewport, user_agent=user_agent[:50])
        return self.context

    async def new_page(self, block_resources: bool = True) -> Page:
        """Create a new page with optional resource blocking."""
        if not self.context:
            await self.new_context()

        page = await self.context.new_page()

        # Block heavy resources to speed up scraping
        if block_resources:
            await page.route("**/*", lambda route: (
                route.abort() if route.request.resource_type in ["image", "media", "font", "stylesheet"]
                else route.continue_()
            ))
            log.debug("resource_blocking_enabled")

        return page

    async def close(self):
        """Close browser and cleanup."""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        log.info("browser_closed")


async def wait_for_cloudflare_challenge(page: Page, timeout: int = 60) -> bool:
    """
    Wait for Cloudflare challenge to complete.
    Returns True if challenge passed, False if timed out.
    """
    log.info("waiting_for_cloudflare_challenge")

    start_time = asyncio.get_event_loop().time()
    while (asyncio.get_event_loop().time() - start_time) < timeout:
        try:
            content = await page.content()
            url = page.url

            # Check if challenge is still active
            challenge_indicators = [
                "checking if the site connection is secure",
                "just a moment",
                "enable javascript and cookies to continue",
                "cf-challenge-running",
                "challenges.cloudflare.com" in url,
            ]

            is_challenged = any(indicator in content.lower() for indicator in challenge_indicators)

            if not is_challenged:
                log.info("cloudflare_challenge_passed")
                return True

            await asyncio.sleep(1)

        except Exception as e:
            log.error("cloudflare_wait_error", error=str(e))
            return False

    log.warning("cloudflare_challenge_timeout")
    return False


async def random_mouse_movement(page: Page):
    """Simulate human-like mouse movement."""
    try:
        # Move mouse to random positions
        for _ in range(random.randint(2, 5)):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.3))
    except Exception:
        pass


async def random_scroll(page: Page):
    """Simulate human-like scrolling behavior."""
    try:
        # Scroll down in chunks
        for _ in range(random.randint(2, 4)):
            scroll_amount = random.randint(300, 600)
            await page.evaluate(f"window.scrollBy(0, {scroll_amount})")
            await asyncio.sleep(random.uniform(0.5, 1.5))

        # Sometimes scroll back up
        if random.random() > 0.7:
            await page.evaluate(f"window.scrollBy(0, -{random.randint(200, 400)})")
            await asyncio.sleep(random.uniform(0.3, 0.8))

    except Exception:
        pass


async def human_like_delay(min_seconds: float = 1.0, max_seconds: float = 3.0):
    """Add human-like delay between actions."""
    delay = random.uniform(min_seconds, max_seconds)
    await asyncio.sleep(delay)
