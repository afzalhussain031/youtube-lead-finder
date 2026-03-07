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
                fieldnames = ['channel_name', 'subscribers', 'avg_views', 'email', 'score']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                writer.writeheader()
                for lead in leads:
                    writer.writerow({
                        'channel_name': lead.get('channel_name', ''),
                        'subscribers': lead.get('subscribers', 0),
                        'avg_views': lead.get('avg_views', 0),
                        'email': lead.get('email', ''),
                        'score': lead.get('score', 0)
                    })
            
            logger.info(f"Exported {len(leads)} leads to {filename}")
        
        except Exception as e:
            logger.error(f"Error exporting leads to CSV: {e}")
            raise