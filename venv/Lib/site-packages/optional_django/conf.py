import warnings
from . import six
from .exceptions import ConfigurationError


class ConfigurationWarning(Warning):
    pass


class Conf(object):
    _has_been_configured = False
    _configurable = False

    def _unlock(self):
        super(Conf, self).__setattr__('_configurable', True)

    def _lock(self):
        super(Conf, self).__setattr__('_configurable', False)

    def configure(self, **kwargs):
        if self._has_been_configured:
            raise ConfigurationError(
                '{}.{} has already been configured'.format(
                    type(self).__module__,
                    type(self).__name__,
                )
            )

        self._unlock()

        for key, value in six.iteritems(kwargs):
            if hasattr(self, key):
                setattr(self, key, value)
            else:
                warnings.warn('Unknown setting {}'.format(key))

        self._has_been_configured = True

        self._lock()

    def __setattr__(self, name, value):
        if not self._configurable:
            raise ConfigurationError('Use `.configure({}=<value>, ...)` to change settings'.format(name))
        super(Conf, self).__setattr__(name, value)