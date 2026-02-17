# Back-End

This folder will contain the related back-end services that will need to be run on a relatively powerful server to account for the AI models that will be running.

# To run the server:

```
python3 -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt

flask run
```


# leave that runing and open a new window

```
# Testing Endpoints:

```
curl -X POST http://127.0.0.1:5000/inpaint \
        -F "image=@testimage.jpg" \
        -F "mask=@testimage.jpg"
```
