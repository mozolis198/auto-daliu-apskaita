import React, { useState, useEffect, useRef } from 'react'
import BarcodeScanner from './components/BarcodeScanner'
import PartsList from './components/PartsList'
import BarcodeLookup from './components/BarcodeLookup'
import './App.css'

function App() {
  const [parts, setParts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchParts()
    fetchCategories()
  }, [])

  const fetchParts = async () => {
    try {
      const response = await fetch('/api/parts')
      const data = await response.json()
      setParts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching parts:', error)
      showMessage('error', 'Nepavyko gauti detalių sąrašo')
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleBarcodeDetected = async (barcode) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/parts/barcode/${barcode}`)
      if (response.ok) {
        const part = await response.json()
        showMessage('success', `Rasta detalė: ${part.name}`)
        fetchParts()
      } else {
        showMessage('info', `Nėra detalės su šituo barkodu: ${barcode}. Norite ją sukurti?`)
        // Open create dialog
      }
    } catch (error) {
      showMessage('error', 'Klaida skaityti barkodiniu')
    } finally {
      setLoading(false)
    }
  }

  const handleNewPart = async (partData) => {
    try {
      const response = await fetch('/api/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partData)
      })
      if (response.ok) {
        showMessage('success', 'Detalė sėkmingai pridėta!')
        fetchParts()
        return true
      } else {
        const error = await response.json()
        showMessage('error', error.error || 'Klaida pridedant detalę')
        return false
      }
    } catch (error) {
      showMessage('error', 'Klaida: ' + error.message)
      return false
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  return (
    <div className="container">
      <header className="header">
        <h1>📦 Auto Dalių Apskaita</h1>
        <p className="subtitle">Barkodais valdoma apskaita</p>
      </header>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <main className="main-content">
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>📷 Kodo skaitytuvas</h2>
                <p>Greita paieška ir naujų detalių įvedimas</p>
              </div>
            </div>
            <div className="panel-body">
              <BarcodeScanner 
                onBarcodeDetected={handleBarcodeDetected}
                onNewPart={handleNewPart}
                categories={categories}
                loading={loading}
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>📋 Sandėlis</h2>
                <p>Detalių sąrašas ir valdymas</p>
              </div>
              <div className="panel-stats">
                <div className="stat-pill">
                  <span className="stat-value">{parts.length}</span>
                  <span className="stat-label">Dalys</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-value">{(Array.isArray(parts) ? parts : []).reduce((sum, p) => sum + (p.quantity || 0), 0)}</span>
                  <span className="stat-label">Kiekis</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-value">
                    {(Array.isArray(parts) ? parts : []).reduce((sum, p) => sum + ((p.price || 0) * (p.quantity || 0)), 0).toFixed(2)} €
                  </span>
                  <span className="stat-label">Vertė</span>
                </div>
              </div>
            </div>
            <div className="panel-body">
              <PartsList 
                parts={parts}
                categories={categories}
                onRefresh={fetchParts}
                onPartUpdate={() => fetchParts()}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
