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

        echo "Installing rembg with GPU support (CUDA)"
        pip install "rembg[gpu]"
    else
        echo "Windows CPU-only detected — installing CPU build"
        pip install torch torchvision

        echo "Installing rembg with CPU support"
        pip install "rembg[cpu]"

        echo "Installing rembg with CPU support"
        pip install "rembg[cpu]"

        echo "Installing rembg with CPU support"
        pip install "rembg[cpu]"
    fi

# -----------------------------
# LINUX
# -----------------------------
elif [ "$OS" = "Linux" ]; then

    # NVIDIA
    if [ -e /dev/nvidiactl ] || [ -e /dev/nvidia0 ]; then
        echo "Linux NVIDIA GPU detected — installing CUDA build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu130

        echo "Installing rembg with GPU support (CUDA)"
        pip install "rembg[gpu]"

        echo "Installing rembg with GPU support (CUDA)"
        pip install "rembg[gpu]"

        echo "Installing rembg with GPU support (CUDA)"
        pip install "rembg[gpu]"

    # AMD ROCm
    elif command -v lspci >/dev/null 2>&1 && \
         lspci | grep -Ei "amd|advanced micro devices" >/dev/null 2>&1 && \
         [ -d /opt/rocm ]; then
        echo "Linux AMD ROCm detected — installing ROCm build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm7.1

        echo "Installing rembg with ROCm support"
        pip install "rembg[rocm]"

        echo "Installing rembg with ROCm support"
        pip install "rembg[rocm]"

        echo "Installing rembg with ROCm support"
        pip install "rembg[rocm]"

    else
        echo "Linux CPU-only detected — installing CPU build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

        echo "Installing rembg with CPU support"
        pip install "rembg[cpu]"

        echo "Installing rembg with CPU support"
        pip install "rembg[cpu]"

        echo "Installing rembg with CPU support"
        pip install "rembg[cpu]"
    fi

# -----------------------------
# macOS
# -----------------------------
elif [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then
    echo "Apple Silicon detected — installing MPS-compatible build"
    pip install torch torchvision

    echo "Installing rembg with CPU support"
    pip install "rembg[cpu]"

    echo "Installing rembg with CPU support"
    pip install "rembg[cpu]"

    echo "Installing rembg with CPU support"
    pip install "rembg[cpu]"

else
    echo "Unknown platform — installing CPU build"
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

    echo "Installing rembg with CPU support"
    pip install "rembg[cpu]"

    echo "Installing rembg with CPU support"
    pip install "rembg[cpu]"

    echo "Installing rembg with CPU support"
    pip install "rembg[cpu]"
fi

pip install -r requirements.txt &&
echo "Requirements Installed" &&
echo "Running App"
python3 app.py'
python3 app.py'
echo "Running App" &&
python3 app.py'