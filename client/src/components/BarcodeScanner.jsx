import React, { useEffect, useMemo, useRef, useState } from 'react'
import './BarcodeScanner.css'

const DEFAULT_FORM_DATA = {
  name: '',
  category_id: '',
  quantity: 1,
  price: 0,
  cost: 0,
  description: '',
  car_make: '',
  car_model: '',
  car_year_from: '',
  car_year_to: '',
  oe_number: ''
}

const REAR_CAMERA_LABEL = /(back|rear|environment|world|traseira|trasera|arriere|hinten|zadnja|后|後|背)/i
const MOBILE_USER_AGENT = /Android|iPhone|iPad|iPod/i

function BarcodeScanner({ onBarcodeDetected, onNewPart, categories, loading }) {
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const readerRef = useRef(null)
  const zxingModuleRef = useRef(null)
  const scanningRef = useRef(false)
  const lastScanRef = useRef({ value: '', timestamp: 0 })

  const [barcode, setBarcode] = useState('')
  const [scannedPart, setScannedPart] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraStatus, setCameraStatus] = useState('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [usingFrontCamera, setUsingFrontCamera] = useState(false)

  const isMobile = useMemo(() => MOBILE_USER_AGENT.test(navigator.userAgent || ''), [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const sanitizeBarcode = (value) => {
    if (!value) return ''
    return value.replace(/[\s\r\n\t]/g, '').replace(/[\u0010-\u001f]/g, '')
  }

  const isDuplicateScan = (value) => {
    const now = Date.now()
    if (lastScanRef.current.value === value && now - lastScanRef.current.timestamp < 1800) {
      return true
    }
    lastScanRef.current = { value, timestamp: now }
    return false
  }

  const ensureReader = async () => {
    if (!readerRef.current) {
      if (!zxingModuleRef.current) {
        zxingModuleRef.current = await import('@zxing/browser')
      }
      const { BrowserMultiFormatReader } = zxingModuleRef.current
      readerRef.current = new BrowserMultiFormatReader(undefined, 100)
    }
    return readerRef.current
  }

  const stopCamera = () => {
    scanningRef.current = false
    if (readerRef.current) {
      readerRef.current.reset()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraActive(false)
    setCameraStarting(false)
    setTorchOn(false)
    setTorchSupported(false)
    setUsingFrontCamera(false)
    setCameraStatus('')
  }

  const processBarcodeInput = async (rawBarcode) => {
    const barcodeValue = sanitizeBarcode(rawBarcode)
    if (!barcodeValue || isDuplicateScan(barcodeValue)) return

    setBarcode(barcodeValue)
    setCameraStatus('Nuskaitoma...')

    try {
      const response = await fetch(`/api/parts/barcode/${encodeURIComponent(barcodeValue)}`)
      if (response.ok) {
        const part = await response.json()
        setScannedPart(part)
        setShowCreateForm(false)
      } else {
        setScannedPart(null)
        setShowCreateForm(true)
        setFormData((prev) => ({ ...prev, barcode: barcodeValue }))
      }
    } catch (error) {
      console.error('Barcode lookup error:', error)
      setCameraError('Nepavyko patikrinti barkodo. Patikrinkite interneto ryšį.')
    }
  }

  const chooseRearCamera = (devices) => {
    const videoDevices = devices.filter((device) => device.kind === 'videoinput')
    if (videoDevices.length === 0) return null
    return videoDevices.find((device) => REAR_CAMERA_LABEL.test(device.label || '')) || videoDevices[0]
  }

  const applyVideoEnhancements = async (track) => {
    if (!track?.getCapabilities || !track?.applyConstraints) {
      setTorchSupported(false)
      return
    }

    const capabilities = track.getCapabilities()
    setTorchSupported(Boolean(capabilities?.torch))

    const advanced = []
    if (capabilities?.focusMode?.includes?.('continuous')) advanced.push({ focusMode: 'continuous' })
    else if (capabilities?.focusMode?.includes?.('auto')) advanced.push({ focusMode: 'auto' })
    if (capabilities?.exposureMode?.includes?.('continuous')) advanced.push({ exposureMode: 'continuous' })
    else if (capabilities?.exposureMode?.includes?.('auto')) advanced.push({ exposureMode: 'auto' })
    if (capabilities?.whiteBalanceMode?.includes?.('continuous')) advanced.push({ whiteBalanceMode: 'continuous' })
    else if (capabilities?.whiteBalanceMode?.includes?.('auto')) advanced.push({ whiteBalanceMode: 'auto' })

    if (advanced.length > 0) {
      try {
        await track.applyConstraints({ advanced })
      } catch {
        // ignore unsupported advanced constraints
      }
    }

    if (capabilities?.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: false }] })
      } catch {
        // some phones throw even though torch exists
      }
    }
  }

  const openCameraStream = async () => {
    const base = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: isMobile ? 24 : 30 }
    }

    const initialCandidates = [
      { ...base, facingMode: { ideal: 'environment' } },
      { ...base, facingMode: 'environment' },
      { ...base }
    ]

    let stream = null
    let lastError = null

    for (const candidate of initialCandidates) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: candidate, audio: false })
        break
      } catch (error) {
        lastError = error
      }
    }

    if (!stream) {
      throw lastError || new Error('Nepavyko pasiekti kameros')
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const rearCamera = chooseRearCamera(devices)
      if (rearCamera?.deviceId) {
        const selectedTrack = stream.getVideoTracks()[0]
        const selectedId = selectedTrack?.getSettings?.()?.deviceId
        if (selectedId !== rearCamera.deviceId) {
          const replacementStream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...base,
              deviceId: { exact: rearCamera.deviceId }
            },
            audio: false
          })
          stream.getTracks().forEach((track) => track.stop())
          stream = replacementStream
        }
      }
    } catch {
      // keep initial stream when enumerateDevices/deviceId fails
    }

    return stream
  }

  const startDecodeLoop = async () => {
    let reader
    try {
      reader = await ensureReader()
    } catch (error) {
      console.error('ZXing load error:', error)
      setCameraError('Nepavyko įkelti barkodo skaitytuvo. Perkraukite puslapį.')
      return
    }

    const videoElement = videoRef.current
    if (!videoElement) return

    scanningRef.current = true
    setCameraStatus('Nukreipkite kamerą į barkodą')

    reader.decodeFromVideoElement(videoElement, (result, error) => {
      if (!scanningRef.current) return

      if (result) {
        const detectedCode = sanitizeBarcode(result.getText())
        if (!detectedCode) return
        scanningRef.current = false
        setCameraStatus('Barkodas rastas')
        stopCamera()
        processBarcodeInput(detectedCode)
        return
      }

      if (error && error.name !== 'NotFoundException') {
        console.error('ZXing decode error:', error)
      }
    })
  }

  const startCamera = async () => {
    setCameraError('')
    setCameraStatus('Jungiama kamera...')
    setCameraStarting(true)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStarting(false)
      setCameraStatus('')
      setCameraError('Jūsų naršyklė nepalaiko kameros API.')
      return
    }

    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setCameraStarting(false)
      setCameraStatus('')
      setCameraError('Kamera veikia tik per HTTPS. Atidarykite svetainę per saugų adresą.')
      return
    }

    try {
      stopCamera()
      const stream = await openCameraStream()
      streamRef.current = stream

      const track = stream.getVideoTracks()[0]
      const label = (track?.label || '').toLowerCase()
      setUsingFrontCamera(label.includes('front') || label.includes('user'))
      await applyVideoEnhancements(track)

      if (!videoRef.current) {
        throw new Error('Video element not available')
      }

      videoRef.current.srcObject = stream
      videoRef.current.setAttribute('playsinline', 'true')
      await videoRef.current.play()

      setCameraActive(true)
      setCameraStarting(false)
      setCameraError('')
      startDecodeLoop()
    } catch (error) {
      console.error('Start camera error:', error)
      stopCamera()

      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setCameraError('Nėra kameros leidimo. Leiskite Camera teises naršyklėje ir bandykite dar kartą.')
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setCameraError('Kamera nerasta. Patikrinkite ar telefone yra aktyvi kamera.')
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        setCameraError('Kamera užimta kitos programos. Uždarykite kitas apps ir bandykite dar kartą.')
      } else if (error?.name === 'OverconstrainedError') {
        setCameraError('Šis kameros režimas telefone nepalaikomas. Perkraukite puslapį ir bandykite vėl.')
      } else {
        setCameraError('Nepavyko įjungti kameros. Leiskite kameros teises ir bandykite dar kartą.')
      }

      setCameraStarting(false)
      setCameraStatus('')
    }
  }

  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track?.applyConstraints) return

    const nextState = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: nextState }] })
      setTorchOn(nextState)
    } catch (error) {
      console.error('Torch toggle error:', error)
      setCameraError('Nepavyko perjungti žibintuvėlio šiame telefone.')
    }
  }

  const handleBarcodeInput = async (event) => {
    if (event.key !== 'Enter') return
    const barcodeValue = sanitizeBarcode(barcode)
    if (!barcodeValue) return
    await processBarcodeInput(barcodeValue)
    setBarcode('')
    inputRef.current?.focus()
  }

  const handlePartFound = (part) => {
    onBarcodeDetected(part.barcode)
    setBarcode('')
    setScannedPart(null)
    setShowCreateForm(false)
    setCameraError('')
    setCameraStatus('')
    inputRef.current?.focus()
  }

  const handleCreatePart = async (event) => {
    event.preventDefault()
    if (!formData.name) {
      alert('Prašome įvesti detalės pavadinimą')
      return
    }

    const payload = {
      ...formData,
      barcode,
      quantity: Number(formData.quantity) || 1,
      price: Number(formData.price) || 0,
      cost: Number(formData.cost) || 0,
      car_year_from: formData.car_year_from ? Number(formData.car_year_from) : null,
      car_year_to: formData.car_year_to ? Number(formData.car_year_to) : null
    }

    const success = await onNewPart(payload)
    if (!success) return

    setShowCreateForm(false)
    setFormData(DEFAULT_FORM_DATA)
    setBarcode('')
    setCameraStatus('Detalė sėkmingai sukurta')
    inputRef.current?.focus()
  }

  const getGoogleSearchUrl = () => {
    const searchTerm = formData.oe_number || barcode || formData.name
    if (!searchTerm) return ''
    return `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`
  }

  return (
    <div className="scanner-container">
      <div className="scanner-input-section">
        <label>Nuskaitykite barkodą:</label>
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          onKeyDown={handleBarcodeInput}
          placeholder="Čia bus nuskaitytas barkodas..."
          className="barcode-input"
          autoComplete="off"
          disabled={loading}
        />

        <p className="hint">💡 Galite skanuoti kamera arba įvesti kodą ranka ir spausti Enter</p>

        <div className="camera-actions">
          {!cameraActive ? (
            <button type="button" className="btn btn-primary" onClick={startCamera} disabled={cameraStarting}>
              {cameraStarting ? '⏳ Jungiama kamera...' : '📷 Pradėti skanavimą telefonu'}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={stopCamera}>
              ⛔ Sustabdyti kamerą
            </button>
          )}

          {cameraActive && torchSupported && (
            <button type="button" className="btn btn-secondary" onClick={toggleTorch}>
              {torchOn ? '🔦 Išjungti šviesą' : '🔦 Įjungti šviesą'}
            </button>
          )}

          {cameraStatus && <span className="camera-info">{cameraStatus}</span>}
        </div>

        {cameraError && <div className="camera-error">{cameraError}</div>}

        {usingFrontCamera && (
          <div className="camera-warning">Aptikta priekinė kamera. Geriausiam rezultatui naudokite galinę kamerą.</div>
        )}

        {cameraActive && (
          <div className="camera-preview">
            <div className="camera-preview-inner">
              <video ref={videoRef} className="camera-video" muted playsInline autoPlay />
              <div className="scan-overlay" aria-hidden="true">
                <div className="scan-guide" />
              </div>
            </div>
          </div>
        )}
      </div>

      {scannedPart && (
        <div className="scanned-part-card">
          <h3>✓ Rasta detalė:</h3>
          <div className="part-info">
            <p><strong>Pavadinimas:</strong> {scannedPart.name}</p>
            <p><strong>Barkodas:</strong> {scannedPart.barcode}</p>
            {scannedPart.category_name && <p><strong>Kategorija:</strong> {scannedPart.category_name}</p>}
            <p><strong>Kiekis:</strong> {scannedPart.quantity} vnt</p>
            {scannedPart.price > 0 && <p><strong>Kaina:</strong> {scannedPart.price.toFixed(2)} €</p>}
            {(scannedPart.car_make || scannedPart.car_model) && (
              <p style={{ backgroundColor: '#e3f2fd', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #2196f3', marginTop: '10px' }}>
                <strong>🚗 Automobilis:</strong> {scannedPart.car_make && <span>{scannedPart.car_make}</span>} {scannedPart.car_model && <span>{scannedPart.car_model}</span>}
                {(scannedPart.car_year_from || scannedPart.car_year_to) && (
                  <span style={{ marginLeft: '10px', backgroundColor: '#0d47a1', color: 'white', padding: '2px 6px', borderRadius: '3px', fontSize: '12px' }}>
                    {scannedPart.car_year_from && scannedPart.car_year_to
                      ? `${scannedPart.car_year_from}-${scannedPart.car_year_to}`
                      : scannedPart.car_year_from
                        ? `${scannedPart.car_year_from}m.+`
                        : `iki ${scannedPart.car_year_to}m.`}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="part-actions">
            <button className="btn btn-primary" onClick={() => handlePartFound(scannedPart)}>
              ✓ Gerai, tęsti
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setScannedPart(null)
                setShowCreateForm(false)
                setBarcode('')
              }}
            >
              Atšaukti
            </button>
          </div>
        </div>
      )}

      {showCreateForm && !scannedPart && (
        <div className="create-form-card">
          <h3>Naujos detalės forma</h3>
          <p>Detalės su barkodu ({barcode}) nėra. Sukurkite ją:</p>

          <form onSubmit={handleCreatePart}>
            <div className="form-group">
              <label>Detalės pavadinimas *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="pvz. Alyvos filtras"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Kategorija</label>
                <select
                  value={formData.category_id}
                  onChange={(event) => setFormData((prev) => ({ ...prev, category_id: event.target.value }))}
                >
                  <option value="">Pasirinkite...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Kiekis</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(event) => setFormData((prev) => ({ ...prev, quantity: event.target.value }))}
                  min="1"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Pardavimo kaina (€)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(event) => setFormData((prev) => ({ ...prev, price: event.target.value }))}
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Savikaina (€)</label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(event) => setFormData((prev) => ({ ...prev, cost: event.target.value }))}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Aprašymas</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Papildoma informacija..."
                rows="3"
              />
            </div>

            <div style={{ paddingTop: '15px', borderTop: '2px solid #ddd' }}>
              <h4 style={{ marginBottom: '12px', color: '#333' }}>🚗 Automobilio suderinamumas</h4>

              <div className="form-row">
                <div className="form-group">
                  <label>Markė (pvz. Toyota, BMW)</label>
                  <input
                    type="text"
                    value={formData.car_make}
                    onChange={(event) => setFormData((prev) => ({ ...prev, car_make: event.target.value }))}
                    placeholder="pvz. Toyota"
                  />
                </div>

                <div className="form-group">
                  <label>Modelis (pvz. Camry, 320)</label>
                  <input
                    type="text"
                    value={formData.car_model}
                    onChange={(event) => setFormData((prev) => ({ ...prev, car_model: event.target.value }))}
                    placeholder="pvz. Camry"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nuo metų</label>
                  <input
                    type="number"
                    value={formData.car_year_from}
                    onChange={(event) => setFormData((prev) => ({ ...prev, car_year_from: event.target.value }))}
                    placeholder="pvz. 2015"
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                </div>

                <div className="form-group">
                  <label>Iki metų</label>
                  <input
                    type="number"
                    value={formData.car_year_to}
                    onChange={(event) => setFormData((prev) => ({ ...prev, car_year_to: event.target.value }))}
                    placeholder="pvz. 2023"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>OE/Fabrikinis numeris</label>
                <input
                  type="text"
                  value={formData.oe_number}
                  onChange={(event) => setFormData((prev) => ({ ...prev, oe_number: event.target.value }))}
                  placeholder="pvz. 1234567-890, OEM-12345"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Kuriama...' : '✓ Sukurti detalę'}
              </button>
              <a
                className="btn"
                href={getGoogleSearchUrl()}
                target="_blank"
                rel="noreferrer"
                style={{ backgroundColor: '#4285F4', color: 'white', textDecoration: 'none', textAlign: 'center' }}
              >
                🔍 Google paieška
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateForm(false)
                  setBarcode('')
                  inputRef.current?.focus()
                }}
              >
                Atšaukti
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="tips">
        <h4>📌 Patarimai:</h4>
        <ul>
          <li>Laikykite barkodą 10-20 cm atstumu nuo kameros</li>
          <li>Jei per šviesu, išjunkite žibintuvėlį</li>
          <li>Skenavimas automatinis - radus kodą forma atsidarys pati</li>
          <li>Jei detalė neegzistuoja, galite ją iškart sukurti</li>
        </ul>
      </div>
    </div>
  )
}

export default BarcodeScanner
