import React, { useState } from 'react'
import './BarcodeLookup.css'

function BarcodeLookup({ onBarcodeDetected, onNewPart, categories }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [googleResults, setGoogleResults] = useState([])
  const [searchingGoogle, setSearchingGoogle] = useState(false)
  const [viewingResultUrl, setViewingResultUrl] = useState(null)
  const [viewingResultTitle, setViewingResultTitle] = useState('')
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

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setSearching(true)
    setNotFound(false)
    setSearchResult(null)

    try {
      const query = searchQuery.trim()

      const [barcodeResponse, oeResponse, nameResponse] = await Promise.all([
        fetch(`/api/parts/barcode/${encodeURIComponent(query)}`),
        fetch(`/api/parts/oe/${encodeURIComponent(query)}`),
        fetch(`/api/parts/name/${encodeURIComponent(query)}`)
      ])

      const results = []

      if (barcodeResponse.ok) {
        const barcodeData = await barcodeResponse.json()
        results.push(barcodeData)
      }

      if (oeResponse.ok) {
        const oeData = await oeResponse.json()
        const oeParts = Array.isArray(oeData) ? oeData : [oeData]
        results.push(...oeParts)
      }

      if (nameResponse.ok) {
        const nameData = await nameResponse.json()
        const nameParts = Array.isArray(nameData) ? nameData : [nameData]
        results.push(...nameParts)
      }

      const uniqueByBarcode = Array.from(
        new Map(results.map(part => [part.barcode, part])).values()
      )

      if (uniqueByBarcode.length > 0) {
        setSearchResult(uniqueByBarcode.length === 1 ? uniqueByBarcode[0] : uniqueByBarcode)
        if (uniqueByBarcode.length === 1) {
          onBarcodeDetected(uniqueByBarcode[0].barcode)
        }
      } else {
        setNotFound(true)
      }
    } catch (error) {
      console.error('Error searching:', error)
      setNotFound(true)
    } finally {
      setSearching(false)
    }
  }

  const handleGoogleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setSearchingGoogle(true)
    setGoogleResults([])
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`)
      const results = await response.json()
      if (Array.isArray(results) && results.length > 0) {
        setGoogleResults(results)
      } else {
        setGoogleResults([])
      }
    } catch (error) {
      console.error('Error searching:', error)
      setGoogleResults([])
    } finally {
      setSearchingGoogle(false)
    }
  }

  const handleOpenGoogleNewWindow = (term) => {
    const query = (term || '').trim()
    if (!query) return
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
  }

  const handleFormGoogleSearch = async () => {
    const searchTerm = formData.oe_number || formData.name || searchQuery.trim()
    if (!searchTerm) return
    
    setSearchingGoogle(true)
    setGoogleResults([])
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`)
      const results = await response.json()
      if (Array.isArray(results) && results.length > 0) {
        setGoogleResults(results)
      } else {
        setGoogleResults([])
      }
    } catch (error) {
      console.error('Error searching:', error)
      setGoogleResults([])
    } finally {
      setSearchingGoogle(false)
    }
  }

  const handleCreatePart = async () => {
    if (!searchQuery.trim()) {
      alert('Prašome įvesti barkodą paieškoje prieš kuriant detalę')
      return
    }
    if (!formData.name.trim()) {
      alert('Prašome įvesti detalės pavadinimą')
      return
    }

    try {
      const response = await fetch('/api/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: searchQuery.trim(),
          name: formData.name,
          category_id: formData.category_id || null,
          quantity: formData.quantity,
          price: formData.price,
          cost: formData.cost,
          description: formData.description,
          car_make: formData.car_make,
          car_model: formData.car_model,
          car_year_from: formData.car_year_from || null,
          car_year_to: formData.car_year_to || null,
          oe_number: formData.oe_number
        })
      })

      if (response.ok) {
        const newPart = await response.json()
        onBarcodeDetected(newPart.barcode)
        setShowCreateForm(false)
        setNotFound(false)
        setSearchQuery('')
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
        alert('✓ Detalė sėkmingai sukurta!')
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || '❌ Klaida kuriant detalę')
      }
    } catch (error) {
      console.error('Error creating part:', error)
      alert('❌ Klaida kuriant detalę')
    }
  }

  return (
    <div className="lookup-container">
      <form onSubmit={handleSearch} className="lookup-form">
        <h2>🔎 Paieška</h2>
        
        <div className="search-type-selector">
          <label>Ieškoma pagal barkodą, OE numerį arba pavadinimą</label>
        </div>
        
        <div className="search-group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Įveskite barkodą, OE numerį arba detalės pavadinimą..."
            className="search-input"
          />
          <button type="submit" className="search-btn" disabled={searching}>
            {searching ? '⏳ Ieškoma...' : '🔍 Ieškoti'}
          </button>
        </div>
      </form>

      {searchResult && (
        <div className="result-card">
          <h3>✓ Rasta:</h3>
          {Array.isArray(searchResult) ? (
            <div className="results-list">
              {searchResult.map((part, idx) => (
                <div key={idx} className="result-item">
                  <div className="result-details">
                    <div className="detail-row">
                      <span className="label">Pavadinimas:</span>
                      <span className="value">{part.name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Barkodas:</span>
                      <span className="value">{part.barcode}</span>
                    </div>
                    {part.oe_number && (
                      <div className="detail-row">
                        <span className="label">OE Nr.:</span>
                        <span className="value oe-value">{part.oe_number}</span>
                      </div>
                    )}
                    {part.category_name && (
                      <div className="detail-row">
                        <span className="label">Kategorija:</span>
                        <span className="value">{part.category_name}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Kiekis:</span>
                      <span className="value quantity">{part.quantity} vnt</span>
                    </div>
                  </div>
                  <button
                    className="select-btn"
                    onClick={() => {
                      setSearchResult(part)
                      onBarcodeDetected(part.barcode)
                    }}
                  >
                    ✓ Pasirinkti
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="result-details">
                <div className="detail-row">
                  <span className="label">Pavadinimas:</span>
                  <span className="value">{searchResult.name}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Barkodas:</span>
                  <span className="value">{searchResult.barcode}</span>
                </div>
                {searchResult.oe_number && (
                  <div className="detail-row">
                    <span className="label">OE Nr.:</span>
                    <span className="value oe-value">{searchResult.oe_number}</span>
                  </div>
                )}
                {searchResult.category_name && (
                  <div className="detail-row">
                    <span className="label">Kategorija:</span>
                    <span className="value">{searchResult.category_name}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="label">Kiekis:</span>
                  <span className="value quantity">{searchResult.quantity} vnt</span>
                </div>
                {searchResult.price > 0 && (
                  <div className="detail-row">
                    <span className="label">Kaina:</span>
                    <span className="value price">{searchResult.price.toFixed(2)} €</span>
                  </div>
                )}
                {searchResult.cost > 0 && (
                  <div className="detail-row">
                    <span className="label">Savikaina:</span>
                    <span className="value cost">{searchResult.cost.toFixed(2)} €</span>
                  </div>
                )}
                {searchResult.description && (
                  <div className="detail-row">
                    <span className="label">Aprašymas:</span>
                    <span className="value">{searchResult.description}</span>
                  </div>
                )}
                {(searchResult.car_make || searchResult.car_model) && (
                  <div className="detail-row auto-row">
                    <span className="label">🚗 Automobilis:</span>
                    <span className="value auto-value">
                      {searchResult.car_make && <span>{searchResult.car_make}</span>}
                      {searchResult.car_model && <span> {searchResult.car_model}</span>}
                      {(searchResult.car_year_from || searchResult.car_year_to) && (
                        <span className="year-badge">
                          {searchResult.car_year_from && searchResult.car_year_to 
                            ? `${searchResult.car_year_from}-${searchResult.car_year_to}` 
                            : searchResult.car_year_from 
                            ? `${searchResult.car_year_from}m.+` 
                            : `iki ${searchResult.car_year_to}m.`}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                <button 
                  className="btn-new-search"
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResult(null)
                  }}
                >
                  ← Nauja paieška
                </button>
                <a
                  className="btn-google-search"
                  href={`https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-block', backgroundColor: '#4285F4', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', textDecoration: 'none' }}
                >
                  🔍 Google
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {notFound && !searchResult && (
        <div className="not-found-card">
          <h3>❌ Detalė nerasta</h3>
          <p>Pagal Jūsų paieškos kriterijus detalė nebuvo rasta duomenų bazėje.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
            <button 
              className="btn-new-search"
              onClick={() => {
                setSearchQuery('')
                setNotFound(false)
              }}
            >
              ← Bandyti iš naujo
            </button>
            <a
              className="btn-google-search"
              href={`https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', backgroundColor: '#4285F4', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'none' }}
            >
              🔍 Ieškoti Google
            </a>
          </div>

          {!showCreateForm ? (
            <button 
              onClick={() => setShowCreateForm(true)}
              style={{ display: 'block', margin: '15px auto', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            >
              ➕ Pridėti detalę rankiniu būdu
            </button>
          ) : (
            <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '5px', marginTop: '15px' }}>
              <h4>Naujos detalės duomenys:</h4>
              
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Pavadinimas *</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Detalės pavadinimas"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>OE/Fabrikinis numeris</label>
                <input 
                  type="text"
                  value={formData.oe_number}
                  onChange={(e) => setFormData({...formData, oe_number: e.target.value})}
                  placeholder="pvz. 1234567-890"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Kategorija</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  >
                    <option value="">Pasirinkite kategorija</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Kiekis</label>
                  <input 
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
                    min="0"
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Kaina (€)</label>
                  <input 
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                    step="0.01"
                    min="0"
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Savikaina (€)</label>
                  <input 
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({...formData, cost: parseFloat(e.target.value)})}
                    step="0.01"
                    min="0"
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Markė</label>
                  <input 
                    type="text"
                    value={formData.car_make}
                    onChange={(e) => setFormData({...formData, car_make: e.target.value})}
                    placeholder="pvz. Toyota"
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Modelis</label>
                  <input 
                    type="text"
                    value={formData.car_model}
                    onChange={(e) => setFormData({...formData, car_model: e.target.value})}
                    placeholder="pvz. Camry"
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Nuo metų</label>
                  <input 
                    type="number"
                    value={formData.car_year_from}
                    onChange={(e) => setFormData({...formData, car_year_from: e.target.value})}
                    placeholder="2015"
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Iki metų</label>
                  <input 
                    type="number"
                    value={formData.car_year_to}
                    onChange={(e) => setFormData({...formData, car_year_to: e.target.value})}
                    placeholder="2023"
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Aprašymas</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Detalės aprašymas"
                  rows="3"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontFamily: 'Arial' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button 
                  onClick={handleCreatePart}
                  style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✓ Sukurti detalę
                </button>
                <button 
                  onClick={() => setShowCreateForm(false)}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✕ Atšaukti
                </button>
              </div>
            </div>
          )}

          {(googleResults.length > 0 || searchingGoogle) && (
            <div style={{ backgroundColor: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '5px', padding: '15px', marginTop: '15px', textAlign: 'left' }}>
              <h3>🔍 Paieškos rezultatai:</h3>
              {searchingGoogle && (
                <p style={{ textAlign: 'center', color: '#ff9800', fontWeight: 'bold' }}>⏳ Ieškoma rezultatų...</p>
              )}
              {!searchingGoogle && googleResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {googleResults.map((result, idx) => (
                    <div key={idx} style={{ 
                      backgroundColor: 'white', 
                      padding: '10px', 
                      borderRadius: '4px', 
                      borderLeft: `4px solid ${result.isLocal ? '#4CAF50' : '#ff9800'}`
                    }}>
                      <h4 style={{ margin: '0 0 5px 0', color: '#1e88e5' }}>{result.title}</h4>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>{result.description}</p>
                      {result.url !== '#local-result' && (
                        <div style={{ fontSize: '12px', color: '#ff9800' }}>
                          🔗 Nuoroda: {result.url}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!searchingGoogle && googleResults.length > 0 && (
                <button 
                  onClick={() => setGoogleResults([])}
                  style={{ marginTop: '10px', padding: '8px 15px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✕ Uždaryti rezultatus
                </button>
              )}
            </div>
          )}

        </div>
      )}

      <div className="lookup-info">
        <p>💡 Naudokite šią funkciją norint greitai paieškoti detalės barkodą</p>
      </div>
    </div>
  )
}

export default BarcodeLookup
