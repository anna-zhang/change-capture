const isMobile = /Mobi|Android/i.test(navigator.userAgent)
let stepSize = isMobile ? 8 : 6 // Slightly larger on mobile to reduce artifacts

let noiseScale = 0.02
let video, previousFrame
let gfx

let mediaRecorder
let recordedChunks = []
let recording = false
let recordingStopped = false
let ready = false

let playbackVideo

let canvas // p5 canvas for captureStream

function setup () {
  pixelDensity(1)
  canvas = createCanvas(windowWidth, windowHeight)
  video = createCapture(VIDEO, () => {
    video.elt.setAttribute('playsinline', '') // important for iOS mobile
    video.hide()
  })
  video.elt.onloadedmetadata = () => {
    console.log('Video metadata loaded:', video.width, 'x', video.height)
    setupSketch()
    ready = true
  }
}

function setupSketch () {
  if (!video.width || !video.height) {
    console.log('Video metadata not loaded yet, skipping setupSketch.')
    return
  }

  console.log(
    `Setting up gfx with video size ${video.width}x${video.height} and stepSize ${stepSize}`
  )

  if (isMobile) {
    const maxGfxSize = 2048

    // Calculate gfx size based on stepSize, clamp to maxGfxSize
    let gfxWidth = video.width * stepSize
    let gfxHeight = video.height * stepSize

    // Scale down if too big
    let scaleDown = 1
    if (gfxWidth > maxGfxSize) scaleDown = maxGfxSize / gfxWidth
    if (gfxHeight * scaleDown > maxGfxSize) scaleDown = maxGfxSize / gfxHeight

    gfxWidth = floor(gfxWidth * scaleDown)
    gfxHeight = floor(gfxHeight * scaleDown)

    gfx = createGraphics(gfxWidth, gfxHeight)
    gfx.pixelDensity(1)
    gfx.noSmooth()
    gfx.blendMode(ADD)
    gfx.background(0)

    previousFrame = createImage(video.width, video.height)
    previousFrame.pixelDensity = 1

    // Store scaleDown for use in draw()
    gfx._scaleDown = scaleDown
  } else {
    // Desktop: original behavior - no scaling or clamping
    gfx = createGraphics(video.width * stepSize, video.height * stepSize)
    gfx.pixelDensity(1)
    gfx.blendMode(ADD)
    gfx.background(0)

    previousFrame = createImage(video.width, video.height)
    previousFrame.pixelDensity = 1

    gfx._scaleDown = 1 // no scaling on desktop
  }
}

function draw () {
  if (!ready) return
  if (recordingStopped) return

  gfx.push()
  gfx.blendMode(BLEND)
  gfx.fill(0, 15)
  gfx.noStroke()
  gfx.rect(0, 0, gfx.width, gfx.height)
  gfx.pop()

  video.loadPixels()
  previousFrame.loadPixels()

  if (
    video.pixels.length === 0 ||
    previousFrame.pixels.length !== video.pixels.length
  ) {
    return
  }

  let scaleDown = gfx._scaleDown || 1
  let scaledStepSize = stepSize * scaleDown

  gfx.stroke(255, 80)
  for (let y = 0; y < video.height; y++) {
    for (let x = 0; x < video.width; x++) {
      let index = (x + y * video.width) * 4

      let r1 = video.pixels[index]
      let g1 = video.pixels[index + 1]
      let b1 = video.pixels[index + 2]
      let r2 = previousFrame.pixels[index]
      let g2 = previousFrame.pixels[index + 1]
      let b2 = previousFrame.pixels[index + 2]

      let diff = abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)

      if (diff > 60) {
        let px = x * scaledStepSize
        let py = y * scaledStepSize

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
    video.width,
    video.height,
    0,
    0,
    video.width,
    video.height
  )

  clear()

  let scaleX = width / gfx.width
  let scaleY = height / gfx.height
  let scaleFactor = max(scaleX, scaleY)

  let drawWidth = gfx.width * scaleFactor
  let drawHeight = gfx.height * scaleFactor

  let offsetX = (width - drawWidth) / 2
  let offsetY = (height - drawHeight) / 2

  push()
  translate(width, 0)
  scale(-1, 1)
  image(gfx, offsetX, offsetY, drawWidth, drawHeight)
  pop()
}

function windowResized () {
  resizeCanvas(windowWidth, windowHeight)
  if (ready) setupSketch()
}

// ------ Recording and UI handling ------

function handleToggleRecording () {
  if (!recording) {
    startRecording()
    select('#toggleBtn').html('Stop Recording')
  } else {
    stopRecording()
    select('#toggleBtn').hide()
  }
}

function startRecording () {
  const stream = canvas.elt.captureStream(30)
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
  playbackVideo.style('position', 'fixed')
  playbackVideo.style('top', '0')
  playbackVideo.style('left', '0')
  playbackVideo.style('z-index', '5')
  playbackVideo.elt.dataset.url = url

  select('#saveBtn').show()
  select('#restartBtn').show()
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

  select('#saveBtn').hide()
  select('#restartBtn').hide()
  select('#toggleBtn').html('Start Recording')
  select('#toggleBtn').show()

  select('canvas').show()
  loop()

  recordingStopped = false
  recordedChunks = []
  setupSketch()
}
