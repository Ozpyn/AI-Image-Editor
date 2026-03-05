# Back-End

This folder will contain the related back-end services that will need to be run on a relatively powerful server to account for the AI models that will be running.

# To run the server:

```
python3 -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt

flask run
```
leave that runing and open a new window

# API overview
Heavy AI-Enabled endpoints implement asynchronous processing.
Workflow:
1. Send request to endpoint (ex: /api/inpaint)
2. Server returns a task UUID
3. Poll /api/task/<UUID> (keep trying to pull the result)
4. When complete, the endpoint returns the generated image


# Testing Endpoints:

```
curl -X POST http://localhost:8000/api/inpaint \
        -F "image=@raw_image.jpg" \
        -F "mask=@mask2.jpg" \
        -F "prompt=A tiger riding a tricycle"
```

This will return a job ID, this allows the job to run in the background and not hold up the processing of other requests.
To retrieve the job:

```
curl --output img.png https://localhost:8000/api/task/<UUID> 
```

```
curl -X POST http://localhost:8000/describeme -F "image=@raw_image.jpg"
```

mask1.jpg should be used to test inpainting the background

Example response before processing has finished:
```
{
  "status": "processing"
}
```
After:
```
{
  "task_id": "UUID"
}
```

