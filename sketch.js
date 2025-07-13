const isMobile = /Mobi|Android/i.test(navigator.userAgent)
let stepSize = isMobile ? 3000 : 6

let noiseScale = 0.02
let video, previousFrame
let gfx

let mediaRecorder
let recordedChunks = []
let recording = false
let recordingStopped = false
let ready = false

let playbackVideo
let canvas

function isRecordingSupported () {
  return (
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported('video/webm')
  )
}

function setup () {
  pixelDensity(1)
  canvas = createCanvas(windowWidth, windowHeight)

  video = createCapture(VIDEO, () => {
    video.elt.setAttribute('playsinline', '')
    video.hide()
  })

  video.elt.onloadedmetadata = () => {
    setupSketch()
    ready = true
  }

  // Set initial button label based on support
  if (isRecordingSupported()) {
    select('#toggleBtn').html('Start Recording')
  } else {
    select('#toggleBtn').html('Capture Image')
  }

  select('#saveBtn').hide()
  select('#restartBtn').hide()
}

function setupSketch () {
  if (!video.width || !video.height) return

  if (isMobile) {
    const maxGfxSize = 2048
    let gfxWidth = video.width * stepSize
    let gfxHeight = video.height * stepSize

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
    gfx._scaleDown = scaleDown
  } else {
    gfx = createGraphics(video.width * stepSize, video.height * stepSize)
    gfx.pixelDensity(1)
    gfx.noSmooth()
    gfx.blendMode(ADD)
    gfx.background(0)

    previousFrame = createImage(video.width, video.height)
    previousFrame.pixelDensity = 1
    gfx._scaleDown = 1
  }
}

function draw () {
  if (!ready || recordingStopped) return

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
  )
    return

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

  let videoAspect = video.width / video.height
  let canvasAspect = width / height

  let scaleFactor, drawWidth, drawHeight, offsetX, offsetY

  if (videoAspect > canvasAspect) {
    scaleFactor = height / gfx.height
    drawWidth = gfx.width * scaleFactor
    drawHeight = height
    offsetX = (width - drawWidth) / 2
    offsetY = 0
  } else {
    scaleFactor = width / gfx.width
    drawWidth = width
    drawHeight = gfx.height * scaleFactor
    offsetX = 0
    offsetY = (height - drawHeight) / 2
  }

  offsetX = floor(offsetX)
  offsetY = floor(offsetY)
  drawWidth = floor(drawWidth)
  drawHeight = floor(drawHeight)

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
    if (isRecordingSupported()) {
      startRecording()
      select('#toggleBtn').html('Stop Recording')
    } else {
      captureStillImage()
      // Hide toggle button, show save and restart handled in captureStillImage
    }
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

function captureStillImage () {
  const dataUrl = canvas.elt.toDataURL('image/png')

  select('canvas').hide()

  playbackVideo = createImg(dataUrl, 'Captured Image')
  playbackVideo.position(0, 0)
  playbackVideo.size(windowWidth, windowHeight)
  playbackVideo.style('position', 'fixed')
  playbackVideo.style('top', '0')
  playbackVideo.style('left', '0')
  playbackVideo.style('z-index', '5')
  playbackVideo.elt.dataset.url = dataUrl

  select('#toggleBtn').hide()
  select('#saveBtn').html('Download Image').show()
  select('#restartBtn').show()
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

  select('#saveBtn').html('Download Recording').show()
  select('#restartBtn').show()
}

function saveVideo () {
  const url = playbackVideo.elt.dataset.url
  const isImage = url.startsWith('data:image')

  const a = createA(url, isImage ? 'motion-image.png' : 'motion-recording.webm')
  a.attribute(
    'download',
    isImage ? 'motion-image.png' : 'motion-recording.webm'
  )
  a.hide()
  a.elt.click()

  if (!isImage) URL.revokeObjectURL(url)
}

function restartSketch () {
  if (playbackVideo) {
    playbackVideo.remove()
    playbackVideo = null
  }

  select('#saveBtn').hide()
  select('#restartBtn').hide()
  select('#toggleBtn').show()

  // Reset toggle button label according to support
  if (isRecordingSupported()) {
    select('#toggleBtn').html('Start Recording')
  } else {
    select('#toggleBtn').html('Capture Image')
  }

  select('canvas').show()

  loop()
  recordingStopped = false
  recordedChunks = []
  setupSketch()
}
