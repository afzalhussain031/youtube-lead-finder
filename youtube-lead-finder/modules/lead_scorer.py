import logging

logger = logging.getLogger(__name__)

class LeadScorer:
    def score_channel(self, channel_data):
        """Score a channel based on lead quality criteria."""
        try:
            subscribers = channel_data.get('subscribers', 0)
            avg_views = channel_data.get('avg_views', 0)
            upload_freq = channel_data.get('upload_freq', 0)  # uploads per week
            email = channel_data.get('email')

            # Subscriber score (0-30)
            if 10000 <= subscribers <= 100000:
                sub_score = 30
            elif 1000 <= subscribers < 10000:
                sub_score = 20
            elif subscribers > 100000:
                sub_score = 25  # Penalize very large channels
            else:
                sub_score = 0

            # Average views score (0-30)
            if avg_views > 5000:
                view_score = 30
            elif avg_views > 1000:
                view_score = 20
            elif avg_views > 500:
                view_score = 10
            else:
                view_score = 0

            # Upload frequency score (0-20)
            if upload_freq >= 1:  # At least weekly
                freq_score = 20
            elif upload_freq >= 0.5:  # Bi-weekly
                freq_score = 15
            elif upload_freq > 0:
                freq_score = 10
            else:
                freq_score = 0

            # Email availability score (0-20)
            email_score = 20 if email else 0

            # Geographic/demographic score (0-10)
            from config import DEFAULT_REGION, DEFAULT_LANGUAGE
            dem_score = 0
            country = channel_data.get('country')
            if DEFAULT_REGION and country and country.lower() == DEFAULT_REGION.lower():
                dem_score += 10  # bonus for matching region (only if region is specified)
            # simple language hint: check for common English words if default language is en
            if DEFAULT_LANGUAGE == 'en':
                name = channel_data.get('channel_name', '').lower()
                if any(word in name for word in ['the', 'and', 'channel', 'video']):
                    dem_score += 0  # we could add but keep neutral

            # Total score (sum all points directly for 0-100 scale)
            total_score = sub_score + view_score + freq_score + email_score + dem_score

            return round(total_score)

        except Exception as e:
            logger.error(f"Error scoring channel {channel_data.get('channel_id')}: {e}")
            return 0