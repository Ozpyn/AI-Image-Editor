sh -c 'set -e

cd frontend &&
npm install &&
npm run build &&
cd ../srv &&

python3 -m venv .venv &&

# Activate venv (cross-platform)
if [ -f ".venv/bin/activate" ]; then
    . .venv/bin/activate
else
    . .venv/Scripts/activate
fi

OS="$(uname 2>/dev/null || echo Windows)"
ARCH="$(uname -m 2>/dev/null || echo x86_64)"

echo "Detected OS: $OS"
echo "Detected ARCH: $ARCH"

# -----------------------------
# WINDOWS
# -----------------------------
if [[ "$OS" == *"MINGW"* || "$OS" == *"MSYS"* || "$OS" == *"CYGWIN"* || "$OS" == "Windows_NT" ]]; then

    if where nvidia-smi > /dev/null 2>&1; then
        echo "Windows NVIDIA GPU detected — installing CUDA build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu130
    else
        echo "Windows CPU-only detected — installing CPU build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
    fi

# -----------------------------
# LINUX
# -----------------------------
elif [ "$OS" = "Linux" ]; then

    # NVIDIA
    if [ -e /dev/nvidiactl ] || [ -e /dev/nvidia0 ]; then
        echo "Linux NVIDIA GPU detected — installing CUDA build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu130

    # AMD ROCm
    elif command -v lspci >/dev/null 2>&1 && \
         lspci | grep -Ei "amd|advanced micro devices" >/dev/null 2>&1 && \
         [ -d /opt/rocm ]; then
        echo "Linux AMD ROCm detected — installing ROCm build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm7.1

    else
        echo "Linux CPU-only detected — installing CPU build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
    fi

# -----------------------------
# macOS
# -----------------------------
elif [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then
    echo "Apple Silicon detected — installing MPS-compatible build"
    pip install torch torchvision

else
    echo "Unknown platform — installing CPU build"
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
fi

pip install -r requirements.txt &&
nohup python3 app.py > app.log 2>&1 &'