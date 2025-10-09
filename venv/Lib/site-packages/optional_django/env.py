DJANGO_INSTALLED = False
DJANGO_CONFIGURED = False
DJANGO_SETTINGS = None

try:
    import django
    DJANGO_INSTALLED = True
except ImportError:
    pass

if DJANGO_INSTALLED:
    try:
        from django.core.exceptions import ImproperlyConfigured
    except ImportError:
        DJANGO_INSTALLED = False
    if DJANGO_INSTALLED:
        try:
            from django.conf import settings as DJANGO_SETTINGS
            # Try and raise an ImproperlyConfigured error
            getattr(DJANGO_SETTINGS, 'DEBUG', None)
            DJANGO_CONFIGURED = True
        except ImproperlyConfigured:
            DJANGO_SETTINGS = None