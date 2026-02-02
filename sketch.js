// --- Mobile detection via feature/viewport (3D) ---
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
let stepSize = 6

let noiseScale = 0.02
let video, previousFrame
let gfx

let mediaRecorder
let recordedChunks = []
let recording = false
let recordingStopped = false
let ready = false
let toggleLocked = false // 1C: debounce guard

let playbackVideo
let playbackBlobUrl = null // 2E: track blob URL for revocation
let canvas

// 2G: Codec negotiation
let negotiatedMimeType = 'video/webm'

function negotiateCodec () {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ]
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      negotiatedMimeType = mime
      return mime
    }
  }
  return null
}

function isRecordingSupported () {
  return negotiateCodec() !== null
}

// 2C: Recording timer
let recTimerInterval = null
let recStartTime = 0

function startRecTimer () {
  recStartTime = Date.now()
  const indicator = document.getElementById('recordingIndicator')
  const timerEl = document.getElementById('recTimer')
  if (indicator) indicator.style.display = 'flex'
  updateRecTimer()
  recTimerInterval = setInterval(updateRecTimer, 1000)

  function updateRecTimer () {
    const elapsed = Math.floor((Date.now() - recStartTime) / 1000)
    const mins = Math.floor(elapsed / 60)
    const secs = String(elapsed % 60).padStart(2, '0')
    if (timerEl) timerEl.textContent = mins + ':' + secs
  }
}

function stopRecTimer () {
  if (recTimerInterval) {
    clearInterval(recTimerInterval)
    recTimerInterval = null
  }
  const indicator = document.getElementById('recordingIndicator')
  if (indicator) indicator.style.display = 'none'
}

function showCameraError () {
  const errorOverlay = document.getElementById('cameraError')
  if (errorOverlay) errorOverlay.style.display = 'flex'
  const controls = document.querySelector('.ui-bottom')
  if (controls) controls.style.display = 'none'
  if (typeof announce === 'function') announce('Camera access denied. Please allow camera access and reload.')
}

function setup () {
  pixelDensity(1)
  canvas = createCanvas(windowWidth, windowHeight)

  // 1E: Pre-check camera permission so we can handle denial
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      // Stop the pre-check stream tracks (createCapture will open its own)
      stream.getTracks().forEach(t => t.stop())

      video = createCapture(VIDEO, () => {
        video.elt.setAttribute('playsinline', '')
        video.hide()
        // Dismiss onboarding when camera starts
        const onboarding = document.getElementById('onboarding')
        if (onboarding && onboarding.style.display !== 'none') {
          onboarding.style.display = 'none'
          localStorage.setItem('motionMirrorOnboarded', '1')
        }
        if (typeof announce === 'function') announce('Camera ready. Motion visualization active.')
      })

      video.elt.onloadedmetadata = () => {
        setupSketch()
        ready = true
      }
    })
    .catch(() => {
      showCameraError()
    })

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
    const maxGfxSize = 1024
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
    // 1B: removed previousFrame.pixelDensity = 1 (no-op)
    gfx._scaleDown = scaleDown
  } else {
    gfx = createGraphics(video.width * stepSize, video.height * stepSize)
    gfx.pixelDensity(1)
    gfx.noSmooth()
    gfx.blendMode(ADD)
    gfx.background(0)

    previousFrame = createImage(video.width, video.height)
    // 1B: removed previousFrame.pixelDensity = 1 (no-op)
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

  let sampleStep = isMobile ? 4 : 2
  gfx.stroke(255, 80)
  for (let y = 0; y < video.height; y += sampleStep) {
    for (let x = 0; x < video.width; x += sampleStep) {
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
        let dx = cos(angle) * 5 * scaleDown
        let dy = sin(angle) * 5 * scaleDown

        gfx.strokeWeight(map(diff, 60, 255, 0.5, 2) * scaleDown)
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

// 1D: Guard resize during recording
function windowResized () {
  resizeCanvas(windowWidth, windowHeight)
  if (ready && !recording && !recordingStopped) setupSketch()
}

// ------ Recording and UI handling ------

function handleToggleRecording () {
  // 1C: Prevent double-recording via debounce guard
  if (toggleLocked) return
  toggleLocked = true
  setTimeout(() => { toggleLocked = false }, 500)

  if (!recording) {
    if (isRecordingSupported()) {
      startRecording()
      select('#toggleBtn').html('Stop Recording')
    } else {
      captureStillImage()
    }
  } else {
    stopRecording()
    select('#toggleBtn').hide()
  }
}

function startRecording () {
  recording = true // set immediately before async work
  const stream = canvas.elt.captureStream(30)
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: negotiatedMimeType,
    videoBitsPerSecond: 5000000
  })
  recordedChunks = []

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data)
  }

  mediaRecorder.onstop = showPlayback
  mediaRecorder.start()
  startRecTimer()
  if (typeof announce === 'function') announce('Recording started.')
}

function stopRecording () {
  if (mediaRecorder && recording) {
    mediaRecorder.stop()
    recording = false
    recordingStopped = true
    stopRecTimer()
    if (typeof announce === 'function') announce('Recording stopped.')
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
  if (typeof announce === 'function') announce('Image captured. You can download or restart.')
}

function showPlayback () {
  const blob = new Blob(recordedChunks, { type: negotiatedMimeType })
  // 2E: Clear recordedChunks after blob is created
  recordedChunks = []

  const url = URL.createObjectURL(blob)
  playbackBlobUrl = url

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
  if (typeof announce === 'function') announce('Recording ready for playback. You can download or restart.')
}

function saveVideo () {
  const url = playbackVideo.elt.dataset.url
  const isImage = url.startsWith('data:image')
  const isMP4 = negotiatedMimeType.includes('mp4')
  const ext = isImage ? 'png' : (isMP4 ? 'mp4' : 'webm')
  const filename = isImage ? 'motion-image.png' : ('motion-recording.' + ext)

  const a = createA(url, filename)
  a.attribute('download', filename)
  a.hide()
  a.elt.click()

  if (!isImage) URL.revokeObjectURL(url)
  playbackBlobUrl = null
  if (typeof announce === 'function') announce('Download started.')
}

function restartSketch () {
  // 2E: Revoke blob URL before removing playback
  if (playbackBlobUrl) {
    URL.revokeObjectURL(playbackBlobUrl)
    playbackBlobUrl = null
  }

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
  if (typeof announce === 'function') announce('Restarted. Motion visualization active.')
}
