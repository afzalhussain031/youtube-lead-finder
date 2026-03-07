import requests
import time
import logging
from config import API_KEY
from utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

class YouTubeAPI:
    def __init__(self):
        self.api_key = API_KEY
        self.base_url = "https://www.googleapis.com/youtube/v3"
        self.rate_limiter = RateLimiter()

    def _make_request(self, endpoint, params):
        """Make a request to YouTube API with enhanced rate limiting and quota tracking."""
        # Estimate cost based on endpoint
        estimated_cost = self._estimate_request_cost(endpoint, params)
        
        # Check quota before proceeding
        if not self.rate_limiter.wait_if_needed(estimated_cost):
            raise Exception(f"Daily quota would be exceeded. Request cost: {estimated_cost}")
        
        url = f"{self.base_url}/{endpoint}"
        params['key'] = self.api_key
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.get(url, params=params, timeout=30)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                logger.warning(f"API request failed (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    raise e

    def _estimate_request_cost(self, endpoint, params):
        """Estimate the quota cost of a request."""
        if endpoint == 'search':
            return 100  # Search requests cost 100 units
        elif endpoint == 'channels':
            # Channel requests cost 1 unit per channel
            channel_ids = params.get('id', '')
            if ',' in channel_ids:
                # Batch request - cost equals number of channels
                return len(channel_ids.split(','))
            else:
                # Single channel request
                return 1
        else:
            return 1  # Default cost

    def search_videos(self, query, max_results=50, page_token=None):
        """Search for videos using the search endpoint with optimized parameters.

        Optionally continue a previous result set by supplying a `page_token`.
        """
        from datetime import datetime, timedelta
        
        # Only search for content from last 2 years for relevance
        two_years_ago = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        params = {
            'part': 'snippet',
            'type': 'video',
            'maxResults': max_results,
            'q': query,
            'order': 'relevance',  # Prioritize most relevant results
            'publishedAfter': two_years_ago,  # Only recent content
            'videoDuration': 'medium',  # Avoid very short/long videos
            'safeSearch': 'strict'  # Filter inappropriate content
        }
        if page_token:
            params['pageToken'] = page_token
        return self._make_request('search', params)

    def search_channels_geographic(self, query, max_results=50, region=None, language=None, page_token=None):
        """Search for channels targeting a specific region and language.

        Accepts an optional `page_token` which corresponds to YouTube's
        `nextPageToken` value. If supplied, the request will continue from
        that point in the result set. The calling code is responsible for
        storing and retrieving tokens (e.g. via the database manager).
        """
        params = {
            'part': 'snippet',
            'type': 'channel',
            'maxResults': max_results,
            'q': query,
            'order': 'relevance'
        }
        if region:
            params['regionCode'] = region
        if language:
            params['relevanceLanguage'] = language
        if page_token:
            params['pageToken'] = page_token
        return self._make_request('search', params)

    def get_channel_info(self, channel_id):
        """Get channel information."""
        params = {
            'part': 'snippet,statistics',
            'id': channel_id
        }
        response = self._make_request('channels', params)
        return response

    def get_channels_info_batch(self, channel_ids):
        """Get multiple channels info in one API call (up to 50 per request)."""
        if not channel_ids:
            return {'items': []}
        
        # Split into batches of 50 (YouTube API limit)
        batches = [channel_ids[i:i+50] for i in range(0, len(channel_ids), 50)]
        all_items = []
        
        for batch in batches:
            params = {
                'part': 'snippet,statistics',
                'id': ','.join(batch)
            }
            response = self._make_request('channels', params)
            all_items.extend(response.get('items', []))
        
        return {'items': all_items}

    def get_channel_videos(self, channel_id, max_results=10):
        """Get recent videos from a channel."""
        params = {
            'part': 'snippet',
            'channelId': channel_id,
            'maxResults': max_results,
            'order': 'date'
        }
        return self._make_request('search', params)