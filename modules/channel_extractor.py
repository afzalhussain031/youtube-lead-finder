import logging

logger = logging.getLogger(__name__)

class ChannelExtractor:
    def __init__(self):
        self.unique_channels = set()
        # Channels to skip based on suspicious patterns
        self.skip_patterns = [
            'test', 'spam', 'bot', 'fake', 'scam', 'hack', 'exploit',
            'free money', 'make money fast', 'earn money', 'cash',
            'adult', 'porn', 'xxx', 'nsfw'
        ]

    def extract_channels(self, videos):
        """Extract unique channel IDs from video search results with pre-filtering."""
        channel_ids = set()
        for video in videos:
            try:
                snippet = video['snippet']
                channel_id = snippet['channelId']
                channel_title = snippet.get('channelTitle', '').lower()
                
                # Pre-filter suspicious channels
                if any(pattern in channel_title for pattern in self.skip_patterns):
                    continue
                
                # Skip channels with very generic names
                if len(channel_title.strip()) < 3:
                    continue
                    
                channel_ids.add(channel_id)
                
            except KeyError:
                logger.warning("Video missing channelId or channelTitle")
                continue
        
        # Update global unique set
        self.unique_channels.update(channel_ids)
        return channel_ids

    def get_all_unique_channels(self):
        """Get all unique channels collected so far."""
        return self.unique_channels