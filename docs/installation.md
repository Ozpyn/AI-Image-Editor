[<- Back](../README.md) | [Next (Interface Overview) ->](interface-overview.md)

# How to Install & Run the project:

### Prerequisites

You will need the latest version of the following:

- [python3](https://www.python.org/downloads/) and Python3-venv (if not included in python3)
- Some kind of web browser


### Running the project
There exists a `run.sh` script in the root of the directory, it has been written to cover the following configurations:
- Linux
    - Nvidia CUDA 12.8
    - AMD ROCm 7.1
    - CPU Only
- MacOS
    - Apple Silicon MPS
- Windows
    - Nvidia CUDA 12.8
    - CPU Only

If your system configuration does not match any of the previous configurations `(e.g. it has newer/older CUDA version or Intel ARC)` please take the time to modify the script to suit your needs or manually run the commands to match your device.

Allow the file to be executable if it isn't already (MacOS + Linux)
```
chmod +x run.sh
```

To run:
```
./run.sh
```

This will take a little while, when the script finishes there will be a URL in the terminal that leads to the application.

### The script will do the following:

1. Create and activate a python virtual environment
2. Detect Hardware and Install project dependencies using pip
3. Create and activate a Node envionment via nodeenv
4. Build the frontend using the node environment
5. Run the application