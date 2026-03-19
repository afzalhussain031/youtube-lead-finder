import csv
import logging
import os

logger = logging.getLogger(__name__)

class CSVExporter:
    def __init__(self):
        pass

    def export_leads(self, leads, filename):
        """Export qualified leads to CSV."""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(filename), exist_ok=True)
            
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = [
                    'channel_id', 'channel_name', 'subscribers', 'total_views', 'video_count', 
                    'avg_views', 'upload_freq', 'email', 'score',
                    'niche', 'country', 'about_snippet', 'channel_link', 'extracted_emails'
                ]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                writer.writeheader()
                for lead in leads:
                    writer.writerow({
                        'channel_id': lead.get('channel_id', ''),
                        'channel_name': lead.get('channel_name', ''),
                        'subscribers': lead.get('subscribers', 0),
                        'total_views': lead.get('total_views', 0),
                        'video_count': lead.get('video_count', 0),
                        'avg_views': lead.get('avg_views', 0),
                        'upload_freq': lead.get('upload_freq', 0),
                        'email': lead.get('email', ''),
                        'score': lead.get('score', 0),
                        'niche': lead.get('niche', 'N/A'),
                        'country': lead.get('country') or 'N/A',
                        'about_snippet': str(lead.get('about_snippet', '')).replace('\n', ' ').strip() or 'N/A',
                        'channel_link': lead.get('channel_link', 'N/A'),
                        'extracted_emails': lead.get('extracted_emails', 'N/A')
                    })
            
            logger.info(f"Exported {len(leads)} leads to {filename}")
        
        except Exception as e:
            logger.error(f"Error exporting leads to CSV: {e}")
            raise