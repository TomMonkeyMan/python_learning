# push_config.py
import os
VAPID_PUBLIC_KEY = os.environ["VAPID_PUBLIC_KEY"]
VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]

VAPID_CLAIMS = {
    "sub": "mailto:shitianyurdfz@hotmail.com"
}

