let video, previousFrame
let stepSize = 6
let noiseScale = 0.02
let gfx

let mediaRecorder
let recordedChunks = []
let recording = false
let recordingStopped = false
let ready = false

let playbackVideo

let canvas // <-- store p5 canvas globally for captureStream

function setup () {
  canvas = createCanvas(windowWidth, windowHeight)
  pixelDensity(1)

  video = createCapture(VIDEO)
  video.size(320, 240)
  video.hide()
}

function setupSketch () {
  gfx = createGraphics(video.width * stepSize, video.height * stepSize)
  gfx.pixelDensity(1)
  gfx.blendMode(ADD)
  gfx.background(0)

  previousFrame = createImage(video.width, video.height)
}

function draw () {
  if (!ready) {
    if (video.loadedmetadata && video.width > 0 && video.height > 0) {
      setupSketch()
      ready = true
    } else {
      return
    }
  }

  if (recordingStopped) return

  gfx.push()
  gfx.blendMode(BLEND)
  gfx.fill(0, 15)
  gfx.noStroke()
  gfx.rect(0, 0, gfx.width, gfx.height)
  gfx.pop()

  video.loadPixels()
  previousFrame.loadPixels()

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
  // Use the p5 canvas element for captureStream (fixed)
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
