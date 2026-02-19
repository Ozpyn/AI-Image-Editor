---
marp: true
theme: gaia
class: default
---
<!-- _class: invert -->

# AI-Image-Editor

### Aaliyah Creech, Nickson Ibrahim, Gabriel Mingle, Gloria Uwimbabazi 

---
# Project Overview
- A web-based image editing application

- Allows users to import, edit, and enhance images interactively

- Designed to integrate traditional image editing tools (Brush, Crop, Text, Erase, Etc) with AI-powered features (Deblur, Inpainting, Outpaint, Background Removal).

---

# Framework: Front-End
## Front-End Architecture
- Built as a Single Page Application (SPA)

- Component-based architecture using React

- Canvas-based rendering for image manipulation using Fabric.js

- Tool logic separated from UI logic for scalability and maintainability

---
# Front-End Technology Stack
## Technologies & Libraries Used
- **React (Vite)** – UI framework and fast development environment

- **Fabric.js** – Canvas abstraction for image and object manipulation

- **Tailwind CSS** – Responsive and consistent UI styling

- **Lucide-React** – Icon library for professional UI icons


---

# Interface Design
## Main UI Layout

- **Top Menu Bar** – File, Edit, Image, AI Tools

- **Left Toolbox** – Editing tools (Select, Erase, Text, Brush, etc.)

- **Center Canvas Area** – Main editing workspace

- **Right Properties Panel** – Layers and adjustment controls

- **Footer** – Status and future timeline controls


---
![bg fit](assets/image-3.png)

---

# ToolBox Design and Interaction
## Left Toolbox (Tool Selection)

- Displays all available non AI editing tools (Select, Crop, Erase, TeXt, Brush, Heal, Cutout, and Adjust)

- Only one tool can be active at a time

- Clicking a tool updates a global activeTool state

- Visual highlight shows the currently active tool


---

# Canvas Area Design
## Canvas Workplace
- Centered, responsive canvas container

- Automatically resizes using ResizeObserver

- Fabric canvas mounted once and reused

- Supports image import, object selection, and drawing

---
# Properties Panel Design
## Right Side Properties Panel
- Displays Layers (Background, Image)

- Placeholder controls for:
   - Brightness
   - Contrast
   - Saturation

- Designed to update dynamically based on selected object

---

# Tool Enabling Design Pattern
- User clicks a tool in the Toolbox
- activeTool state is updated in App.jsx
- CanvasArea passes activeTool to useCanvas
- useCanvas calls setToolMode(canvas, activeTool)
- canvasUtils.js activates the correct tool logic

---

![bg fit](assets/erase-flow.png)

---

# Supported Editing Functions

- Select function
- Text function
- Erase function
- Brush function
- Crop function
- Deblurring
- Inpainting / Outpainting

---

# Framework: Back-End

![bg vertical width:90% right:30%](https://flask.palletsprojects.com/en/stable/_images/flask-name.svg)
![bg width:90% right:30%](https://cdn.worldvectorlogo.com/logos/pytorch-2.svg)
![bg width:90% right:30%](https://upload.wikimedia.org/wikipedia/commons/d/d6/Hf-logo-with-title.svg)

- Built as a Flask REST API with workers
- A worker can run the requested Compute
- Using Models provided by HuggingFace
    - runwayml/stable-diffusion-inpainting
    - Salesforce/blip-image-captioning-base
    - runwayml/stable-diffusion-v1-5
- PyTorch pipes the workload to the GPU(s)

---

# AI Functions

- Deblur

- Inpainting

- OutPainting

- Background Removal

---

# Implementation Status 
- we designed UI **(Nickson, Gloria, and Aaliyah)**

- We implemented some of the tools in the Toolbox:
  - Select Tool: Move, resize, and select objects **(Nickson)**
  - Erase Tool: Draws mask paths using Fabric’s brush system **(Nickson)**
  - Text Tool: Click to place editable text objects **(Gloria)**
  - Brush Tool: Free-drawing with adjustable color and size **(Gloria)**

- Implemented API to run AI functions **(Gabriel)**
  - Inpainting and Describe

---

# Implementation Plan
- Integrate the AI API endpoints as functions in the frontend **(Aaliyah and Gabriel)**
- Backend optimization to prevent errors **(Gabriel)**
- Finalize UI design to ensure all AI/non-AI tools are working **(Nickson and Gloria)**
- Testing/Validation **(All Team Members)**
- Documentation **(Aaliyah)**

---
<!-- _class: lead -->

# **Q & A**