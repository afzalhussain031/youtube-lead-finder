import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from modules.keyword_generator import KeywordGenerator
from modules.video_search import VideoSearch
from modules.channel_extractor import ChannelExtractor
from modules.channel_analyzer import ChannelAnalyzer
from modules.email_extractor import EmailExtractor
from modules.lead_scorer import LeadScorer
from database.db_manager import DatabaseManager
from exporters.csv_exporter import CSVExporter
from utils.logger import setup_logger
from config import MAX_WORKERS, DB_PATH, LEADS_CSV, MAX_CHANNELS_TO_PROCESS
from datetime import datetime, timedelta

def main():
    setup_logger()
    logger = logging.getLogger(__name__)

    logger.info("Starting Optimized YouTube Lead Generation System")

    # Initialize components
    keyword_gen = KeywordGenerator()
    video_search = VideoSearch()
    channel_extractor = ChannelExtractor()
    channel_analyzer = ChannelAnalyzer()
    lead_scorer = LeadScorer()
    db_manager = DatabaseManager(DB_PATH)
    csv_exporter = CSVExporter()

    # Create database tables (with new schema)
    db_manager.create_tables()

    # Automatic cache reset every 15 days
    last_reset_str = db_manager.get_last_cache_reset()
    if last_reset_str:
        last_reset = datetime.fromisoformat(last_reset_str)
        if datetime.now() - last_reset > timedelta(days=15):
            logger.info("15 days since last cache reset - clearing all pagination tokens")
            db_manager.clear_tokens()
            db_manager.set_last_cache_reset()
    else:
        # First run, set initial reset time
        db_manager.set_last_cache_reset()

    # Step 1: Load and expand keywords
    keywords = list(keyword_gen.generate_keywords())
    logger.info(f"Generated {len(keywords)} search keywords from base keywords")

    # Step 2: Check for channels needing updates (incremental system)
    channels_needing_update = db_manager.get_channels_needing_update(max_age_days=7)  # Weekly updates
    existing_channel_ids = {row[0] for row in channels_needing_update}
    logger.info(f"Found {len(existing_channel_ids)} channels needing updates")

    # Step 2: Search channels geographically and extract IDs
    from config import DEFAULT_REGION, DEFAULT_LANGUAGE

    new_channel_ids = set()
    for keyword in keywords:
        region_display = DEFAULT_REGION if DEFAULT_REGION else 'global'
        logger.info(f"Searching for keyword: '{keyword}' (region={region_display}, lang={DEFAULT_LANGUAGE})")
        # retrieve stored pagination token (if any) so we continue where we left off
        token = db_manager.get_next_token(keyword)
        if token:
            logger.debug(f"Using stored page token for '{keyword}': {token}")

        response = video_search.search_channels_geographic(
            keyword,
            max_results=25,     # limit for efficiency
            region=DEFAULT_REGION,
            language=DEFAULT_LANGUAGE,
            page_token=token
        )

        # extract token for next run and persist it
        next_token = response.get('nextPageToken')
        db_manager.set_next_token(keyword, next_token)

        # each item is a search result with snippet containing channelId
        for item in response.get('items', []):
            ch_id = item.get('snippet', {}).get('channelId')
            if ch_id:
                new_channel_ids.add(ch_id)

    # Remove channels we already have fresh data for
    truly_new_channels = new_channel_ids - existing_channel_ids
    all_channels_to_process = list(truly_new_channels) + [row[0] for row in channels_needing_update]

    logger.info(f"Total unique channels discovered: {len(new_channel_ids)}")
    logger.info(f"New channels to analyze: {len(truly_new_channels)}")
    logger.info(f"Existing channels to refresh: {len(channels_needing_update)}")

    # Limit channels for testing (can be increased in production)
    limited_channel_ids = all_channels_to_process[:MAX_CHANNELS_TO_PROCESS]
    logger.info(f"Limited to {len(limited_channel_ids)} channels for processing")

    # Step 4: Analyze channels in batches (optimized)
    analyzed_channels = []
    if limited_channel_ids:
        # Process in batches of 50 (YouTube API limit)
        batch_size = 50
        for i in range(0, len(limited_channel_ids), batch_size):
            batch = limited_channel_ids[i:i+batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}: {len(batch)} channels")
            
            batch_results = channel_analyzer.analyze_channels_batch(batch)
            analyzed_channels.extend(batch_results)
            
            # Update timestamps for processed channels
            for channel in batch_results:
                if channel:
                    db_manager.update_channel_timestamp(channel['channel_id'])

    logger.info(f"Total channels analyzed: {len(analyzed_channels)}")

    # Step 5: Store/update in database
    for channel in analyzed_channels:
        db_manager.insert_channel(channel)

    # Step 6: Score all channels in database
    all_channels = db_manager.get_all_channels()
    scored_channels = []
    for channel in all_channels:
        score = lead_scorer.score_channel(channel)
        channel['score'] = score
        db_manager.update_channel_score(channel['channel_id'], score)
        scored_channels.append(channel)

    # Step 7: Export qualified leads (now requires email)
    qualified_leads = [ch for ch in scored_channels if ch['score'] > 60 and ch.get('email')]
    csv_exporter.export_leads(qualified_leads, LEADS_CSV)

    logger.info(f"Qualified leads exported: {len(qualified_leads)}")
    logger.info("Optimized YouTube Lead Generation System completed")

    # Print enhanced summary
    total_channels = db_manager.get_channel_count()
    print(f"Total channels in database: {total_channels}")
    print(f"Channels discovered this run: {len(new_channel_ids)}")
    print(f"Channels analyzed this run: {len(analyzed_channels)}")
    print(f"Qualified leads: {len(qualified_leads)}")

if __name__ == "__main__":
    main()