import threading
import time
import logging
from datetime import datetime, timedelta
from modules.keyword_generator import KeywordGenerator
from modules.video_search import VideoSearch
from modules.channel_extractor import ChannelExtractor
from modules.channel_analyzer import ChannelAnalyzer
from modules.email_extractor import EmailExtractor
from modules.lead_scorer import LeadScorer
from database.db_manager import DatabaseManager
from exporters.csv_exporter import CSVExporter
from config import MAX_WORKERS, DB_PATH, LEADS_CSV, MAX_CHANNELS_TO_PROCESS

class DiscoveryService:
    def __init__(self):
        self.status = {
            'is_running': False,
            'current_step': 'idle',
            'progress': 0,
            'channels_found': 0,
            'channels_analyzed': 0,
            'leads_generated': 0,
            'new_channels_found': 0,
            'new_channels_analyzed': 0,
            'new_leads_generated': 0,
            'start_time': None,
            'logs': [],
            'can_stop': False,
            'error': None
        }
        self.thread = None
        self.should_stop = False

    def get_status(self):
        """Return current discovery status for API"""
        return self.status.copy()

    def add_log(self, message, level='info'):
        """Add log message with timestamp"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        log_entry = {
            'timestamp': timestamp,
            'message': message,
            'level': level
        }
        self.status['logs'].append(log_entry)
        # Keep only last 50 logs
        self.status['logs'] = self.status['logs'][-50:]

        # Also log to file
        logger = logging.getLogger(__name__)
        if level == 'error':
            logger.error(message)
        elif level == 'warning':
            logger.warning(message)
        else:
            logger.info(message)

    def start_discovery(self, config_overrides=None):
        """Start discovery in background thread"""
        if self.status['is_running']:
            return {'error': 'Discovery already running'}

        # Reset status
        self.status = {
            'is_running': True,
            'current_step': 'initializing',
            'progress': 0,
            'channels_found': 0,
            'channels_analyzed': 0,
            'leads_generated': 0,
            'new_channels_found': 0,
            'new_channels_analyzed': 0,
            'new_leads_generated': 0,
            'start_time': datetime.now().isoformat(),
            'logs': [],
            'can_stop': True,
            'error': None
        }
        self.should_stop = False

        # Start background thread
        self.thread = threading.Thread(target=self._run_discovery, args=(config_overrides,))
        self.thread.daemon = True
        self.thread.start()

        return {'success': True, 'message': 'Discovery started'}

    def stop_discovery(self):
        """Stop running discovery"""
        if not self.status['is_running']:
            return {'error': 'No discovery running'}

        self.should_stop = True
        self.add_log('Stopping discovery process...', 'warning')
        return {'success': True, 'message': 'Stopping discovery'}

    def _run_discovery(self, config_overrides=None):
        """Main discovery pipeline (runs in background thread)"""
        try:
            self.add_log('Starting YouTube Lead Generation System')

            # Initialize components
            keyword_gen = KeywordGenerator()
            video_search = VideoSearch()
            channel_extractor = ChannelExtractor()
            channel_analyzer = ChannelAnalyzer()
            lead_scorer = LeadScorer()
            db_manager = DatabaseManager(DB_PATH)
            csv_exporter = CSVExporter()

            # Create database tables
            db_manager.create_tables()
            self.add_log('Database initialized')

            # Check for cache reset
            self.status['current_step'] = 'cache_check'
            self.status['progress'] = 5

            last_reset_str = db_manager.get_last_cache_reset()
            if last_reset_str:
                last_reset = datetime.fromisoformat(last_reset_str)
                if datetime.now() - last_reset > timedelta(days=15):
                    self.add_log('15 days since last cache reset - clearing tokens')
                    db_manager.clear_tokens()
                    db_manager.set_last_cache_reset()
            else:
                db_manager.set_last_cache_reset()

            # Step 1: Load and expand keywords
            self.status['current_step'] = 'keyword_expansion'
            self.status['progress'] = 10

            if self.should_stop: return

            keywords = list(keyword_gen.generate_keywords())
            self.add_log(f'Generated {len(keywords)} search keywords')

            # Step 2: Check for channels needing updates
            self.status['current_step'] = 'database_check'
            self.status['progress'] = 15

            if self.should_stop: return

            channels_needing_update = db_manager.get_channels_needing_update(max_age_days=7)
            existing_channel_ids = {row[0] for row in channels_needing_update}
            self.add_log(f'Found {len(existing_channel_ids)} channels needing updates')

            # Step 3: Search for new channels
            self.status['current_step'] = 'searching_channels'
            self.status['progress'] = 20

            new_channel_ids = set()
            total_keywords = len(keywords)

            for i, keyword in enumerate(keywords):
                if self.should_stop: return

                progress = 20 + (i / total_keywords) * 40  # 20-60%
                self.status['progress'] = int(progress)

                self.add_log(f'Searching keyword: "{keyword}" ({i+1}/{total_keywords})')

                # Get stored pagination token
                token = db_manager.get_next_token(keyword)

                response = video_search.search_channels_geographic(
                    keyword,
                    max_results=25,
                    region=config_overrides.get('region') if config_overrides else None,
                    language=config_overrides.get('language') if config_overrides else None,
                    page_token=token
                )

                # Store next token
                next_token = response.get('nextPageToken')
                db_manager.set_next_token(keyword, next_token)

                # Extract channel IDs
                for item in response.get('items', []):
                    ch_id = item.get('snippet', {}).get('channelId')
                    if ch_id:
                        new_channel_ids.add(ch_id)

            # Remove already known channels
            truly_new_channels = new_channel_ids - existing_channel_ids
            all_channels_to_process = list(truly_new_channels) + [row[0] for row in channels_needing_update]

            self.status['channels_found'] = len(new_channel_ids)
            self.status['new_channels_found'] = len(truly_new_channels)
            self.add_log(f'Total channels discovered: {len(new_channel_ids)}')
            self.add_log(f'New channels to analyze: {len(truly_new_channels)}')

            # Limit channels
            limited_channel_ids = all_channels_to_process[:MAX_CHANNELS_TO_PROCESS]
            self.add_log(f'Limited to {len(limited_channel_ids)} channels for processing')

            # Step 4: Analyze channels
            self.status['current_step'] = 'analyzing_channels'
            self.status['progress'] = 65

            analyzed_channels = []
            if limited_channel_ids:
                batch_size = 50
                total_batches = (len(limited_channel_ids) + batch_size - 1) // batch_size

                for i in range(0, len(limited_channel_ids), batch_size):
                    if self.should_stop: return

                    batch = limited_channel_ids[i:i+batch_size]
                    batch_num = i//batch_size + 1

                    progress = 65 + (batch_num / total_batches) * 30  # 65-95%
                    self.status['progress'] = int(progress)

                    self.add_log(f'Processing batch {batch_num}/{total_batches}: {len(batch)} channels')

                    batch_results = channel_analyzer.analyze_channels_batch(batch)
                    analyzed_channels.extend(batch_results)

                    # Count new channels analyzed
                    new_in_batch = [ch for ch in batch_results if ch and ch['channel_id'] in truly_new_channels]
                    self.status['new_channels_analyzed'] += len(new_in_batch)

                    # Update timestamps
                    for channel in batch_results:
                        if channel:
                            db_manager.update_channel_timestamp(channel['channel_id'])

                    self.status['channels_analyzed'] = len(analyzed_channels)

            self.add_log(f'Total channels analyzed: {len(analyzed_channels)}')

            # Step 5: Store and score channels
            self.status['current_step'] = 'scoring_leads'
            self.status['progress'] = 95

            if self.should_stop: return

            for channel in analyzed_channels:
                db_manager.insert_channel(channel)

            all_channels = db_manager.get_all_channels()
            scored_channels = []
            for channel in all_channels:
                score = lead_scorer.score_channel(channel)
                channel['score'] = score
                db_manager.update_channel_score(channel['channel_id'], score)
                scored_channels.append(channel)

            # Step 6: Export qualified leads
            qualified_leads = [ch for ch in scored_channels if ch['score'] > 60 and ch.get('email')]
            csv_exporter.export_leads(qualified_leads, LEADS_CSV)

            self.status['leads_generated'] = len(qualified_leads)
            self.status['new_leads_generated'] = len(qualified_leads)

            # Complete
            self.status['current_step'] = 'completed'
            self.status['progress'] = 100

            self.add_log(f'Discovery completed! Generated {len(qualified_leads)} qualified leads')

        except Exception as e:
            self.status['error'] = str(e)
            self.status['current_step'] = 'error'
            self.add_log(f'Error during discovery: {e}', 'error')

        finally:
            self.status['is_running'] = False
            self.status['can_stop'] = False

# Global instance
discovery_service = DiscoveryService()