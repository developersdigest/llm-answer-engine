"""
utility functions for asteval

   Matthew Newville <newville@cars.uchicago.edu>,
   The University of Chicago
"""
import ast
import io
import math
import numbers
import re
from sys import exc_info
from tokenize import ENCODING as tk_ENCODING
from tokenize import NAME as tk_NAME
from tokenize import tokenize as generate_tokens
from string import Formatter

builtins = __builtins__
if not isinstance(builtins, dict):
    builtins = builtins.__dict__

HAS_NUMPY = False
try:
    import numpy
    numpy_version = numpy.version.version.split('.', 2)
    HAS_NUMPY = True
except ImportError:
    numpy = None

HAS_NUMPY_FINANCIAL = False
try:
    import numpy_financial
    HAS_NUMPY_FINANCIAL = True
except ImportError:
    pass

# This is a necessary API but it's undocumented and moved around
# between Python releases
try:
    from _string import formatter_field_name_split
except ImportError:
    formatter_field_name_split = lambda \
        x: x._formatter_field_name_split()



MAX_EXPONENT = 10000
MAX_STR_LEN = 2 << 17  # 256KiB
MAX_SHIFT = 1000
MAX_OPEN_BUFFER = 2 << 17

RESERVED_WORDS = ('False', 'None', 'True', 'and', 'as', 'assert',
                  'async', 'await', 'break', 'class', 'continue', 'def',
                  'del', 'elif', 'else', 'except', 'finally', 'for',
                  'from', 'global', 'if', 'import', 'in', 'is',
                  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
                  'return', 'try', 'while', 'with', 'yield', 'exec',
                  'eval', 'execfile', '__import__', '__package__',
                  '__fstring__')

NAME_MATCH = re.compile(r"[a-zA-Z_][a-zA-Z0-9_]*$").match

# unsafe attributes for all objects:
UNSAFE_ATTRS = ('__subclasses__', '__bases__', '__globals__', '__code__',
                '__reduce__', '__reduce_ex__',  '__mro__',
                '__closure__', '__func__', '__self__', '__module__',
                '__dict__', '__class__', '__call__', '__get__',
                '__getattribute__', '__subclasshook__', '__new__',
                '__init__', 'func_globals', 'func_code', 'func_closure',
                'im_class', 'im_func', 'im_self', 'gi_code', 'gi_frame',
                'f_locals', '__asteval__','mro')

# unsafe attributes for particular objects, by type
UNSAFE_ATTRS_DTYPES = {str: ('format', 'format_map')}


# inherit these from python's __builtins__
FROM_PY = ('ArithmeticError', 'AssertionError', 'AttributeError',
           'BaseException', 'BufferError', 'BytesWarning',
           'DeprecationWarning', 'EOFError', 'EnvironmentError',
           'Exception', 'False', 'FloatingPointError', 'GeneratorExit',
           'IOError', 'ImportError', 'ImportWarning', 'IndentationError',
           'IndexError', 'KeyError', 'KeyboardInterrupt', 'LookupError',
           'MemoryError', 'NameError', 'None',
           'NotImplementedError', 'OSError', 'OverflowError',
           'ReferenceError', 'RuntimeError', 'RuntimeWarning',
           'StopIteration', 'SyntaxError', 'SyntaxWarning', 'SystemError',
           'SystemExit', 'True', 'TypeError', 'UnboundLocalError',
           'UnicodeDecodeError', 'UnicodeEncodeError', 'UnicodeError',
           'UnicodeTranslateError', 'UnicodeWarning', 'ValueError',
           'Warning', 'ZeroDivisionError', 'abs', 'all', 'any', 'bin',
           'bool', 'bytearray', 'bytes', 'chr', 'complex', 'dict', 'dir',
           'divmod', 'enumerate', 'filter', 'float', 'format', 'frozenset',
           'hash', 'hex', 'id', 'int', 'isinstance', 'len', 'list', 'map',
           'max', 'min', 'oct', 'ord', 'pow', 'range', 'repr',
           'reversed', 'round', 'set', 'slice', 'sorted', 'str', 'sum',
           'tuple', 'zip')

BUILTINS_TABLE = {sym: builtins[sym] for sym in FROM_PY if sym in builtins}

# inherit these from python's math
FROM_MATH = ('acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
             'ceil', 'copysign', 'cos', 'cosh', 'degrees', 'e', 'exp',
             'fabs', 'factorial', 'floor', 'fmod', 'frexp', 'fsum',
             'hypot', 'isinf', 'isnan', 'ldexp', 'log', 'log10', 'log1p',
             'modf', 'pi', 'pow', 'radians', 'sin', 'sinh', 'sqrt', 'tan',
             'tanh', 'trunc')

MATH_TABLE = {sym: getattr(math, sym) for sym in FROM_MATH if hasattr(math, sym)}

FROM_NUMPY = ('abs', 'add', 'all', 'amax', 'amin', 'angle', 'any', 'append',
    'arange', 'arccos', 'arccosh', 'arcsin', 'arcsinh', 'arctan', 'arctan2',
    'arctanh', 'argmax', 'argmin', 'argsort', 'argwhere', 'around', 'array',
    'asarray', 'atleast_1d', 'atleast_2d', 'atleast_3d', 'average', 'bartlett',
    'bitwise_and', 'bitwise_not', 'bitwise_or', 'bitwise_xor', 'blackman',
    'broadcast', 'ceil', 'choose', 'clip', 'column_stack', 'common_type',
    'complex128', 'compress', 'concatenate', 'conjugate', 'convolve',
    'copysign', 'corrcoef', 'correlate', 'cos', 'cosh', 'cov', 'cross',
    'cumprod', 'cumsum', 'datetime_data', 'deg2rad', 'degrees', 'delete',
    'diag', 'diag_indices', 'diag_indices_from', 'diagflat', 'diagonal',
    'diff', 'digitize', 'divide', 'dot', 'dsplit', 'dstack', 'dtype', 'e',
    'ediff1d', 'empty', 'empty_like', 'equal', 'exp', 'exp2', 'expand_dims',
    'expm1', 'extract', 'eye', 'fabs', 'fill_diagonal', 'finfo', 'fix',
    'flatiter', 'flatnonzero', 'fliplr', 'flipud', 'float64', 'floor',
    'floor_divide', 'fmax', 'fmin', 'fmod', 'format_parser', 'frexp',
    'frombuffer', 'fromfile', 'fromfunction', 'fromiter', 'frompyfunc',
    'fromregex', 'fromstring', 'genfromtxt', 'getbufsize', 'geterr',
    'gradient', 'greater', 'greater_equal', 'hamming', 'hanning', 'histogram',
    'histogram2d', 'histogramdd', 'hsplit', 'hstack', 'hypot', 'i0',
    'identity', 'iinfo', 'imag', 'indices', 'inexact', 'inf', 'info', 'inner',
    'insert', 'int32', 'integer', 'interp', 'intersect1d', 'invert',
    'iscomplex', 'iscomplexobj', 'isfinite', 'isinf', 'isnan', 'isneginf',
    'isposinf', 'isreal', 'isrealobj', 'isscalar', 'iterable', 'kaiser',
    'kron', 'ldexp', 'left_shift', 'less', 'less_equal', 'linspace',
    'little_endian', 'loadtxt', 'log', 'log10', 'log1p', 'log2', 'logaddexp',
    'logaddexp2', 'logical_and', 'logical_not', 'logical_or', 'logical_xor',
    'logspace', 'longdouble', 'longlong', 'mask_indices', 'matrix', 'maximum',
    'may_share_memory', 'mean', 'median', 'memmap', 'meshgrid', 'minimum',
    'mintypecode', 'mod', 'modf', 'msort', 'multiply', 'nan', 'nan_to_num',
    'nanargmax', 'nanargmin', 'nanmax', 'nanmin', 'nansum', 'ndarray',
    'ndenumerate', 'ndim', 'ndindex', 'negative', 'nextafter', 'nonzero',
    'not_equal', 'number', 'ones', 'ones_like', 'outer', 'packbits',
    'percentile', 'pi', 'piecewise', 'place', 'poly', 'poly1d', 'polyadd',
    'polyder', 'polydiv', 'polyint', 'polymul', 'polysub', 'polyval', 'power',
    'prod', 'ptp', 'put', 'putmask', 'rad2deg', 'radians', 'ravel', 'real',
    'real_if_close', 'reciprocal', 'record', 'remainder', 'repeat', 'reshape',
    'resize', 'right_shift', 'rint', 'roll', 'rollaxis', 'roots', 'rot90',
    'round', 'searchsorted', 'select', 'setbufsize', 'setdiff1d', 'seterr',
    'setxor1d', 'shape', 'short', 'sign', 'signbit', 'signedinteger', 'sin',
    'sinc', 'single', 'sinh', 'size', 'sort', 'sort_complex', 'spacing',
    'split', 'sqrt', 'square', 'squeeze', 'std', 'subtract', 'sum', 'swapaxes',
    'take', 'tan', 'tanh', 'tensordot', 'tile', 'trace', 'transpose', 'tri',
    'tril', 'tril_indices', 'tril_indices_from', 'trim_zeros', 'triu',
    'triu_indices', 'triu_indices_from', 'true_divide', 'trunc', 'ubyte',
    'uint', 'uint32', 'union1d', 'unique', 'unravel_index', 'unsignedinteger',
    'unwrap', 'ushort', 'vander', 'var', 'vdot', 'vectorize', 'vsplit',
    'vstack', 'where', 'zeros', 'zeros_like')


FROM_NUMPY_FINANCIAL = ('fv', 'ipmt', 'irr', 'mirr', 'nper', 'npv',
                        'pmt', 'ppmt', 'pv', 'rate')

NUMPY_RENAMES = {'ln': 'log', 'asin': 'arcsin', 'acos': 'arccos',
                 'atan': 'arctan', 'atan2': 'arctan2', 'atanh':
                 'arctanh', 'acosh': 'arccosh', 'asinh': 'arcsinh'}

if HAS_NUMPY:
    FROM_NUMPY = tuple(set(FROM_NUMPY))
    FROM_NUMPY = tuple(sym for sym in FROM_NUMPY if hasattr(numpy, sym))
    NUMPY_RENAMES = {sym: value for sym, value in NUMPY_RENAMES.items() if hasattr(numpy, value)}

    NUMPY_TABLE = {}
    for sym in FROM_NUMPY:
        obj = getattr(numpy, sym, None)
        if obj is not None:
            NUMPY_TABLE[sym] = obj

    for sname, sym in NUMPY_RENAMES.items():
        obj = getattr(numpy, sym, None)
        if obj is not None:
            NUMPY_TABLE[sname] = obj

    if HAS_NUMPY_FINANCIAL:
        for sym in FROM_NUMPY_FINANCIAL:
            obj = getattr(numpy_financial, sym, None)
            if obj is not None:
                NUMPY_TABLE[sym] = obj

else:
    NUMPY_TABLE = {}


def _open(filename, mode='r', buffering=-1, encoding=None):
    """read only version of open()"""
    if mode not in ('r', 'rb', 'rU'):
        raise RuntimeError("Invalid open file mode, must be 'r', 'rb', or 'rU'")
    if buffering > MAX_OPEN_BUFFER:
        raise RuntimeError(f"Invalid buffering value, max buffer size is {MAX_OPEN_BUFFER}")
    return open(filename, mode, buffering, encoding=encoding)


def _type(x):
    """type that prevents varargs and varkws"""
    return type(x).__name__


LOCALFUNCS = {'open': _open, 'type': _type}


# Safe versions of functions to prevent denial of service issues

def safe_pow(base, exp):
    """safe version of pow"""
    if isinstance(exp, numbers.Number):
        if exp > MAX_EXPONENT:
            raise RuntimeError(f"Invalid exponent, max exponent is {MAX_EXPONENT}")
    elif HAS_NUMPY and isinstance(exp, numpy.ndarray):
        if numpy.nanmax(exp) > MAX_EXPONENT:
            raise RuntimeError(f"Invalid exponent, max exponent is {MAX_EXPONENT}")
    return base ** exp


def safe_mult(arg1, arg2):
    """safe version of multiply"""
    if isinstance(arg1, str) and isinstance(arg2, int) and len(arg1) * arg2 > MAX_STR_LEN:
        raise RuntimeError(f"String length exceeded, max string length is {MAX_STR_LEN}")
    return arg1 * arg2


def safe_add(arg1, arg2):
    """safe version of add"""
    if isinstance(arg1, str) and isinstance(arg2, str) and len(arg1) + len(arg2) > MAX_STR_LEN:
        raise RuntimeError(f"String length exceeded, max string length is {MAX_STR_LEN}")
    return arg1 + arg2


def safe_lshift(arg1, arg2):
    """safe version of lshift"""
    if isinstance(arg2, numbers.Number):
        if arg2 > MAX_SHIFT:
            raise RuntimeError(f"Invalid left shift, max left shift is {MAX_SHIFT}")
    elif HAS_NUMPY and isinstance(arg2, numpy.ndarray):
        if numpy.nanmax(arg2) > MAX_SHIFT:
            raise RuntimeError(f"Invalid left shift, max left shift is {MAX_SHIFT}")
    return arg1 << arg2


OPERATORS = {ast.Is: lambda a, b: a is b,
             ast.IsNot: lambda a, b: a is not b,
             ast.In: lambda a, b: a in b,
             ast.NotIn: lambda a, b: a not in b,
             ast.Add: safe_add,
             ast.BitAnd: lambda a, b: a & b,
             ast.BitOr: lambda a, b: a | b,
             ast.BitXor: lambda a, b: a ^ b,
             ast.Div: lambda a, b: a / b,
             ast.FloorDiv: lambda a, b: a // b,
             ast.LShift: safe_lshift,
             ast.RShift: lambda a, b: a >> b,
             ast.Mult: safe_mult,
             ast.Pow: safe_pow,
             ast.MatMult: lambda a, b: a @ b,
             ast.Sub: lambda a, b: a - b,
             ast.Mod: lambda a, b: a % b,
             ast.And: lambda a, b: a and b,
             ast.Or: lambda a, b: a or b,
             ast.Eq: lambda a, b: a == b,
             ast.Gt: lambda a, b: a > b,
             ast.GtE: lambda a, b: a >= b,
             ast.Lt: lambda a, b: a < b,
             ast.LtE: lambda a, b: a <= b,
             ast.NotEq: lambda a, b: a != b,
             ast.Invert: lambda a: ~a,
             ast.Not: lambda a: not a,
             ast.UAdd: lambda a: +a,
             ast.USub: lambda a: -a}

# Safe version of getattr

def safe_getattr(obj, attr, raise_exc, node):
    """safe version of getattr"""
    unsafe = (attr in UNSAFE_ATTRS or
            (attr.startswith('__') and attr.endswith('__')))
    if not unsafe:
        for dtype, attrlist in UNSAFE_ATTRS_DTYPES.items():
            unsafe = (isinstance(obj, dtype) or obj is dtype) and attr in attrlist
            if unsafe:
                break
    if unsafe:
        msg = f"no safe attribute '{attr}' for {repr(obj)}"
        raise_exc(node, exc=AttributeError, msg=msg)
    else:
        try:
            return getattr(obj, attr)
        except AttributeError:
            pass

class SafeFormatter(Formatter):
    def __init__(self, raise_exc, node):
        self.raise_exc = raise_exc
        self.node = node
        super().__init__()

    def get_field(self, field_name, args, kwargs):
        first, rest = formatter_field_name_split(field_name)
        obj = self.get_value(first, args, kwargs)
        for is_attr, i in rest:
            if is_attr:
                obj = safe_getattr(obj, i, self.raise_exc, self.node)
            else:
                obj = obj[i]
        return obj, first

def safe_format(_string, raise_exc, node, *args, **kwargs):
    formatter = SafeFormatter(raise_exc, node)
    return formatter.vformat(_string, args, kwargs)

def valid_symbol_name(name):
    """Determine whether the input symbol name is a valid name.

    Arguments
    ---------
      name  : str
         name to check for validity.

    Returns
    --------
      valid :  bool
        whether name is a a valid symbol name

    This checks for Python reserved words and that the name matches
    the regular expression ``[a-zA-Z_][a-zA-Z0-9_]``
    """
    if name in RESERVED_WORDS:
        return False

    gen = generate_tokens(io.BytesIO(name.encode('utf-8')).readline)
    typ, _, start, end, _ = next(gen)
    if typ == tk_ENCODING:
        typ, _, start, end, _ = next(gen)
    return typ == tk_NAME and start == (1, 0) and end == (1, len(name))


def op2func(oper):
    """Return function for operator nodes."""
    return OPERATORS[oper.__class__]


class Empty:
    """Empty class."""
    def __init__(self):
        """TODO: docstring in public method."""
        return

    def __nonzero__(self):
        """Empty is TODO: docstring in magic method."""
        return False

    def __repr__(self):
        """Empty is TODO: docstring in magic method."""
        return "Empty"

ReturnedNone = Empty()

class ExceptionHolder:
    """Basic exception handler."""
    def __init__(self, node, exc=None, msg='', expr=None,
                 text=None, lineno=None):
        """TODO: docstring in public method."""
        self.node = node
        self.expr = expr
        self.msg = msg
        self.exc = exc
        self.text = text
        self.lineno = lineno
        self.end_lineno = lineno
        self.col_offset = 0
        if lineno is None:
            try:
                self.lineno = node.lineno
                self.end_lineno = node.end_lineno
                self.col_offset = node.col_offset
            except:
                pass
        self.exc_info = exc_info()
        if self.exc is None and self.exc_info[0] is not None:
            self.exc = self.exc_info[0]
        if self.msg == '' and self.exc_info[1] is not None:
            self.msg = str(self.exc_info[1])

    def get_error(self):
        """Retrieve error data."""
        try:
            exc_name = self.exc.__name__
        except AttributeError:
            exc_name = str(self.exc)
        if exc_name in (None, 'None'):
            exc_name = 'UnknownError'

        out = []
        self.code = [f'{l}' for l  in self.text.split('\n')]
        self.codelines = [f'{i+1}: {l}' for i, l in enumerate(self.code)]

        try:
            out.append('\n'.join(self.code[self.lineno-1:self.end_lineno]))
        except:
            out.append(f"{self.expr}")
        if self.col_offset > 0:
            out.append(f"{self.col_offset*' '}^^^^")
        out.append(f"{exc_name}: {self.msg}")
        return (exc_name, '\n'.join(out))

    def __repr__(self):
        return f"ExceptionHolder({self.exc}, {self.msg})"

class NameFinder(ast.NodeVisitor):
    """Find all symbol names used by a parsed node."""

    def __init__(self):
        """TODO: docstring in public method."""
        self.names = []
        ast.NodeVisitor.__init__(self)

    def generic_visit(self, node):
        """TODO: docstring in public method."""
        if node.__class__.__name__ == 'Name':
            if node.id not in self.names:
                self.names.append(node.id)
        ast.NodeVisitor.generic_visit(self, node)


def get_ast_names(astnode):
    """Return symbol Names from an AST node."""
    finder = NameFinder()
    finder.generic_visit(astnode)
    return finder.names


def valid_varname(name):
    "is this a valid variable name"
    return name.isidentifier() and name not in RESERVED_WORDS


class Group(dict):
    """
    Group: a container of objects that can be accessed either as an object attributes
    or dictionary  key/value.  Attribute names must follow Python naming conventions.
    """
    def __init__(self, name=None, searchgroups=None, **kws):
        if name is None:
            name = hex(id(self))
        self.__name__ = name
        dict.__init__(self, **kws)
        self._searchgroups = searchgroups

    def __setattr__(self, name, value):
        if not valid_varname(name):
            raise SyntaxError(f"invalid attribute name '{name}'")
        self[name] = value

    def __getattr__(self, name, default=None):
        if name in self:
            return self[name]
        if default is not None:
            return default
        raise KeyError(f"no attribute named '{name}'")

    def __setitem__(self, name, value):
        if valid_varname(name):
            dict.__setitem__(self, name, value)
        else: # raise SyntaxError(f"invalid attribute name '{name}'")
            return setattr(self, name, value)

    def get(self, key, default=None):
        val = self.__getattr__(key, ReturnedNone)
        if not isinstance(val, Empty):
            return val
        searchgroups = self._searchgroups
        if searchgroups is not None:
            for sgroup in searchgroups:
                grp = self.__getattr__(sgroup, None)
                if isinstance(grp, (Group, dict)):
                    val = grp.__getattr__(key, ReturnedNone)
                    if not isinstance(val, Empty):
                        return val
        return default


    def __repr__(self):
        keys = [a for a in self.keys() if a != '__name__']
        return f"Group('{self.__name__}', {len(keys)} symbols)"

    def _repr_html_(self):
        """HTML representation for Jupyter notebook"""
        html = [f"<table><caption>Group('{self.__name__}')</caption>",
  "<tr><th>Attribute</th><th>DataType</th><th><b>Value</b></th></tr>"]
        for key, val in self.items():
            html.append(f"""
<tr><td>{key}</td><td><i>{type(val).__name__}</i></td>
    <td>{repr(val):.75s}</td>
</tr>""")
        html.append("</table>")
        return '\n'.join(html)


def make_symbol_table(use_numpy=True, nested=False, top=True,  **kws):
    """Create a default symboltable, taking dict of user-defined symbols.

    Arguments
    ---------
    numpy : bool, optional
       whether to include symbols from numpy [True]
    nested : bool, optional
       whether to make a "new-style" nested table instead of a plain dict [False]
    top : bool, optional
       whether this is the top-level table in a nested-table [True]
    kws :  optional
       additional symbol name, value pairs to include in symbol table

    Returns
    --------
    symbol_table : dict or nested Group
       a symbol table that can be used in `asteval.Interpereter`

    """
    if nested:
        name = '_'
        if top:
            name = '_main'
            if 'name' in kws:
                name = kws.pop('name')
        symtable = Group(name=name, Group=Group)
    else:
        symtable = {}

    symtable.update(BUILTINS_TABLE)
    symtable.update(LOCALFUNCS)
    symtable.update(kws)
    math_functions = dict(MATH_TABLE.items())
    if use_numpy:
        math_functions.update(NUMPY_TABLE)

    if nested:
        symtable['math'] = Group(name='math', **math_functions)
        symtable['Group'] = Group
        symtable._searchgroups = ('math',)
    else:
        symtable.update(math_functions)
    symtable.update(**kws)
    return symtable


class Procedure:
    """Procedure: user-defined function for asteval.

    This stores the parsed ast nodes as from the 'functiondef' ast node
    for later evaluation.

    """

    def __init__(self, name, interp, doc=None, lineno=None,
                 body=None, text=None, args=None, kwargs=None,
                 vararg=None, varkws=None):
        """TODO: docstring in public method."""
        self.__ininit__ = True
        self.name = name
        self.__name__ = self.name
        self.__asteval__ = interp
        self.__raise_exc__ = self.__asteval__.raise_exception
        self.__doc__ = doc
        self.__body__ = body
        self.__argnames__ = args
        self.__kwargs__ = kwargs
        self.__vararg__ = vararg
        self.__varkws__ = varkws
        self.lineno = lineno
        self.__text__ = text
        if text is None:
            self.__text__ = f'{self.__signature__()}\n' + ast.unparse(self.__body__)
        self.__ininit__ = False

    def __setattr__(self, attr, val):
        if not getattr(self, '__ininit__', True):
            self.__raise_exc__(None, exc=TypeError,
                               msg="procedure is read-only")
        self.__dict__[attr] = val

    def __dir__(self):
        return ['__getdoc__', 'argnames', 'kwargs', 'name', 'vararg', 'varkws']

    def __getdoc__(self):
        doc = self.__doc__
        if isinstance(doc, ast.Constant):
            doc = doc.value
        return doc

    def __repr__(self):
        """TODO: docstring in magic method."""
        sig = self.__signature__()
        rep = f"<Procedure {sig}>"
        doc = self.__getdoc__()
        if doc is not None:
            rep = f"{rep}\n {doc}"
        return rep

    def __signature__(self):
        "call signature"
        sig = ""
        if len(self.__argnames__) > 0:
            sig = sig +  ', '.join(self.__argnames__)
        if self.__vararg__ is not None:
            sig = sig + f"*{self.__vararg__}"
        if len(self.__kwargs__) > 0:
            if len(sig) > 0:
                sig = f"{sig}, "
            _kw = [f"{k}={v}" for k, v in self.__kwargs__]
            sig = f"{sig}{', '.join(_kw)}"

            if self.__varkws__ is not None:
                sig = f"{sig}, **{self.__varkws__}"
        return f"{self.name}({sig})"

    def __call__(self, *args, **kwargs):
        """TODO: docstring in public method."""
        topsym = self.__asteval__.symtable
        if self.__asteval__.config.get('nested_symtable', False):
            sargs = {'_main': topsym}
            sgroups = topsym.get('_searchgroups', None)
            if sgroups is not None:
                for sxname in sgroups:
                    sargs[sxname] = topsym.get(sxname)


            symlocals = Group(name=f'symtable_{self.name}_', **sargs)
            symlocals._searchgroups = list(sargs.keys())
        else:
            symlocals = {}

        args = list(args)
        nargs = len(args)
        nkws = len(kwargs)
        nargs_expected = len(self.__argnames__)

        # check for too few arguments, but the correct keyword given
        if (nargs < nargs_expected) and nkws > 0:
            for name in self.__argnames__[nargs:]:
                if name in kwargs:
                    args.append(kwargs.pop(name))
            nargs = len(args)
            nargs_expected = len(self.__argnames__)
            nkws = len(kwargs)
        if nargs < nargs_expected:
            msg = f"{self.name}() takes at least"
            msg = f"{msg} {nargs_expected} arguments, got {nargs}"
            self.__raise_exc__(None, exc=TypeError,  msg=msg)
        # check for multiple values for named argument
        if len(self.__argnames__) > 0 and kwargs is not None:
            msg = "multiple values for keyword argument"
            for targ in self.__argnames__:
                if targ in kwargs:
                    msg = f"{msg} '{targ}' in Procedure {self.name}"
                    self.__raise_exc__(None, exc=TypeError, msg=msg,
                                      lineno=self.lineno)

        # check more args given than expected, varargs not given
        if nargs != nargs_expected:
            msg = None
            if nargs < nargs_expected:
                msg = f"not enough arguments for Procedure {self.name}()"
                msg = f"{msg} (expected {nargs_expected}, got {nargs}"
                self.__raise_exc__(None, exc=TypeError, msg=msg)

        if nargs > nargs_expected and self.__vararg__ is None:
            if nargs - nargs_expected > len(self.__kwargs__):
                msg = f"too many arguments for {self.name}() expected at most"
                msg = f"{msg} {len(self.__kwargs__)+nargs_expected}, got {nargs}"
                self.__raise_exc__(None, exc=TypeError, msg=msg)

            for i, xarg in enumerate(args[nargs_expected:]):
                kw_name = self.__kwargs__[i][0]
                if kw_name not in kwargs:
                    kwargs[kw_name] = xarg

        for argname in self.__argnames__:
            symlocals[argname] = args.pop(0)

        try:
            if self.__vararg__ is not None:
                symlocals[self.__vararg__] = tuple(args)

            for key, val in self.__kwargs__:
                if key in kwargs:
                    val = kwargs.pop(key)
                symlocals[key] = val

            if self.__varkws__ is not None:
                symlocals[self.__varkws__] = kwargs

            elif len(kwargs) > 0:
                msg = f"extra keyword arguments for Procedure {self.name}: "
                msg = msg + ','.join(list(kwargs.keys()))
                self.__raise_exc__(None, msg=msg, exc=TypeError,
                                   lineno=self.lineno)

        except (ValueError, LookupError, TypeError,
                NameError, AttributeError):
            msg = f"incorrect arguments for Procedure {self.name}"
            self.__raise_exc__(None, msg=msg, lineno=self.lineno)

        if self.__asteval__.config.get('nested_symtable', False):
            save_symtable = self.__asteval__.symtable
            self.__asteval__.symtable = symlocals
        else:
            save_symtable = self.__asteval__.symtable.copy()
            self.__asteval__.symtable.update(symlocals)

        self.__asteval__.retval = None
        self.__asteval__._calldepth += 1
        retval = None

        # evaluate script of function
        self.__asteval__.code_text.append(self.__text__)
        for node in self.__body__:
            self.__asteval__.run(node, lineno=node.lineno)
            if len(self.__asteval__.error) > 0:
                break
            if self.__asteval__.retval is not None:
                retval = self.__asteval__.retval
                self.__asteval__.retval = None
                if retval is ReturnedNone:
                    retval = None
                break

        self.__asteval__.symtable = save_symtable
        self.__asteval__.code_text.pop()
        self.__asteval__._calldepth -= 1
        symlocals = None
        return retval
