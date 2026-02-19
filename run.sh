sh -c 'set -e
cd frontend &&
npm install &&
npm run build &&
cd ../srv &&
python3 -m venv .venv &&
. .venv/bin/activate &&
pip install -r requirements.txt &&
python3 app.py'
