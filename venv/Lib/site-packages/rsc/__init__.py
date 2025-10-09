import re
from asteval import Interpreter

symbol_table = {}
safe_eval = Interpreter(symtable=symbol_table)

def setv(name, value):
    """
    Set a variable that can be used in calculations.
    Example: rsc.setv("a", 10)
    """
    if not re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_]*", name):
        return "Error: Invalid variable name"
    symbol_table[name] = value

def calc(expression):
    """
    Safely evaluate a mathematical expression string.
    Supports variables, +, -, *, /, //, %, **, parentheses, and more.
    """
    expression = expression.replace("x", "*").replace("^", "**")
    if not re.fullmatch(r"[0-9a-zA-Z_+\-*/%^().\s]+", expression):
        return "Error: Invalid characters in expression"
    try:
        result = safe_eval(expression)
        if safe_eval.error:
            safe_eval.error = []
            return "Error: Invalid expression"
        return result
    except ZeroDivisionError:
        return "Error: Division by zero"
    except Exception:
        return "Error: Invalid expression"

def show_help():
    print(
        "How to use:\n"
        " Import with: import rsc\n"
        " Use rsc.calc(expression) for math\n"
        " Set variables using rsc.setv(name, value)\n\n"
        "Examples:\n"
        ' rsc.setv("a", 10)\n'
        ' rsc.setv("b", 20)\n'
        ' rsc.setv("c", 10)\n'
        ' print(rsc.calc("a + b - c"))\n'
        ' print(rsc.calc("(a + b) - c"))\n\n'
        "Supported operators: +, -, *, x, /, //, %, **, ^, ()\n"
        "Supports parentheses, variables, and complex expressions\n"
        "https://github.com/Rasa8877/rs-calculator\n"
        "Contact me: letperhut@gmail.com\n"
        "RSC — the simplest calculator library in Python!"
    )

__version__ = "0.3.2"
__all__ = ["setv", "calc", "show_help"]
