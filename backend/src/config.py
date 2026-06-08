import os


class Config:
    MONGO_URI = os.getenv("MONGO_URI", "")
    MONGO_DB = os.getenv("MONGO_DB", "inspettovoice")
    USE_GOOGLE_CLOUD = os.getenv("USE_GOOGLE_CLOUD", "false").lower() == "true"
    DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "en-US")
    CAPTURE_KEYWORDS = [
        keyword.strip().lower()
        for keyword in os.getenv("CAPTURE_KEYWORDS", "capture,photo,image,snapshot,evidence").split(",")
        if keyword.strip()
    ]
