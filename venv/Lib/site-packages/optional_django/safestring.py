from .env import DJANGO_CONFIGURED

if DJANGO_CONFIGURED:
    from django.utils.safestring import mark_safe
else:
    mark_safe = lambda string: string  # no-op