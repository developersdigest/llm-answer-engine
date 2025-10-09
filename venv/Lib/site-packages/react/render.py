import os
from optional_django import staticfiles
from .exceptions import ComponentSourceFileNotFound
from .render_server import render_server


def render_component(path, props=None, to_static_markup=False, renderer=render_server, request_headers=None, timeout=None):
    if not os.path.isabs(path):
        abs_path = staticfiles.find(path)
        if not abs_path:
            raise ComponentSourceFileNotFound(path)
        path = abs_path

    if not os.path.exists(path):
        raise ComponentSourceFileNotFound(path)

    return renderer.render(path, props, to_static_markup, request_headers, timeout=timeout)
