[~ Home](../README.md)

# Programmers Guide
The goal of this guide is to allow other people to re-create, continue, or modify the existing project based on the implemented design or potentially using a different language.

## Requirement Definition

### Front End

### Back End
The flask definition contains the location of the built front end

#### The following contains definitions for `app.py`

There is a `task_storage` object, it holds jobs for a set period of time before disposing of them and its contents.

`make_progress_callback()` is a helper that is a factory function, it binds to a specific task in order to report on its specific progress, allowing the API to return an accurate completion percentage. The function takes in a task_id and reports the task progress.

Next is a blurb that serves the built Single Page Application (the front end), the blurb only functions if the location in the flask definition is correct

`/api/hello` is a simple testing url to verify that the API has indeed started, it only returns a string of text, which flask in turn parses into an html document.

`_run_task_async()` is a helper function that is given the function definition, which it will run, along with the associated task_id. This allows multiple requests to run concurrently.

`inpaint()` is bound to `/api/inpaint`, and it expects to be given an image, the mask of what the user wants to be removed, and an optional prompt. It will save each image as a temporary file. It will then build a function definition to be run asyncronously. The function will return a single inpainted image. The thread is then told to start, and `inpaint()` returns a `202` status code stating that the job has started.

`outpaint()` is bound to `/api/outpaint`, and it expects a single image, directions to expand, and an optional prompt as input. It will save the image as a temporary file and parse the directions to expand in the 4 directions. It will then build a function definition to be run asyncronously. The function will return a single outpainted image. The thread is then told to start, and `outpaint()` returns a `202` status code stating that the job has started.

`deblur()` is bound to `/api/deblur`, and it expects a single image, and an optional prompt as the input. It will save the image as a temporary file. It will then build a function definition to be run asyncronously. The function will return a single deblurred image. The thread is then told to start, and `deblur()` returns a `202` status code stating that the job has started.

`desc()` expects a single image as input. It will run `run_describe()` synchronously, this is because the model is so fast making it async would not be worth it. It will return a single string containing the image's description and code `200`.

`get_task()` requires a task_id. It will then query the task_storage, and will do an action based on the task's status. If the task is in the `processing` state, the function returns the current progress of the task. If state is `complete` the function returns the requested image. `Failed` will return the error encountered. There is also a catch-all for anything unknown.

`cleanup_old_tasks()` is a helper that checks the creation time of a task, determines if it has expired, then deletes the task if it is expired.

`periodic_cleanup()` will run before every request, but will quit until 5 minutes have elapsed since last clean, thus saving resources. Once 5 minutes have passed and the function is called again, task cleaning will occur.

`remove_background()` is bound to the `/api/removebg` endpoint. The function expects a single image as input. And runs `run_remove_background()` synchronously. It will then return the generated image.

#### The following contains definitions for `ai.py`

`logging.set_verbosity_error()` hides warnings from terminal view when running the program. Comment it out if you wish to see the warnings

`DEVICE` identifies what capabilities the program can used based on the hardware it detects.
`DTYPE ` determines what kind of float can be used, float16 is better

`run_inpaint()` expects an image as a filepath, a mask as a filepath, an optional prompt, and an optional callback. Using pillow to open the two images it saves them as image objects. It then determines the original image size so the output can be resized back after processing. It assigns a default empty prompt if none is provided and adjusts the guidance scale accordingly, using a lower value when no prompt is given. It uses the previously defined callback and calculates progress as a percentage based on the current step and total number of inference steps. The Stable Diffusion pipeline is then executed in inference mode. The resulting image is resized to the original dimensions, saved to a temporary file, and the file path is returned.

`run_outpaint()` expects an image filepath, a dictionary describing expansion directions, an optional prompt, and an optional callback. It loads the image and reads directional values, supporting both combined (`x`, `y`) (where the direction to expand up and down is the same value y, and left and right is value x) and individual (`left`, `right`, `top`, `bottom`) inputs. A new larger image canvas is created and the original image is pasted into the correct position. A corresponding mask is generated where the original image area is protected and the new regions are marked for generation. The function then calls `run_inpaint()` with the modified image and mask to fill in the expanded regions. Essentially outpainting is being defined as a convolution of inpainting, as such it can utilize inpaint's percentage based callback.

`run_deblur()` expects an image filepath, an optional prompt, and an optional callback. It loads the image and stores its original size. If no prompt is provided, it uses the captioning model to generate a descriptive prompt automatically. It defines a callback similar to `run_inpaint()` to report progress. The image-to-image pipeline is then executed with a low strength value to preserve the original structure while improving clarity. The result is resized back to the original size, saved to a temporary file, and the file path is returned.

`run_describe()` expects an image filepath and converts the image into the required tensor format using the caption processor. It runs the captioning model in inference mode to generate a textual description of the image, decodes the output tokens into a string, and returns the description directly.

`run_remove_background()` expects an image filepath and loads it in RGBA format to preserve transparency. The image is converted into a byte stream and passed to the background removal library. The processed output is converted back into a PIL image, saved to a temporary file, and the file path is returned.

## Getting Started & Setup

## Architecture & Design

## Technical Documentation

## Maintenance and Future Work
