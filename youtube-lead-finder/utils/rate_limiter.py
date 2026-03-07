import time
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, requests_per_minute=60, daily_quota_limit=10000):
        """
        Intelligent rate limiter for YouTube API with quota tracking.
        YouTube Data API v3 has a quota of 10,000 units per day.
        Search costs 100 units, channel info costs 1 unit per channel.
        """
        self.requests_per_minute = requests_per_minute
        self.daily_quota_limit = daily_quota_limit
        self.requests = []
        self.daily_quota_used = 0
        self.min_interval = 60 / requests_per_minute

    def wait_if_needed(self, estimated_cost=1):
        """Wait if necessary to respect rate limits and quota."""
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
        
        return True  # Proceed

    def get_quota_status(self):
        """Get current quota usage status."""
        return {
            'used': self.daily_quota_used,
            'remaining': self.daily_quota_limit - self.daily_quota_used,
            'percentage': (self.daily_quota_used / self.daily_quota_limit) * 100
        }