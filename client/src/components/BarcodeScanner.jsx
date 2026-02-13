import React, { useState, useRef, useEffect } from 'react'
import './BarcodeScanner.css'

function BarcodeScanner({ onBarcodeDetected, onNewPart, categories, loading }) {
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanningRef = useRef(false)
  const lastScanRef = useRef({ value: '', timestamp: 0 })
  const detectorRef = useRef(null)
  const zxingReaderRef = useRef(null)
  const zxingLoadingRef = useRef(false)
  const [barcode, setBarcode] = useState('')
  const [scannedPart, setScannedPart] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [detectorSupported, setDetectorSupported] = useState(false)
  const [detectorDisabled, setDetectorDisabled] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const isAndroid = /Android/i.test(navigator.userAgent || '')
  const [scanEngine, setScanEngine] = useState('')
  const [preferredEngine, setPreferredEngine] = useState('auto')
  const [supportedFormats, setSupportedFormats] = useState([])
  const [usingFrontCamera, setUsingFrontCamera] = useState(false)
  const [formData, setFormData] = useState({
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
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const supported = 'BarcodeDetector' in window
    setDetectorSupported(supported)
    if (supported) {
      BarcodeDetector.getSupportedFormats()
        .then((formats) => setSupportedFormats(formats || []))
        .catch(() => setSupportedFormats([]))
    }
  }, [isAndroid])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const ensureZXingReader = async () => {
    if (zxingReaderRef.current) return zxingReaderRef.current
    if (zxingLoadingRef.current) return null
    zxingLoadingRef.current = true
    try {
      const module = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm')
      let reader
      try {
        if (module.DecodeHintType && module.BarcodeFormat) {
          const hints = new Map()
          hints.set(module.DecodeHintType.TRY_HARDER, true)
          hints.set(module.DecodeHintType.POSSIBLE_FORMATS, [
            module.BarcodeFormat.EAN_13,
            module.BarcodeFormat.EAN_8,
            module.BarcodeFormat.CODE_128,
            module.BarcodeFormat.CODE_39,
            module.BarcodeFormat.UPC_A,
            module.BarcodeFormat.UPC_E,
            module.BarcodeFormat.ITF,
            module.BarcodeFormat.CODABAR
          ])
          reader = new module.BrowserMultiFormatReader(hints, 300)
        } else {
          reader = new module.BrowserMultiFormatReader()
        }
      } catch (hintError) {
        console.warn('ZXing hints init failed:', hintError)
        reader = new module.BrowserMultiFormatReader()
      }
      zxingReaderRef.current = reader
      return reader
    } catch (error) {
      console.error('ZXing load error:', error)
      return null
    } finally {
      zxingLoadingRef.current = false
    }
  }

  const handleBarcodeInput = async (e) => {
    if (e.key === 'Enter' && barcode.trim()) {
      const barcodeValue = sanitizeBarcode(barcode.trim())
      await processBarcodeInput(barcodeValue)
      setBarcode('')
      inputRef.current?.focus()
    }
  }

  const sanitizeBarcode = (value) => {
    if (!value) return ''
    return value.replace(/[\s\r\n\t]/g, '').replace(/[\u0010-\u001f]/g, '')
  }

  const processBarcodeInput = async (barcodeValue) => {
    if (!barcodeValue) return
    const now = Date.now()
    if (lastScanRef.current.value === barcodeValue && now - lastScanRef.current.timestamp < 1500) {
      return
    }
    lastScanRef.current = { value: barcodeValue, timestamp: now }
    try {
      const response = await fetch(`/api/parts/barcode/${encodeURIComponent(barcodeValue)}`)
      if (response.ok) {
        const part = await response.json()
        setScannedPart(part)
        setShowCreateForm(false)
      } else {
        setScannedPart(null)
        setShowCreateForm(true)
        setFormData(prev => ({ ...prev, barcode: barcodeValue }))
      }
    } catch (error) {
      console.error('Error processing barcode:', error)
    }
  }

  const startCamera = async () => {
    setCameraError('')
    if (zxingReaderRef.current) {
      zxingReaderRef.current.reset()
      zxingReaderRef.current = null
    }
    if (detectorRef.current) {
      detectorRef.current = null
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Ši naršyklė nepalaiko kameros API.')
      return
    }

    try {
      const getStream = async (constraints) => {
        return navigator.mediaDevices.getUserMedia({
          video: constraints,
          audio: false
        })
      }

      const exactEnvironmentConstraints = {
        facingMode: { exact: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }

      const idealEnvironmentConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }

      const genericConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }

      const streamCandidates = isAndroid
        ? [idealEnvironmentConstraints, exactEnvironmentConstraints, genericConstraints]
        : [exactEnvironmentConstraints, idealEnvironmentConstraints, genericConstraints]

      let stream
      let lastStreamError = null
      for (const candidate of streamCandidates) {
        try {
          stream = await getStream(candidate)
          break
        } catch (streamError) {
          lastStreamError = streamError
        }
      }

      if (!stream) {
        throw lastStreamError || new Error('Failed to open camera stream')
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        if (isAndroid) {
          videoRef.current.setAttribute('autofocus', 'true')
        }
        await videoRef.current.play()
      }

      const trackLabel = stream.getVideoTracks()[0]?.label?.toLowerCase?.() || ''
      setUsingFrontCamera(trackLabel.includes('front') || trackLabel.includes('user'))

      setTimeout(async () => {
        const videoEl = videoRef.current
        if (!videoEl || videoEl.videoWidth > 0) return
        streamRef.current?.getTracks().forEach(track => track.stop())
        try {
            stream = await getStream(idealEnvironmentConstraints)
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }
          const fallbackLabel = stream.getVideoTracks()[0]?.label?.toLowerCase?.() || ''
          setUsingFrontCamera(fallbackLabel.includes('front') || fallbackLabel.includes('user'))
          setTimeout(() => {
            const retryVideo = videoRef.current
            if (retryVideo && retryVideo.videoWidth === 0) {
              setCameraError('Kamera neperduoda vaizdo. Patikrinkite leidimus ir bandykite kitą naršyklę (Chrome/Samsung Internet).')
            }
          }, 800)
        } catch (fallbackError) {
          console.error('Camera fallback error:', fallbackError)
          try {
            stream = await getStream({ width: { ideal: 1280 }, height: { ideal: 720 } })
            streamRef.current = stream
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              await videoRef.current.play()
            }
            const anyLabel = stream.getVideoTracks()[0]?.label?.toLowerCase?.() || ''
            setUsingFrontCamera(anyLabel.includes('front') || anyLabel.includes('user'))
          } catch (finalError) {
            console.error('Camera final error:', finalError)
            setCameraError('Nepavyko įjungti kameros. Patikrinkite leidimus.')
          }
        }
      }, 700)

      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack?.getCapabilities) {
        const capabilities = videoTrack.getCapabilities()
        if (capabilities?.torch) {
          setTorchSupported(true)
          videoTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {})
        }
        const advancedConstraints = []
        if (capabilities?.focusMode?.includes?.('continuous')) {
          advancedConstraints.push({ focusMode: 'continuous' })
        } else if (capabilities?.focusMode?.includes?.('auto')) {
          advancedConstraints.push({ focusMode: 'auto' })
        }
        if (capabilities?.exposureMode?.includes?.('continuous')) {
          advancedConstraints.push({ exposureMode: 'continuous' })
        } else if (capabilities?.exposureMode?.includes?.('auto')) {
          advancedConstraints.push({ exposureMode: 'auto' })
        }
        if (capabilities?.whiteBalanceMode?.includes?.('continuous')) {
          advancedConstraints.push({ whiteBalanceMode: 'continuous' })
        } else if (capabilities?.whiteBalanceMode?.includes?.('auto')) {
          advancedConstraints.push({ whiteBalanceMode: 'auto' })
        }
        if (capabilities?.resizeMode?.includes?.('crop-and-scale')) {
          advancedConstraints.push({ resizeMode: 'crop-and-scale' })
        }
        if (advancedConstraints.length > 0) {
          videoTrack.applyConstraints({ advanced: advancedConstraints }).catch(() => {})
        }
      }

      const canUseDetector = 'BarcodeDetector' in window && !detectorDisabled
      const shouldUseDetector = canUseDetector && preferredEngine !== 'zxing'

      const startZXingScan = async () => {
        setScanEngine('ZXing')
        setCameraError('')
        const reader = await ensureZXingReader()
        if (!reader) {
          setCameraError('Nepavyko įkelti ZXing. Patikrinkite ryšį ir bandykite dar kartą.')
          return
        }
        await reader.reset()
        scanningRef.current = true
        const decodeCallback = (result, error) => {
          if (result) {
            const detected = sanitizeBarcode(result.getText())
            if (!detected) return
            scanningRef.current = false
            stopCamera()
            setBarcode(detected)
            processBarcodeInput(detected)
          } else if (error && error.name !== 'NotFoundException') {
            console.error('ZXing scan error:', error)
            setCameraError(`ZXing klaida: ${error.name || 'nežinoma'}`)
          }
        }
        reader.decodeFromVideoElement(videoRef.current, decodeCallback)
      }

      if (shouldUseDetector) {
        const formats = Array.isArray(supportedFormats) && supportedFormats.length > 0
          ? supportedFormats
          : [
            'qr_code',
            'code_128',
            'ean_13',
            'ean_8',
            'code_39',
            'code_93',
            'upc_a',
            'upc_e',
            'itf',
            'codabar',
            'data_matrix'
          ]
        detectorRef.current = new BarcodeDetector({ formats })
      }

      setCameraActive(true)
      if (shouldUseDetector) {
        setScanEngine('BarcodeDetector')
        setCameraError('')
        scanningRef.current = true
        scanFrame()
      } else {
        await startZXingScan()
        setTimeout(() => {
          if (scanningRef.current) {
            setCameraError('Nuskaitoma... Jei nieko neranda, pabandykite „ZXing“ režimą ir priartinti barkodą.')
          }
        }, 2000)
      }

      if (videoRef.current) {
        videoRef.current.setAttribute('autofocus', 'true')
        videoRef.current.setAttribute('data-autofocus', 'true')
      }
    } catch (error) {
      console.error('Camera start error:', error)
      setCameraError('Nepavyko įjungti kameros. Patikrinkite leidimus.')
    }
  }

  const stopCamera = () => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (zxingReaderRef.current) {
      zxingReaderRef.current.reset()
      zxingReaderRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setTorchOn(false)
    setScanEngine('')
  }

  const scanFrame = async () => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) return

    if (videoRef.current.readyState >= 2) {
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current)
        if (barcodes.length > 0) {
          const detected = sanitizeBarcode(barcodes[0].rawValue)
          scanningRef.current = false
          stopCamera()
          setBarcode(detected)
          await processBarcodeInput(detected)
          return
        }
      } catch (error) {
        console.error('Scan error:', error)
        const shouldFallbackToZXing = preferredEngine === 'auto'
        if (shouldFallbackToZXing) {
          detectorRef.current = null
          setCameraError('BarcodeDetector nepavyko. Perjungiama į ZXing...')
          const reader = await ensureZXingReader()
          if (!reader) {
            setCameraError('Nepavyko įkelti ZXing po BarcodeDetector klaidos.')
            return
          }
          await reader.reset()
          const decodeCallback = (result, zxingError) => {
            if (result) {
              const detected = sanitizeBarcode(result.getText())
              if (!detected) return
              scanningRef.current = false
              stopCamera()
              setBarcode(detected)
              processBarcodeInput(detected)
            } else if (zxingError && zxingError.name !== 'NotFoundException') {
              console.error('ZXing scan error:', zxingError)
              setCameraError(`ZXing klaida: ${zxingError.name || 'nežinoma'}`)
            }
          }
          reader.decodeFromVideoElement(videoRef.current, decodeCallback)
          setScanEngine('ZXing')
          return
        }

        setCameraError(`BarcodeDetector klaida: ${error.name || 'nežinoma'}`)
      }
    }

    requestAnimationFrame(scanFrame)
  }

  const toggleTorch = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track?.applyConstraints) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch (error) {
      console.error('Torch error:', error)
    }
  }

  const handlePartFound = (part) => {
    onBarcodeDetected(part.barcode)
    setBarcode('')
    setScannedPart(null)
  }

  const handleCreatePart = async (e) => {
    e.preventDefault()
    if (!formData.name) {
      alert('Prašome įvesti detalės pavadinimą')
      return
    }

    const success = await onNewPart({
      ...formData,
      barcode: barcode
    })

    if (success) {
      setShowCreateForm(false)
      setFormData({
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
      })
      setBarcode('')
      inputRef.current?.focus()
    }
  }

  const getGoogleSearchUrl = () => {
    const searchTerm = formData.oe_number || barcode || formData.name
    if (!searchTerm) return ''
    return `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`
  }

  return (
    <div className="scanner-container">
      <div className="scanner-input-section">
        <label>Nuskaitykite barkodiniu:</label>
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyPress={handleBarcodeInput}
          placeholder="Čia bus skaitytas barkodas..."
          className="barcode-input"
          autoComplete="off"
          disabled={loading}
        />
        <p className="hint">💡 Sutelkite kursoriumi į šį laukelį ir nuskaitykite barkodinį tiesiog jam</p>
        <div className="camera-actions">
          {!cameraActive ? (
            <button type="button" className="btn btn-primary" onClick={startCamera}>
              📷 Įjungti kamerą
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={stopCamera}>
              ⛔ Išjungti kamerą
            </button>
          )}
          {torchSupported && cameraActive && (
            <button type="button" className="btn btn-secondary" onClick={toggleTorch}>
              {torchOn ? '🔦 Išjungti šviesą' : '🔦 Įjungti šviesą'}
            </button>
          )}
          <div className="engine-toggle">
            <span className="engine-label">Skaitytuvas:</span>
            {!isAndroid && (
              <button
                type="button"
                className={`btn btn-secondary ${preferredEngine === 'auto' ? 'active' : ''}`}
                onClick={() => setPreferredEngine('auto')}
                disabled={cameraActive}
              >
                Auto
              </button>
            )}
            <button
              type="button"
              className={`btn btn-secondary ${preferredEngine === 'zxing' ? 'active' : ''}`}
              onClick={() => setPreferredEngine('zxing')}
              disabled={cameraActive}
            >
              ZXing
            </button>
            <button
              type="button"
              className={`btn btn-secondary ${preferredEngine === 'detector' ? 'active' : ''}`}
              onClick={() => {
                setDetectorDisabled(false)
                setPreferredEngine('detector')
              }}
              disabled={cameraActive || !detectorSupported}
            >
              Detector
            </button>
            {detectorSupported && (
              <button
                type="button"
                className={`btn btn-secondary ${detectorDisabled ? 'active' : ''}`}
                onClick={() => {
                  setDetectorDisabled(true)
                  setPreferredEngine('zxing')
                }}
                disabled={cameraActive}
              >
                Išjungti Detector
              </button>
            )}
          </div>
          {supportedFormats.length > 0 && (
            <span className="camera-info">BarcodeDetector formatai: {supportedFormats.join(', ')}</span>
          )}
          {!detectorSupported && (
            <span className="camera-warning">Naršyklė nepalaiko BarcodeDetector. Bus naudojamas ZXing.</span>
          )}
          {scanEngine && (
            <span className="camera-info">Aktyvus skaitytuvas: {scanEngine}</span>
          )}
        </div>
        {cameraError && <div className="camera-error">{cameraError}</div>}
        {usingFrontCamera && (
          <div className="camera-error">Įjungta priekinė kamera. Jei įmanoma, naršyklė turi naudoti galinę kamerą.</div>
        )}
        {cameraActive && (
          <div className="camera-preview">
            <video ref={videoRef} className="camera-video" muted playsInline autoPlay />
          </div>
        )}
      </div>

      {scannedPart && (
        <div className="scanned-part-card">
          <h3>✓ Rasta detalė:</h3>
          <div className="part-info">
            <p><strong>Pavadinimas:</strong> {scannedPart.name}</p>
            <p><strong>Barkodas:</strong> {scannedPart.barcode}</p>
            {scannedPart.category_name && (
              <p><strong>Kategorija:</strong> {scannedPart.category_name}</p>
            )}
            <p><strong>Kiekis:</strong> {scannedPart.quantity} vnt</p>
            {scannedPart.price > 0 && (
              <p><strong>Kaina:</strong> {scannedPart.price.toFixed(2)} €</p>
            )}
            {(scannedPart.car_make || scannedPart.car_model) && (
              <p style={{ backgroundColor: '#e3f2fd', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #2196f3', marginTop: '10px' }}>
                <strong>🚗 Automobilis:</strong> {scannedPart.car_make && <span>{scannedPart.car_make}</span>} {scannedPart.car_model && <span>{scannedPart.car_model}</span>}
                {(scannedPart.car_year_from || scannedPart.car_year_to) && (
                  <span style={{ marginLeft: '10px', backgroundColor: '#0d47a1', color: 'white', padding: '2px 6px', borderRadius: '3px', fontSize: '12px' }}>
                    {scannedPart.car_year_from && scannedPart.car_year_to ? `${scannedPart.car_year_from}-${scannedPart.car_year_to}` : scannedPart.car_year_from ? `${scannedPart.car_year_from}m.+` : `iki ${scannedPart.car_year_to}m.`}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="part-actions">
            <button 
              className="btn btn-primary"
              onClick={() => handlePartFound(scannedPart)}
            >
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
          <p>Detalės su šituo barkodu ({barcode}) nėra. Sukurkite ją:</p>
          
          <form onSubmit={handleCreatePart}>
            <div className="form-group">
              <label>Detalės pavadinimas *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="pvz. Alyvos filtras"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Kategorija</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                >
                  <option value="">Pasirinkite...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Kiekis</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Savikaina (€)</label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) }))}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Aprašymas</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Papildoma informacija..."
                rows="3"
              ></textarea>
            </div>

            <div style={{ paddingTop: '15px', borderTop: '2px solid #ddd' }}>
              <h4 style={{ marginBottom: '12px', color: '#333' }}>🚗 Automobilio Suderinamumas</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Markė (pvz. Toyota, BMW)</label>
                  <input
                    type="text"
                    value={formData.car_make}
                    onChange={(e) => setFormData(prev => ({ ...prev, car_make: e.target.value }))}
                    placeholder="pvz. Toyota"
                  />
                </div>

                <div className="form-group">
                  <label>Modelis (pvz. Camry, 320)</label>
                  <input
                    type="text"
                    value={formData.car_model}
                    onChange={(e) => setFormData(prev => ({ ...prev, car_model: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, car_year_from: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, car_year_to: e.target.value }))}
                    placeholder="pvz. 2023"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>OE/Fabrikinis Numeris</label>
                <input
                  type="text"
                  value={formData.oe_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, oe_number: e.target.value }))}
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
          <li>Naudokite USB barkodskaitytuvo įrenginį arba mobilaus telefono kamerą</li>
          <li>Sutelkite į barkodinį skaitymo laukelį ir nuskaitykite barkodinį</li>
          <li>Jei bitės naujos detalės, ji automatiškai surodysima sukurti</li>
          <li>Jei barkodas jau egzistuoja, bus rodoma esamos detalės informacija</li>
        </ul>
      </div>
    </div>
  )
}

export default BarcodeScanner
