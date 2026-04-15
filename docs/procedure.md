[~ Home](../README.md) | [Next (Use Cases & Examples) ->](uses-examples.md)

# Procedural Instructions

This section provides step-by-step instructions for common tasks in the AI Image Editor.

## Import an Image

1. Launch the application.
2. Click `File` in the top menu, or click `Import Image` near the canvas.
3. Select an image from your computer.
4. Wait for the image to load into the center canvas.

Expected result: the selected image appears in the editor and is ready for editing.

## Export the Final Image

1. Finish your edits.
2. Click `Export` in the top menu bar.
3. Wait for the browser to download the file.
4. Open the downloaded PNG to verify the result.

Expected result: the current canvas is saved as a PNG image.

## Remove an Object with Inpainting

1. Import the image you want to edit.
2. Select the `Mask` tool from the left toolbox.
3. Paint over the object or area that should be removed.
4. Open `AI Tools` in the top menu.
5. Choose `Inpaint`.
6. In the properties panel, enter an optional prompt describing what should replace the masked area.
7. Adjust `Guidance Scale`, `Steps`, or `Seed` if needed.
8. Click `Apply Inpaint`.
9. Wait for the processing to finish.

Expected result: the masked area is replaced with newly generated content.

## Extend the Edges of an Image with Outpainting

1. Import the image you want to expand.
2. Open `AI Tools` in the top menu.
3. Choose `Outpaint`.
4. In the properties panel, select one or more directions to expand.
5. Enter an optional prompt describing the new surrounding content.
6. Adjust settings if needed.
7. Click `Apply Outpaint`.
8. Wait for the generated result to appear on the canvas.

Expected result: the image becomes larger in the selected direction or directions.

## Improve a Blurry Image

1. Import the blurry image.
2. Open `AI Tools`.
3. Choose `Deblur`.
4. Optionally enter a prompt that describes the content of the image.
5. Click `Apply Deblur`.
6. Wait for processing to complete.

Expected result: the image appears clearer than the original.

## Remove the Background

1. Import an image with a visible subject.
2. Open `AI Tools`.
3. Choose `Background Magic`.
4. In the properties panel, click `Remove Background`.
5. Wait for the output to be applied to the canvas.

Expected result: the subject remains while the background is removed.

## Replace the Background with a Prompt

1. Import an image that contains a clear subject.
2. Open `AI Tools`.
3. Choose `Background Magic`.
4. In the `Replace Background` section, enter a prompt for the new background.
5. Click `Remove & Replace Background`.
6. Wait for the new image to be generated and applied.

Expected result: the original background is removed and replaced with a newly generated one.

## Crop an Image

1. Import an image.
2. Select `Crop` from the toolbox.
3. Adjust the crop region on the canvas.
4. Click `Apply Crop`.

Expected result: only the selected portion of the image remains.

## Rotate an Image

1. Import an image.
2. Select `Rotate` from the toolbox.
3. Use the rotate controls to turn the image left or right.
4. If needed, click `Reset Rotation` to return to the original angle.

Expected result: the image orientation changes to the selected angle.

## Draw on the Canvas

1. Import an image, or work on a blank canvas.
2. Select `Brush` from the toolbox.
3. Choose a brush color.
4. Adjust the brush size.
5. Drag on the canvas to draw.

Expected result: brush strokes appear on the canvas.

## Add Text

1. Import an image if needed.
2. Select `Text` from the toolbox.
3. Click on the canvas where the text should appear.
4. Edit the text object.
5. Use the `Select` tool to reposition it if needed.

Expected result: editable text is added to the image.

## Repair a Small Area with the Heal Tool

1. Import an image.
2. Select `Heal` from the toolbox.
3. Adjust the stamp size and flow if needed.
4. Hold `Alt` on Windows/Linux or `Option` on macOS and click to choose the source area.
5. Paint over the damaged or unwanted detail.
6. Repeat with a new source point if the texture changes.

Expected result: nearby image content is cloned into the edited area for a smoother repair.

## Adjust Image Appearance

1. Import an image.
2. Select `Adjust` from the toolbox.
3. In the properties panel, move the `Brightness`, `Contrast`, and `Saturation` sliders.
4. Stop when the image reaches the desired appearance.

Expected result: the image updates visually as the sliders change.

## Undo or Redo a Change

1. Make one or more edits.
2. Click `Undo` to reverse the last change.
3. Click `Redo` to restore an undone change.

Expected result: the canvas moves backward or forward through recent states.