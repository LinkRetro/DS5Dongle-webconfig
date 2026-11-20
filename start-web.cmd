@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:8765/index.html in desktop Chrome or Edge.
echo Keep this window open while flashing. Ctrl+C stops the local server.
python -m http.server 8765 --bind 127.0.0.1 --directory "%~dp0."
