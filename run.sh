if [ -f "srv/.venv/bin/activate" ]; then
    echo "Python .venv detected"
else
    echo "Making python .venv"
    python3 -m venv srv/.venv
fi

source srv/.venv/bin/activate

cd frontend

pip install nodeenv -q

if [ -f "env/bin/activate" ]; then
    echo "Node env detected"
else
    echo "Making Node env"
    nodeenv env
fi

source env/bin/activate

npm install -s

if [ -d "dist" ]; then
    echo "Removing old frontend build..."
    rm -rf "dist"
fi

echo "Building frontend..."

npm run build

cd ../ #Return to Root

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
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128 -q

        echo "Installing rembg with GPU support (CUDA)"
        pip install "rembg[gpu]" -q
    else
        echo "Windows CPU-only detected — installing CPU build"
        pip install torch torchvision -q

        echo "Installing rembg with CPU support"
        pip install "rembg[cpu]" -q
    fi

# -----------------------------
# LINUX
# -----------------------------
elif [ "$OS" = "Linux" ]; then

    # NVIDIA
    if [ -e /dev/nvidiactl ] || [ -e /dev/nvidia0 ]; then
        echo "Linux NVIDIA GPU detected — installing CUDA build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128 -q

        echo "Installing rembg with GPU support (CUDA)"
        pip install "rembg[gpu]" -q

    # AMD ROCm
    elif command -v lspci >/dev/null 2>&1 && \
         lspci | grep -Ei "amd|advanced micro devices" >/dev/null 2>&1 && \
         [ -d /opt/rocm ]; then
        echo "Linux AMD ROCm detected — installing ROCm build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm7.1 -q

        echo "Installing rembg with ROCm support"
        pip install "rembg[rocm]" -q

    else
        echo "Linux CPU-only detected — installing CPU build"
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu -q

        echo "Installing rembg with CPU support"
        pip install "rembg[cpu]" -q
    fi

# -----------------------------
# macOS
# -----------------------------
elif [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then
    echo "Apple Silicon detected — installing MPS-compatible build"
    pip install torch torchvision -q

    echo "Installing rembg with CPU support"
    pip install "rembg[cpu]" -q

else
    echo "Unknown platform — installing CPU build"
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu -q

    echo "Installing rembg with CPU support"
    pip install "rembg[cpu]" -q
fi

cd srv

pip install -r requirements.txt -q

echo "Cloning Restormer by swz30"
git clone --quiet https://github.com/swz30/Restormer.git

echo "Checking for Weights"
if [ -f "weights/restormer_motion_deblurring.pth" ]; then
    echo "Weights Exist ... Skipping"
else
    echo "Pulling Weights"
    mkdir -p weights
    cd weights
    wget -q --show-progress https://github.com/swz30/Restormer/releases/download/v1.0/motion_deblurring.pth -O restormer_motion_deblurring.pth
    cd ../  
fi

echo "Requirements Installed"
echo "Running App"
python3 app.py