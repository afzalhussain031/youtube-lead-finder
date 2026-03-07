import logging
from config import KEYWORDS_FILE

logger = logging.getLogger(__name__)

class KeywordGenerator:
    def __init__(self):
        self.keywords_file = KEYWORDS_FILE
        
        # Keyword expansion mappings for better search results
        self.expansions = {
            'gaming': ['gaming', 'game review', 'gaming tips', 'gameplay', 'gaming news'],
            'tech review': ['tech review', 'product review', 'gadget review', 'technology review'],
            'fitness': ['fitness', 'workout', 'exercise', 'gym', 'health'],
            'cooking': ['cooking', 'recipe', 'food', 'kitchen', 'baking'],
            'travel': ['travel', 'vacation', 'tourism', 'adventure', 'destination']
        }

    def generate_keywords(self):
        """Read keywords from file and expand them for better search results."""
        try:
            with open(self.keywords_file, 'r', encoding='utf-8') as f:
                base_keywords = [line.strip() for line in f if line.strip()]
            
            # Expand keywords for better coverage
            expanded_keywords = []
            for keyword in base_keywords:
                keyword_lower = keyword.lower()
                
                # If we have expansions for this keyword, use them
                if keyword_lower in self.expansions:
                    # Limit to 3 expansions per base keyword to control API usage
                    expanded_keywords.extend(self.expansions[keyword_lower][:3])
                else:
                    # Use the original keyword
                    expanded_keywords.append(keyword)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_keywords = []
            for kw in expanded_keywords:
                if kw not in seen:
                    seen.add(kw)
                    unique_keywords.append(kw)
                    yield kw
                    
        except FileNotFoundError:
            logger.error(f"Keywords file not found: {self.keywords_file}")
            raise
        except Exception as e:
            logger.error(f"Error reading keywords file: {e}")
            raise