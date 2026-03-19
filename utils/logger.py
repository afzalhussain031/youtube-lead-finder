import logging
import os

def setup_logger(log_level=logging.INFO):
    """Setup logging configuration."""
    # Create logs directory if it doesn't exist
    log_dir = 'logs'
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure logging
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(log_dir, 'youtube_lead_finder.log')),
            logging.StreamHandler()
        ]
    )