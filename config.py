import os

# Load environment variables from .env file if it exists
def load_env_file():
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

load_env_file()

# YouTube Data API v3 Key
API_KEY = os.getenv('YOUTUBE_API_KEY')

# API Parameters
MAX_RESULTS = 50  # Max results per search (reduced for testing)
MAX_WORKERS = 10  # Concurrent workers (reduced for testing)
MAX_CHANNELS_TO_PROCESS = 5000  # Limit channels to process (for testing)

# Geographic/Demographic Defaults
DEFAULT_REGION = None         # None for global search, or two-letter ISO country code for regional targeting
DEFAULT_LANGUAGE = None       # None for any language, or two-letter ISO language code for relevance filtering

# Filtering Parameters
MIN_SUBSCRIBERS = 1000  # Minimum subscribers to consider
MAX_SUBSCRIBERS = 1000000  # Maximum subscribers (to avoid huge channels)

# Database
DB_PATH = 'data/channels.db'

# Data Files
KEYWORDS_FILE = 'data/keywords.txt'
LEADS_CSV = 'data/leads.csv'

# Activity Filter
INACTIVE_DAYS = 30  # Days since last upload to consider inactive