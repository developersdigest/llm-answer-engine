from .env import DJANGO_CONFIGURED

if DJANGO_CONFIGURED:
    from django.core.serializers.json import DjangoJSONEncoder as JSONEncoder
else:
    from json import JSONEncoder