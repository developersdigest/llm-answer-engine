import os
from .env import DJANGO_CONFIGURED
if DJANGO_CONFIGURED:
    from django.contrib.staticfiles import finders


def find(path, *args, **kwargs):
    if DJANGO_CONFIGURED:
        return finders.find(path, *args, **kwargs)
    if path and os.path.isabs(path) and os.path.exists(path):
        return path