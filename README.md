# YouTube Creator Lead Generation System

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![YouTube API](https://img.shields.io/badge/YouTube%20API-v3-red.svg)](https://developers.google.com/youtube/v3)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A scalable Python application that automatically discovers YouTube creators, analyzes their channels, and generates qualified leads for outreach using the YouTube Data API v3. Perfect for content creators, marketers, and businesses looking to connect with YouTube influencers.

## 🚀 Features

- **🔍 Intelligent Keyword Discovery**: Expand base keywords into comprehensive search terms
- **🌍 Flexible Geographic Targeting**: Search globally or target specific regions/countries
- **🗣️ Multi-Language Support**: Filter by language or search across all languages
- **📊 Comprehensive Channel Analysis**: Collect detailed statistics, subscriber counts, and engagement metrics
- **📧 Email Extraction**: Automatically extract business emails from channel descriptions and about sections
- **⭐ Advanced Lead Scoring**: Score channels based on multiple criteria (subscribers, views, activity, demographics)
- **⚡ Concurrent Processing**: Multi-threaded API calls for maximum efficiency
- **🛡️ Smart Rate Limiting**: Respect YouTube API quotas with intelligent request management
- **💾 Intelligent Caching**: Skip already-processed channels to avoid redundant API calls
- **📄 Pagination Persistence**: Store search state to continue where previous runs left off
- **📈 Low-Quota Optimization**: Estimate metrics from available data to minimize API usage
- **🗄️ SQLite Database**: Robust data storage with schema management
- **📊 CSV Export**: Export qualified leads with contact information for easy outreach
- **📝 Comprehensive Logging**: Detailed logs for monitoring and debugging

## 📁 Project Structure

```
youtube-lead-finder/
├── config.py                 # Configuration settings and API parameters
├── main.py                   # Main orchestration script
├── .env                      # Environment variables (API keys)
├── api/
│   └── youtube_api.py        # YouTube API wrapper with rate limiting
├── modules/
│   ├── keyword_generator.py  # Keyword expansion and loading
│   ├── video_search.py       # Video search and channel discovery
│   ├── channel_extractor.py  # Channel ID extraction from search results
│   ├── channel_analyzer.py   # Detailed channel analysis and metrics
│   ├── email_extractor.py    # Email extraction from descriptions
│   ├── lead_scorer.py        # Lead scoring and qualification
│   └── channel_extractor.py  # Channel data extraction
├── database/
│   └── db_manager.py         # SQLite database operations and caching
├── exporters/
│   └── csv_exporter.py       # CSV export with formatting
├── utils/
│   ├── rate_limiter.py       # API rate limiting and quota management
│   └── logger.py             # Logging configuration
├── data/
│   ├── keywords.txt          # Base keywords for search expansion
│   ├── leads.csv             # Exported qualified leads (generated)
│   └── channels.db           # SQLite database (generated)
├── logs/                     # Application logs (generated)
└── requirements.txt          # Python dependencies
```

## 🛠️ Installation

### Prerequisites

- Python 3.8 or higher
- YouTube Data API v3 key (get one from [Google Cloud Console](https://console.cloud.google.com/))

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/youtube-lead-finder.git
   cd youtube-lead-finder
   ```

2. **Create virtual environment**

   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure API Key**
   - Create a `.env` file in the `youtube-lead-finder/` directory
   - Add your YouTube API key:
     ```
     YOUTUBE_API_KEY=your_api_key_here
     ```

5. **Customize Keywords** (Optional)
   - Edit `data/keywords.txt` to add your target keywords
   - The system will automatically expand these into related search terms

## ⚙️ Configuration

Edit `config.py` to customize the system's behavior:

### Geographic and Language Settings

```python
# Search globally or target specific regions
DEFAULT_REGION = None         # None for global, 'US' for USA, 'GB' for UK, etc.
DEFAULT_LANGUAGE = None       # None for any language, 'en' for English, 'es' for Spanish, etc.
```

### Search Parameters

```python
MAX_RESULTS = 50              # Results per API call (max 50)
MAX_WORKERS = 10              # Concurrent threads
MAX_CHANNELS_TO_PROCESS = 5000  # Channel processing limit
```

### Filtering Criteria

```python
MIN_SUBSCRIBERS = 1000        # Minimum subscriber threshold
MAX_SUBSCRIBERS = 1000000     # Maximum subscriber limit
INACTIVE_DAYS = 30            # Days since last upload to consider inactive
```

## 🚀 Usage

### Basic Run

```bash
cd youtube-lead-finder
python main.py
```

### Advanced Usage

- **Target Specific Region**: Set `DEFAULT_REGION = 'US'` in `config.py`
- **Language Filtering**: Set `DEFAULT_LANGUAGE = 'en'` in `config.py`
- **Custom Keywords**: Edit `data/keywords.txt`
- **Monitor Logs**: Check `logs/` directory for detailed execution logs

### Output

- **Database**: `data/channels.db` contains all analyzed channel data
- **Leads**: `data/leads.csv` contains qualified leads with contact information
- **Logs**: `logs/` contains execution logs and any errors

## 📊 Lead Scoring System

Channels are scored on a 0-100 scale based on:

- **Subscriber Count** (0-40 points): Higher subscribers = higher score
- **View Count** (0-30 points): Total channel views
- **Upload Frequency** (0-10 points): Recent activity bonus
- **Email Availability** (0-20 points): Contact information found
- **Demographic Match** (0-10 points): Region/language alignment

Only channels scoring above a threshold are exported as leads.

## 🔧 API Quota Management

The system is designed to work within YouTube API quotas:

- **Daily Limit**: 10,000 units (default quota)
- **Cost Estimation**: Automatically calculates request costs
- **Rate Limiting**: Prevents quota exhaustion
- **Caching**: Avoids duplicate API calls
- **Batch Processing**: Efficient channel analysis in batches

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

- This tool is for educational and business outreach purposes only
- Respect YouTube's Terms of Service and API usage policies
- Ensure compliance with data protection regulations (GDPR, CCPA, etc.)
- Use extracted contact information responsibly and ethically

## 🆘 Troubleshooting

### Common Issues

- **API Key Errors**: Verify your `.env` file and API key validity
- **Quota Exceeded**: Wait for quota reset or upgrade your API plan
- **No Leads Generated**: Check keyword relevance and filtering criteria
- **Database Errors**: Ensure write permissions in the `data/` directory

### Getting Help

- Check the logs in `logs/` for detailed error messages
- Verify your YouTube API key has the necessary permissions
- Ensure all dependencies are installed correctly

## 📈 Future Enhancements

- [ ] Web dashboard for monitoring and configuration
- [ ] Integration with CRM systems
- [ ] Advanced demographic analysis
- [ ] Social media cross-linking
- [ ] Automated outreach templates
- [ ] Machine learning-based lead scoring

---

**Made with ❤️ for content creators and marketers**

2. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Get YouTube API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable YouTube Data API v3
   - Create credentials (API Key)
   - Copy the API key

4. **Set Environment Variable**:

   ```bash
   export YOUTUBE_API_KEY="your_api_key_here"
   ```

   Or create a `.env` file in the project root with:

   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```

5. **Customize Keywords**:
   Edit `data/keywords.txt` to add your target niche keywords.

6. **Configure Settings**:
   Edit `config.py` to adjust parameters like subscriber ranges, scoring weights, etc.
   - **Region and Language Targeting**: Set `DEFAULT_REGION` and `DEFAULT_LANGUAGE` for flexible searches.
     - `DEFAULT_REGION = None` for global searches (worldwide).
     - `DEFAULT_REGION = 'US'` (or another ISO code like 'GB') for country-specific targeting.
     - `DEFAULT_LANGUAGE = 'en'` for English relevance, or `None` for no language filter.

## Usage

Run the main script:

```bash
python main.py
```

The system will:

1. Load keywords from `data/keywords.txt`
2. Search YouTube for videos using each keyword
3. Extract unique channel IDs
4. Analyze each channel (stats, emails, activity)
5. Score channels based on lead quality
6. Store results in SQLite database
7. Export qualified leads (score > 60 **AND email present**) to `data/leads.csv`

## Output

The script will display:

```
Channels discovered: 3200
Channels analyzed: 1100
Qualified leads: 340
```

## Database Schema

The SQLite database (`data/channels.db`) contains a `channels` table with:

A new `search_state` table also tracks pagination tokens for each keyword, enabling incremental
searching and reducing redundant API calls. The `get_next_token` and `set_next_token` helper
methods in `db_manager.py` manage this state.

- `channel_id`: YouTube channel ID
- `channel_name`: Channel title
- `subscribers`: Subscriber count
- `total_views`: Total channel views
- `video_count`: Number of videos
- `avg_views`: Average views per recent video
- `email`: Extracted email address
- `last_upload`: Date of last video upload
- `score`: Lead quality score (0-100)
- `niche`: Classified niche category

## Scoring Algorithm

Channels are scored based on:

- **Subscribers** (30%): Ideal range 10K-100K
- **Average Views** (30%): Higher is better (>5K preferred)
- **Upload Frequency** (20%): Weekly uploads preferred
- **Email Availability** (20%): Bonus for having contact email

## API Quota Management

- Uses rate limiting to stay within YouTube API quotas
- Implements exponential backoff for failed requests
- Concurrent processing with configurable worker threads
- Automatic retry logic for transient failures

## Customization

### Resetting & Re‑seeding the Cache

Over time the `search_state` table accumulates tokens and the system will
continue each keyword’s search where it left off. To avoid the “tunnel
vision” effect described earlier you can periodically clear tokens and
re‑run searches from scratch:

1. **Automatic reset** - the script now checks every run if 15 days have
   passed since the last cache reset. If so, it clears all tokens and
   updates the `last_cache_reset` timestamp in the `metadata` table.
   This ensures a full sweep every 15 days without manual intervention.

2. **Programmatic reset** - call the new helper in `db_manager.py`:

   ```python
   db_manager.clear_tokens('some keyword')   # single keyword
   db_manager.clear_tokens()                # everything
   ```

   This is useful when you add or modify filters, or when you just want
   to re‑scan the entire index for a fresh batch of creators.

3. **Manual SQL** - open `data/channels.db` with `sqlite3` and run:

   ```sql
   DELETE FROM search_state WHERE keyword = '...' ;
   -- or to wipe all tokens:
   DELETE FROM search_state;
   ```

4. **Scheduled purge** - if you prefer automatic maintenance you can
   extend the script with a time‑based check that clears tokens older than
   X days (add a `last_updated` column to `search_state` and delete
   accordingly).

5. **Keyword rotation** - whenever you change the keyword list, clear the
   entire state so old tokens don’t reference obsolete queries.

By treating the token cache as mutable state rather than a permanent
record, you balance efficiency with completeness. A good pattern is to
clear tokens once per week or after making any significant configuration
change.

### Adding Keywords

Add more keywords to `data/keywords.txt`, one per line.

### Adjusting Scoring

Modify weights and thresholds in `config.py`:

```python
SCORE_WEIGHTS = {
    'subscribers': 0.3,
    'avg_views': 0.3,
    'upload_freq': 0.2,
    'email': 0.2
}
```

### Filtering Parameters

Adjust channel filtering in `config.py`:

```python
MIN_SUBSCRIBERS = 1000
MAX_SUBSCRIBERS = 1000000
INACTIVE_DAYS = 30
```

## Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure `YOUTUBE_API_KEY` environment variable is set
2. **Quota Exceeded**: YouTube API has daily limits. The system includes rate limiting
3. **No Results**: Check keywords are relevant and API key has proper permissions
4. **Database Errors**: Ensure write permissions in the data directory

### Logs

Check `logs/youtube-lead-finder.log` for detailed execution information.

## License

This project is for educational and commercial use. Please respect YouTube's Terms of Service and API usage policies.
