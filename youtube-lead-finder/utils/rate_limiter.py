import time
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, requests_per_minute=60, daily_quota_limit=10000):
        """
        Intelligent rate limiter for YouTube API with quota tracking.
        YouTube Data API v3 has a quota of 10,000 units per day.
        Search costs 100 units, channel info costs 1 unit per channel.

        This limiter persists quota usage to the database (metadata table) so
        usage can be displayed via the UI and can be reset manually.
        """
        self.requests_per_minute = requests_per_minute
        self.daily_quota_limit = daily_quota_limit
        self.requests = []
        self.daily_quota_used = 0
        self.min_interval = 60 / requests_per_minute
        self.quota_last_reset = None

        # Load persisted quota state and reset if the day has rolled over
        self._load_quota_state()
        self._maybe_reset_daily_quota()

    def _load_quota_state(self):
        """Load persisted quota usage from the database."""
        try:
            # Avoid circular import by importing locally
            from database.db_manager import DatabaseManager
            import config
            db = DatabaseManager(config.DB_PATH)

            used = db.get_metadata('quota_used')
            if used is not None:
                self.daily_quota_used = int(used)

            last_reset = db.get_metadata('quota_last_reset')
            if last_reset:
                self.quota_last_reset = last_reset
        except Exception as e:
            logger.warning(f"Could not load quota state: {e}")

    def _save_quota_state(self):
        """Persist quota usage to the database."""
        try:
            from database.db_manager import DatabaseManager
            import config
            db = DatabaseManager(config.DB_PATH)

            db.set_metadata('quota_used', str(self.daily_quota_used))
            db.set_metadata('quota_last_reset', self.quota_last_reset or datetime.now().date().isoformat())
        except Exception as e:
            logger.warning(f"Could not save quota state: {e}")

    def _maybe_reset_daily_quota(self):
        """Reset quota usage at the start of a new day."""
        today = datetime.now().date().isoformat()
        if self.quota_last_reset != today:
            self.daily_quota_used = 0
            self.quota_last_reset = today
            self._save_quota_state()

    def reset_quota(self):
        """Reset quota usage manually."""
        self.daily_quota_used = 0
        self.quota_last_reset = datetime.now().date().isoformat()
        self._save_quota_state()

    def get_quota_status(self):
        """Return current quota usage and remaining units."""
        return {
            'used': self.daily_quota_used,
            'remaining': max(0, self.daily_quota_limit - self.daily_quota_used),
            'limit': self.daily_quota_limit,
            'percentage': (self.daily_quota_used / self.daily_quota_limit) * 100 if self.daily_quota_limit else 0,
            'last_reset': self.quota_last_reset,
        }

    def wait_if_needed(self, estimated_cost=1):
        """Wait if necessary to respect rate limits and quota."""
        # Reset quota if a new day has started
        self._maybe_reset_daily_quota()

        now = time.time()
        
        # Check if we would exceed daily quota
        if self.daily_quota_used + estimated_cost > self.daily_quota_limit:
            logger.warning(f"Daily quota would be exceeded. Used: {self.daily_quota_used}, "
                         f"Requested: {estimated_cost}, Limit: {self.daily_quota_limit}")
            return False  # Don't proceed
        
        # Remove old requests outside the 1-minute window
        self.requests = [req for req in self.requests if now - req < 60]
        
        if len(self.requests) >= self.requests_per_minute:
            # Wait until the oldest request is more than 1 minute old
            wait_time = 60 - (now - self.requests[0])
            if wait_time > 0:
                logger.info(f"Rate limit reached, waiting {wait_time:.2f} seconds")
                time.sleep(wait_time)
                # Update now after waiting
                now = time.time()
                self.requests = [req for req in self.requests if now - req < 60]
        
        # Track this request
        self.requests.append(now)
        self.daily_quota_used += estimated_cost
        self._save_quota_state()
        
        return True  # Proceed

    def get_quota_status(self):
        """Get current quota usage status."""
        return {
            'used': self.daily_quota_used,
            'remaining': self.daily_quota_limit - self.daily_quota_used,
            'percentage': (self.daily_quota_used / self.daily_quota_limit) * 100
        }