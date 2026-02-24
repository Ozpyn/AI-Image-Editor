# Back-End

This folder will contain the related back-end services that will need to be run on a relatively powerful server to account for the AI models that will be running.

# To run the server:

```
python3 -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt

flask run
```

# Testing Endpoints:

```
curl -X POST http://localhost:8000/api/inpaint \
        -F "image=@raw_image.jpg" \
        -F "mask=@mask2.jpg" \
        -F "prompt=A tiger riding a tricycle" \
        --output output.png
```
```
curl -X POST http://localhost:8000/api/describeme -F "image=@raw_image.jpg"
```

mask1.jpg should be used to test outpainting