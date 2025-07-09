let video
let previousFrame
let stepSize = 6
let noiseScale = 0.02

let gfx
let mediaRecorder
let recordedChunks = []
let recording = false

let toggleButton
let saveButton
let restartButton
let playbackVideo
let recordingStopped = false

let videoWidth, videoHeight

function setup () {
  createCanvas(windowWidth, windowHeight)
  pixelDensity(1)

  // Create webcam capture with callback when ready
  video = createCapture(VIDEO, () => {
    videoWidth = video.width
    videoHeight = video.height
    console.log(`Video size: ${videoWidth} x ${videoHeight}`)

    setupSketch()
    setupUI()
  })

  // Request reasonable webcam size
  video.size(320, 240)
  video.hide()
}

function setupSketch () {
  // Offscreen buffer scaled by stepSize for visual effect
  gfx = createGraphics(videoWidth * stepSize, videoHeight * stepSize)
  gfx.pixelDensity(1)
  gfx.blendMode(ADD)
  gfx.background(0)

  previousFrame = createImage(videoWidth, videoHeight)
}

function setupUI () {
  // Toggle start/stop Recording button
  toggleButton = createButton('Start Recording')
  toggleButton.position(20, 20)
  toggleButton.style('position', 'absolute')
  toggleButton.style('z-index', '10')
  toggleButton.mousePressed(handleToggleRecording)

  // Save recording button
  saveButton = createButton('Download Recording')
  saveButton.position(20, 60)
  saveButton.style('position', 'absolute')
  saveButton.style('z-index', '10')
  saveButton.mousePressed(saveVideo)
  saveButton.hide()

  // Restart button
  restartButton = createButton('Restart Recording')
  restartButton.position(180, 60)
  restartButton.style('position', 'absolute')
  restartButton.style('z-index', '10')
  restartButton.mousePressed(restartSketch)
  restartButton.hide()
}

function draw () {
  if (!videoWidth || !videoHeight) return // Wait for webcam ready
  if (recordingStopped) return

  // Draw fading trail effect on gfx buffer
  gfx.push()
  gfx.blendMode(BLEND)
  gfx.fill(0, 15)
  gfx.noStroke()
  gfx.rect(0, 0, gfx.width, gfx.height)
  gfx.pop()

  video.loadPixels()
  previousFrame.loadPixels()

  gfx.stroke(255, 80)
  for (let y = 0; y < videoHeight; y++) {
    for (let x = 0; x < videoWidth; x++) {
      let index = (x + y * videoWidth) * 4

      let r1 = video.pixels[index]
      let g1 = video.pixels[index + 1]
      let b1 = video.pixels[index + 2]
      let r2 = previousFrame.pixels[index]
      let g2 = previousFrame.pixels[index + 1]
      let b2 = previousFrame.pixels[index + 2]

      let diff = abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)

      if (diff > 60) {
        let px = x * stepSize
        let py = y * stepSize

        let angle =
          noise(x * noiseScale, y * noiseScale, frameCount * 0.01) * TWO_PI * 2
        let dx = cos(angle) * 5
        let dy = sin(angle) * 5

        gfx.strokeWeight(map(diff, 60, 255, 0.5, 2))
        gfx.line(px, py, px + dx, py + dy)
      }
    }
  }

  previousFrame.copy(
    video,
    0,
    0,
    videoWidth,
    videoHeight,
    0,
    0,
    videoWidth,
    videoHeight
  )

  // Draw gfx buffer scaled & centered on main canvas (cover scale)
  clear()

  let scaleX = width / gfx.width
  let scaleY = height / gfx.height
  let scale = max(scaleX, scaleY)

  let drawWidth = gfx.width * scale
  let drawHeight = gfx.height * scale

  let offsetX = (width - drawWidth) / 2
  let offsetY = (height - drawHeight) / 2

  image(gfx, offsetX, offsetY, drawWidth, drawHeight)
}

function windowResized () {
  resizeCanvas(windowWidth, windowHeight)
}

// ----- Recording logic -----

function handleToggleRecording () {
  if (!recording) {
    startRecording()
    toggleButton.html('Stop Recording')
  } else {
    stopRecording()
    toggleButton.hide()
  }
}

function startRecording () {
  // Capture visible main canvas stream, so recording matches user view
  const stream = document.querySelector('canvas').captureStream(30)
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
  recordedChunks = []

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data)
  }

  mediaRecorder.onstop = showPlayback

  mediaRecorder.start()
  recording = true
  console.log('Recording started')
}

function stopRecording () {
  if (mediaRecorder && recording) {
    mediaRecorder.stop()
    recording = false
    recordingStopped = true
    console.log('Recording stopped')
  }
}

function showPlayback () {
  const blob = new Blob(recordedChunks, { type: 'video/webm' })
  const url = URL.createObjectURL(blob)

  noLoop()
  select('canvas').hide()

  playbackVideo = createVideo([url])
  playbackVideo.position(0, 0)
  playbackVideo.size(windowWidth, windowHeight)
  playbackVideo.autoplay(true)
  playbackVideo.loop(true)
  playbackVideo.volume(0)
  playbackVideo.style('position', 'absolute')
  playbackVideo.style('z-index', '5')
  playbackVideo.elt.dataset.url = url

  saveButton.show()
  restartButton.show()
}

function saveVideo () {
  const url = playbackVideo.elt.dataset.url
  const a = createA(url, 'download.webm')
  a.attribute('download', 'motion-recording.webm')
  a.hide()
  a.elt.click()
  URL.revokeObjectURL(url)
}

function restartSketch () {
  if (playbackVideo) {
    playbackVideo.remove()
    playbackVideo = null
  }

  saveButton.hide()
  restartButton.hide()
  toggleButton.html('Start Recording')
  toggleButton.show()

  select('canvas').show()
  loop()

  recordingStopped = false
  recordedChunks = []
  setupSketch()
}
