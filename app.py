import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from gdb.bot import run_bot

if __name__ == "__main__":
    run_bot()