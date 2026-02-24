sh -c 'set -e

cd frontend &&
npm install &&
npm run build &&
cd ../srv &&

python3 -m venv .venv &&
. .venv/bin/activate &&

# Detect platform
OS="$(uname)"
ARCH="$(uname -m)"

echo "Detected OS: $OS"
echo "Detected ARCH: $ARCH"

# Install best PyTorch version
if command -v nvidia-smi >/dev/null 2>&1; then
    echo "NVIDIA GPU detected — installing CUDA build"
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
elif [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then
    echo "Apple Silicon detected — installing MPS-compatible build"
    pip install torch torchvision
else
    echo "CPU-only system detected — installing CPU build"
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
fi

# Install remaining dependencies
pip install -r requirements.txt &&

nohup python3 app.py > app.log 2>&1 &'