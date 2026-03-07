import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, db_path):
        self.db_path = db_path

    def _get_connection(self):
        """Get database connection."""
        return sqlite3.connect(self.db_path)

    def create_tables(self):
        """Create necessary tables with enhanced schema."""
        with self._get_connection() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS channels (
                    channel_id TEXT PRIMARY KEY,
                    channel_name TEXT,
                    subscribers INTEGER,
                    total_views INTEGER,
                    video_count INTEGER,
                    avg_views REAL,
                    email TEXT,
                    score INTEGER,
                    niche TEXT,
                    upload_freq REAL,
                    country TEXT,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # table for storing nextPageToken per keyword
            conn.execute('''
                CREATE TABLE IF NOT EXISTS search_state (
                    keyword TEXT PRIMARY KEY,
                    next_token TEXT,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # metadata table for global settings like last cache reset
            conn.execute('''
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            ''')
            # initialize last_cache_reset if not exists
            cursor = conn.execute("SELECT value FROM metadata WHERE key = 'last_cache_reset'")
            if not cursor.fetchone():
                conn.execute("INSERT INTO metadata(key, value) VALUES('last_cache_reset', datetime('now'))")
            logger.info("Database tables created")

    def insert_channel(self, channel_data):
        """Insert channel data into database."""
        try:
            with self._get_connection() as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO channels 
                    (channel_id, channel_name, subscribers, total_views, video_count, 
                     avg_views, email, score, niche, upload_freq, country)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    channel_data['channel_id'],
                    channel_data['channel_name'],
                    channel_data['subscribers'],
                    channel_data['total_views'],
                    channel_data['video_count'],
                    channel_data['avg_views'],
                    channel_data.get('email'),
                    channel_data.get('score', 0),
                    channel_data.get('niche', 'general'),
                    channel_data.get('upload_freq', 0),
                    channel_data.get('country')
                ))
        except Exception as e:
            logger.error(f"Error inserting channel {channel_data.get('channel_id')}: {e}")

    def update_channel_score(self, channel_id, score):
        """Update channel score."""
        try:
            with self._get_connection() as conn:
                conn.execute('UPDATE channels SET score = ? WHERE channel_id = ?', (score, channel_id))
        except Exception as e:
            logger.error(f"Error updating score for channel {channel_id}: {e}")

    def get_all_channels(self):
        """Get all channels from database."""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute('SELECT * FROM channels')
                columns = [desc[0] for desc in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error fetching channels: {e}")
            return []

    def get_qualified_leads(self, min_score=60):
        """Get channels with score above threshold."""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute('SELECT * FROM channels WHERE score > ?', (min_score,))
                columns = [desc[0] for desc in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error fetching qualified leads: {e}")
            return []

    def get_channels_needing_update(self, max_age_days=30):
        """Get channels that haven't been updated recently."""
        from datetime import datetime, timedelta
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        
        with self._get_connection() as conn:
            cursor = conn.execute('''
                SELECT channel_id, channel_name, subscribers FROM channels 
                WHERE last_updated < ? OR last_updated IS NULL
                ORDER BY last_updated ASC
            ''', (cutoff_date,))
            return cursor.fetchall()

    def update_channel_timestamp(self, channel_id):
        """Update last checked timestamp for a channel."""
        with self._get_connection() as conn:
            conn.execute('''
                UPDATE channels SET last_updated = CURRENT_TIMESTAMP 
                WHERE channel_id = ?
            ''', (channel_id,))

    def get_channel_count(self):
        """Get total number of channels in database."""
        with self._get_connection() as conn:
            cursor = conn.execute('SELECT COUNT(*) FROM channels')
            return cursor.fetchone()[0]

    # search_state helpers
    def get_next_token(self, keyword):
        """Retrieve stored nextPageToken for a keyword."""
        with self._get_connection() as conn:
            cursor = conn.execute('SELECT next_token FROM search_state WHERE keyword = ?', (keyword,))
            row = cursor.fetchone()
            return row[0] if row else None

    def set_next_token(self, keyword, token):
        """Store or update the nextPageToken for a keyword.

        If token is None or empty, remove any existing record so the next
        search will start from the beginning again.
        """
        with self._get_connection() as conn:
            if token:
                conn.execute('''
                    INSERT OR REPLACE INTO search_state(keyword, next_token)
                    VALUES(?, ?)
                ''', (keyword, token))
            else:
                conn.execute('DELETE FROM search_state WHERE keyword = ?', (keyword,))

    def clear_tokens(self, keyword=None):
        """Remove pagination state.

        - If a keyword is provided, delete only that entry.
        - If no keyword is given, clear the entire table, effectively
          re‑seeding all queries.
        """
        with self._get_connection() as conn:
            if keyword:
                conn.execute('DELETE FROM search_state WHERE keyword = ?', (keyword,))
            else:
                conn.execute('DELETE FROM search_state')

    def get_last_cache_reset(self):
        """Get the timestamp of the last cache reset."""
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT value FROM metadata WHERE key = 'last_cache_reset'")
            row = cursor.fetchone()
            return row[0] if row else None

    def set_last_cache_reset(self, timestamp=None):
        """Update the last cache reset timestamp."""
        if timestamp is None:
            timestamp = datetime.now().isoformat()
        with self._get_connection() as conn:
            conn.execute("INSERT OR REPLACE INTO metadata(key, value) VALUES('last_cache_reset', ?)", (timestamp,))

