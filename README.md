# Motion Mirror

Motion Mirror is a browser-based camera that only captures what changes between frames. Instead of recording what's in front of it literally, it records what's *different* -- producing images and videos that show not a particular moment but rather its movement.

It's a way to explore a different form of image-making: one where stillness is invisible and only change leaves a mark.

## Concept

A traditional camera captures a scene as it is. Motion Mirror captures a scene as it *shifts*. It compares each video frame to the one before it and draws only where something has changed. The result is a live, evolving picture made entirely of motion trails -- a portrait of transformation rather than appearance.

Stand still, and the canvas goes dark. Move, and trails of white strokes bloom where your body was. The faster or more dramatic the change, the thicker and brighter the marks. Over time, trails fade, so the image is always a record of the recent past dissolving into black.

## How It Works

### Frame Differencing

Each frame, the sketch compares the current camera feed to the previous frame pixel by pixel. For each pixel, it sums the absolute difference across R, G, and B channels:

```
diff = |R_current - R_previous| + |G_current - G_previous| + |B_current - B_previous|
```

If the total difference exceeds a threshold of 60 (out of a maximum of 765), the pixel is considered "changed" and a mark is drawn at that location.

### Drawing Motion Trails

Where motion is detected, the sketch draws short lines (about 5 pixels long) whose direction is determined by a Perlin noise field. The noise field varies spatially and shifts over time, giving the trails a flowing, organic quality rather than random static.

- **Line thickness** scales with motion intensity -- subtle changes produce thin strokes; large changes produce thicker ones.
- **Line color** is white at partial opacity (alpha 80/255), drawn with additive blending so overlapping strokes accumulate into brighter marks.

### Decay

Each frame, a semi-transparent black rectangle is drawn over the entire buffer. This gradually fades older trails, so the image reflects only recent motion. The fade rate is controlled by the overlay's alpha value (15/255 per frame).

### Rendering

The motion buffer is drawn to the main canvas with a horizontal flip (`scale(-1, 1)`) to create a live mirror effect. The image is fitted to the browser window while preserving the camera's aspect ratio.

## Features

- **Live motion visualization** -- real-time frame differencing rendered as flowing trails
- **Video recording** -- record the canvas as a `.webm` video on supported browsers (Chrome, Edge, Firefox)
- **Image capture** -- fall back to a `.png` snapshot on browsers without MediaRecorder/WebM support (e.g., Safari on iOS)
- **Download** -- save recordings or captures locally
- **Mirror display** -- horizontally flipped output for natural interaction
- **Responsive** -- fills the browser window and adapts on resize
- **Accessible** -- keyboard-navigable UI, focus trapping in the About modal, ARIA attributes

## Usage

Open `index.html` in a browser and grant camera access when prompted. The motion visualization starts immediately.

**Controls (bottom of screen):**

| Button | Action |
|---|---|
| Start Recording / Capture Image | Begin recording a video, or capture a still image on unsupported browsers |
| Stop Recording | End the recording and preview the result |
| Download Recording / Download Image | Save the file locally |
| Restart | Return to the live view |

## Project Structure

```
index.html   -- HTML structure, modal, inline UI/accessibility script
sketch.js    -- p5.js sketch: frame differencing, motion trails, recording logic
ui.js        -- Modal behavior and button event wiring (mirrors inline script)
style.css    -- Layout, typography, button and modal styles
```

### Dependencies

- [p5.js v1.9.0](https://p5js.org/) (loaded from CDN)
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) (loaded from Google Fonts)

No build step or package manager required.

## Technical Parameters

These values are hardcoded in `sketch.js` and can be adjusted by editing the file directly:

| Parameter | Default | Effect |
|---|---|---|
| `stepSize` | 6 (desktop) / 3000 (mobile) | Scale multiplier for the motion buffer |
| `noiseScale` | 0.02 | Perlin noise smoothness (lower = smoother flow) |
| Motion threshold | 60 | Minimum pixel difference to register as motion (0--765) |
| Decay alpha | 15 | Trail fade speed per frame (higher = slower fade) |
| Stroke weight | 0.5--2 px | Line thickness, mapped from motion intensity |
| Line length | ~5 px | Length of each motion trail stroke |
| Recording fps | 30 | MediaRecorder capture frame rate |
| Max buffer size | 2048 px | Mobile graphics buffer dimension cap |

## Limitations

- **Mobile performance** -- On mobile devices, the graphics buffer is heavily downscaled (capped at 2048x2048) to avoid GPU memory issues, resulting in lower visual fidelity.
- **No video recording on iOS/Safari** -- Safari lacks MediaRecorder support for WebM. The app falls back to still image capture.
- **No audio** -- Recordings are video-only.
- **Camera permission required** -- The app cannot function without access to the device camera.
- **Lighting sensitivity** -- The frame differencing algorithm responds to all pixel changes, including shifts in ambient lighting, shadows, and camera noise -- not just physical movement.
- **No configurable UI** -- All visual parameters (threshold, decay rate, noise scale, etc.) are hardcoded and require editing the source to change.
