import logging
from datetime import datetime, timedelta
from api.youtube_api import YouTubeAPI
from modules.email_extractor import EmailExtractor
from config import MIN_SUBSCRIBERS, MAX_SUBSCRIBERS, INACTIVE_DAYS

logger = logging.getLogger(__name__)

class ChannelAnalyzer:
    def __init__(self):
        self.api = YouTubeAPI()
        self.email_extractor = EmailExtractor()

    def analyze_channels_batch(self, channel_ids):
        """Analyze multiple channels efficiently using batch API calls."""
        if not channel_ids:
            return []
        
        # Get all channel data in batches
        all_channel_data = self.api.get_channels_info_batch(channel_ids)
        analyzed_channels = []
        
        for channel_data in all_channel_data.get('items', []):
            try:
                channel_info = self._process_channel_data(channel_data)
                if channel_info:
                    analyzed_channels.append(channel_info)
            except Exception as e:
                logger.error(f"Error processing channel {channel_data.get('id')}: {e}")
                continue
        
        return analyzed_channels

    def analyze_channel(self, channel_id):
        """Analyze a single channel (legacy method for compatibility)."""
        try:
            channel_response = self.api.get_channel_info(channel_id)
            if not channel_response.get('items'):
                logger.warning(f"No data for channel {channel_id}")
                return None
            
            channel_data = channel_response['items'][0]
            return self._process_channel_data(channel_data)
        except Exception as e:
            logger.error(f"Error analyzing channel {channel_id}: {e}")
            return None

    def _process_channel_data(self, channel_data):
        """Process raw channel data into our format."""
        try:
            snippet = channel_data['snippet']
            statistics = channel_data['statistics']

            # Basic info
            channel_id = channel_data['id']
            channel_name = snippet['title']
            description = snippet.get('description', '')
            subscribers = int(statistics.get('subscriberCount', 0))
            video_count = int(statistics.get('videoCount', 0))
            total_views = int(statistics.get('viewCount', 0))
            country = snippet.get('country')  # may be None

            # Filter by subscriber count
            if subscribers < MIN_SUBSCRIBERS or subscribers > MAX_SUBSCRIBERS:
                return None

            # Extract emails
            emails = self.email_extractor.extract_emails(description)
            email = emails[0] if emails else None

            # Calculate metrics without extra API calls
            avg_views = total_views / video_count if video_count > 0 else 0

            # Estimate upload frequency using channel age
            published_at = snippet.get('publishedAt')
            if published_at:
                created = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                weeks = max((datetime.now(created.tzinfo) - created).days / 7, 1)
                upload_freq = video_count / weeks
            else:
                upload_freq = 0

            return {
                'channel_id': channel_id,
                'channel_name': channel_name,
                'subscribers': subscribers,
                'total_views': total_views,
                'video_count': video_count,
                'avg_views': avg_views,
                'email': email,
                'upload_freq': upload_freq,
                'country': country,
                'niche': self._classify_niche(description)
            }

        except Exception as e:
            logger.error(f"Error processing channel data: {e}")
            return None



    def _is_inactive(self, last_upload):
        """Check if channel is inactive based on last upload."""
        if not last_upload:
            return True
        return (datetime.now(last_upload.tzinfo) - last_upload).days > INACTIVE_DAYS

    def _classify_niche(self, description):
        """Simple niche classification based on description keywords."""
        desc_lower = description.lower()
        if 'gaming' in desc_lower or 'game' in desc_lower:
            return 'gaming'
        elif 'tech' in desc_lower or 'coding' in desc_lower or 'programming' in desc_lower:
            return 'tech'
        elif 'fitness' in desc_lower or 'workout' in desc_lower:
            return 'fitness'
        elif 'podcast' in desc_lower or 'talk' in desc_lower:
            return 'podcast'
        else:
            return 'general'