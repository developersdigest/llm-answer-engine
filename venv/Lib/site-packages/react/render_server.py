import json
import hashlib
import requests
from optional_django.serializers import JSONEncoder
from .exceptions import ReactRenderingError
from . import conf
from .exceptions import RenderServerError


class RenderedComponent(object):
    def __init__(self, markup, props, data):
        self.markup = markup
        self.props = props
        self.data = data

    def __str__(self):
        return self.markup

    def __unicode__(self):
        return unicode(self.markup)


class RenderServer(object):
    def render(self, path, props=None, to_static_markup=False, request_headers=None, timeout=None, url=None):
        if not url:
            url = conf.settings.RENDER_URL

        if props is not None:
            serialized_props = json.dumps(props, cls=JSONEncoder)
        else:
            serialized_props = None

        if not conf.settings.RENDER:
            return RenderedComponent('', serialized_props, {})

        options = {
            'path': path,
            'serializedProps': serialized_props,
            'toStaticMarkup': to_static_markup
        }
        serialized_options = json.dumps(options)
        options_hash = hashlib.sha1(serialized_options.encode('utf-8')).hexdigest()

        all_request_headers = {'content-type': 'application/json'}

        # Add additional requests headers if the requet_headers dictionary is specified
        if request_headers is not None:
            all_request_headers.update(request_headers)

        # Add a send/receive timeout with the request if not specified
        if not isinstance(timeout, (tuple, int, float)):
            timeout = 5.0

        try:
            res = requests.post(
                url,
                data=serialized_options,
                headers=all_request_headers,
                params={'hash': options_hash},
                timeout=timeout
            )
        except requests.ConnectionError:
            raise RenderServerError('Could not connect to render server at {}'.format(url))

        if res.status_code != 200:
            raise RenderServerError(
                'Unexpected response from render server at {} - {}: {}'.format(url, res.status_code, res.text)
            )

        obj = res.json()

        markup = obj.pop('markup', None)
        err = obj.pop('error', None)
        data = obj

        if err:
            if 'message' in err and 'stack' in err:
                raise ReactRenderingError(
                    'Message: {}\n\nStack trace: {}'.format(err['message'], err['stack'])
                )
            raise ReactRenderingError(err)

        if markup is None:
            raise ReactRenderingError('Render server failed to return markup. Returned: {}'.format(obj))

        return RenderedComponent(markup, serialized_props, data)


render_server = RenderServer()
