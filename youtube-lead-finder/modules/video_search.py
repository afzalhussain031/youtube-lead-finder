import logging
from api.youtube_api import YouTubeAPI
from config import MAX_RESULTS

logger = logging.getLogger(__name__)

class VideoSearch:
    def __init__(self):
        self.api = YouTubeAPI()

    def search_videos(self, keyword, max_results=None):
        """Search for videos using the given keyword."""
        try:
            if max_results is None:
                from config import MAX_RESULTS
                max_results = MAX_RESULTS
            response = self.api.search_videos(keyword, max_results)
            return response.get('items', [])
        except Exception as e:
            logger.error(f"Error searching videos for keyword '{keyword}': {e}")
            return []

    def search_channels_geographic(self, keyword, max_results=None, region=None, language=None, page_token=None):
        """Search for channels matching keyword in specified region/language.

        Returns the raw API response so the caller can inspect pagination tokens.
        """
        try:
            if max_results is None:
                from config import MAX_RESULTS
                max_results = MAX_RESULTS
            response = self.api.search_channels_geographic(
                keyword,
                max_results=max_results,
                region=region,
                language=language,
                page_token=page_token
            )
            return response
        except Exception as e:
            logger.error(f"Error searching channels for keyword '{keyword}' geo[{region}/{language}]: {e}")
            return {}
