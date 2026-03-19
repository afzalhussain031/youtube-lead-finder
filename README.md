# YouTube Lead Finder

A comprehensive tool for discovering, analyzing, and managing YouTube channel leads for business outreach and networking. Built with Flask and the YouTube Data API v3, this application automates the process of finding relevant YouTube channels, extracting contact information, and managing lead generation campaigns.

## 🚀 Features

### Lead Discovery Pipeline

- **Intelligent Keyword Generation**: Automatically expands base keywords into comprehensive search terms
- **YouTube API Integration**: Searches videos and extracts channel information using YouTube Data API v3
- **Channel Analysis**: Analyzes subscriber counts, upload activity, and channel metrics
- **Email Extraction**: Automatically finds and validates email addresses from channel descriptions and about pages
- **Lead Scoring**: Intelligent scoring system based on channel relevance, engagement, and business potential

### Web Dashboard

- **Real-time Discovery Status**: Monitor discovery progress with live updates
- **Interactive Lead Management**: View, filter, and manage discovered leads
- **Email Campaign Management**: Send personalized emails to leads with customizable templates
- **Quota Tracking**: Monitor YouTube API usage and remaining quota
- **CSV Export**: Export leads to CSV for external use

### Advanced Features

- **Incremental Updates**: Smart caching system that updates channel data efficiently
- **Geographic Targeting**: Filter channels by region and language
- **Subscriber Filtering**: Target channels within specific subscriber ranges
- **Rate Limiting**: Built-in rate limiting to respect API quotas
- **Activity Monitoring**: Track channel activity and filter inactive channels

## 📋 Prerequisites

- Python 3.8 or higher
- YouTube Data API v3 key (obtain from [Google Cloud Console](https://console.cloud.google.com/))
- Internet connection for API calls

## 🛠️ Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/afzalhussain031/youtube-lead-finder.git
   cd youtube-lead-finder
   ```

2. **Navigate to the project directory:**

   ```bash
   cd youtube-lead-finder
   ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   Create a `.env` file in the project root with your YouTube API key:

   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```

5. **Configure keywords:**
   Edit `data/keywords.txt` with your target keywords (one per line).

## ⚙️ Configuration

### API Configuration (`config.py`)

- `API_KEY`: Your YouTube Data API v3 key
- `MAX_RESULTS`: Results per search (default: 50)
- `MAX_WORKERS`: Concurrent API calls (default: 10)
- `MAX_CHANNELS_TO_PROCESS`: Channel processing limit (default: 5000)

### Filtering Options

- `MIN_SUBSCRIBERS` / `MAX_SUBSCRIBERS`: Subscriber range filtering
- `DEFAULT_REGION`: Geographic targeting (ISO country code)
- `DEFAULT_LANGUAGE`: Language filtering (ISO language code)
- `INACTIVE_DAYS`: Days since last upload to consider inactive

## 🚀 Usage

### Running the Application

1. **Start the Flask web application:**

   ```bash
   python app.py
   ```

2. **Open your browser and navigate to:**
   ```
   http://localhost:5000
   ```

### Using the Web Dashboard

1. **Discovery Pipeline:**
   - Click "🚀 Run Discovery" to start finding leads
   - Monitor progress in the discovery status section
   - View discovered leads in the table below

2. **Lead Management:**
   - Filter leads by score, subscribers, or keywords
   - View detailed channel information
   - Export leads to CSV

3. **Email Campaigns:**
   - Select leads to contact
   - Choose email templates
   - Send personalized emails

### Command Line Usage

For batch processing without the web interface:

```bash
python main.py
```

## 📊 Data Structure

### Database Schema

- **channels**: Channel metadata, subscriber counts, upload activity
- **videos**: Video information for activity tracking
- **leads**: Processed leads with scores and contact info
- **quota_tracking**: API usage monitoring

### Output Files

- `data/leads.csv`: Exported lead data
- `data/sent_log.csv`: Email sending history
- `logs/`: Application logs

## 🔧 API Integration

### YouTube Data API v3

The application uses the following API endpoints:

- `search.list`: Video search with keyword filtering
- `channels.list`: Channel information retrieval
- `videos.list`: Video metadata for activity analysis

### Quota Management

- Daily quota: 10,000 units
- Cost per search: 100 units
- Cost per channel lookup: 1 unit
- Automatic quota tracking and warnings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Run tests
python -m pytest

# Format code
black .
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for educational and business outreach purposes only. Always respect YouTube's Terms of Service, privacy policies, and applicable laws when collecting and using contact information. The developers are not responsible for misuse of this tool.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/afzalhussain031/youtube-lead-finder/issues)
- **Documentation**: Check the inline code comments and this README
- **API Documentation**: [YouTube Data API v3 Docs](https://developers.google.com/youtube/v3/docs)

## 🔄 Version History

- **v1.0.0**: Initial release with core discovery and email features
- **v1.1.0**: Added web dashboard and real-time monitoring
- **v1.2.0**: Improved lead scoring and filtering options

---

**Built with ❤️ for efficient YouTube lead generation**</content>
<parameter name="filePath">c:\Users\afzal\OneDrive\Desktop\Studies\Projects\youtube-lead-finder\README.md
