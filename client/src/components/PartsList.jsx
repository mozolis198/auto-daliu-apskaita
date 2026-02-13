import React, { useState } from 'react'
import './PartsList.css'

function PartsList({ parts, categories, onRefresh, onPartUpdate }) {
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState('name')

  const categoryMap = (Array.isArray(categories) ? categories : []).reduce((acc, cat) => {
    acc[cat.id] = cat.name
    return acc
  }, {})

  const handleEdit = (part) => {
    setEditingId(part.id)
    setEditData({ ...part })
  }

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/parts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          category_id: editData.category_id,
          price: editData.price,
          cost: editData.cost,
          description: editData.description,
          car_make: editData.car_make || '',
          car_model: editData.car_model || '',
          car_year_from: editData.car_year_from || null,
          car_year_to: editData.car_year_to || null,
          oe_number: editData.oe_number || ''
        })
      })
      if (response.ok) {
        setEditingId(null)
        onPartUpdate()
      }
    } catch (error) {
      console.error('Error updating part:', error)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditData({})
  }

  const handleGoogleSearch = (part) => {
    const searchTerm = part.oe_number ? part.oe_number : part.name
    const query = encodeURIComponent(searchTerm)
    window.open(`https://www.google.com/search?q=${query}`, '_blank')
  }

  const handleQuantityChange = (part, delta) => {
    const newQuantity = Math.max(0, part.quantity + delta)
    updateQuantity(part.id, newQuantity)
  }

  const updateQuantity = async (partId, newQuantity) => {
    try {
      const response = await fetch(`/api/parts/${partId}/quantity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: newQuantity,
          action: 'set'
        })
      })
      if (response.ok) {
        onPartUpdate()
      }
    } catch (error) {
      console.error('Error updating quantity:', error)
    }
  }

  const filteredParts = (Array.isArray(parts) ? parts : []).filter(part =>
    part.name.toLowerCase().includes(filter.toLowerCase()) ||
    part.barcode.includes(filter) ||
    (part.oe_number && part.oe_number.toLowerCase().includes(filter.toLowerCase()))
  )

  const sortedParts = [...filteredParts].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'quantity') return b.quantity - a.quantity
    if (sortBy === 'price') return (b.price || 0) - (a.price || 0)
    return 0
  })

  return (
    <div className="parts-list-container">
      <div className="list-controls">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Ieškoti pagal pavadinimą arba barkodiniu..."
          className="filter-input"
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
          <option value="name">Rikiuoti pagal pavadinimą</option>
          <option value="quantity">Rikiuoti pagal kiekį</option>
          <option value="price">Rikiuoti pagal kainą</option>
        </select>
        <button onClick={onRefresh} className="refresh-btn">🔄 Atnaujinti</button>
      </div>

      {sortedParts.length === 0 ? (
        <div className="empty-state">
          <p>📭 Nėra detalių</p>
        </div>
      ) : (
        <>
          <div className="list-stats">
            <span>{sortedParts.length} detalių iš viso</span>
            <span>Nuosavybės vertė: {(sortedParts.reduce((sum, p) => sum + ((p.price || 0) * p.quantity), 0)).toFixed(2)} €</span>
          </div>

          <div className="parts-grid">
            {sortedParts.map(part => (
              <div key={part.id} className="part-card">
                <div className="part-header">
                  <h3>{part.name}</h3>
                  {part.category_name && (
                    <span className="category-badge">{part.category_name}</span>
                  )}
                </div>

                <div className="part-meta">
                  <p><strong>Barkodas:</strong> {part.barcode}</p>
                  {part.oe_number && (
                    <p><strong>OE Nr.:</strong> <span className="oe-num">{part.oe_number}</span></p>
                  )}
                </div>

                {(part.car_make || part.car_model) && (
                  <div className="part-auto-info">
                    <strong>🚗 Automobilis:</strong>
                    <p>
                      {part.car_make && <span>{part.car_make}</span>}
                      {part.car_model && <span> {part.car_model}</span>}
                      {(part.car_year_from || part.car_year_to) && (
                        <span className="year-range">
                          {part.car_year_from && part.car_year_to ? `${part.car_year_from}-${part.car_year_to}` : part.car_year_from ? `${part.car_year_from}m.+` : `iki ${part.car_year_to}m.`}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <div className="part-quantity">
                  <span className="label">Kiekis:</span>
                  {editingId === part.id ? (
                    <input
                      type="number"
                      value={editData.quantity}
                      onChange={(e) => setEditData({ ...editData, quantity: parseInt(e.target.value) })}
                      className="qty-input"
                      min="0"
                    />
                  ) : (
                    <span className={`quantity ${part.quantity === 0 ? 'low' : 'normal'}`}>
                      {part.quantity} vnt
                    </span>
                  )}
                </div>

                <div className="part-price-row">
                  {part.price > 0 && (
                    <div><strong>Kaina:</strong> {part.price.toFixed(2)} €</div>
                  )}
                  {part.cost > 0 && (
                    <div><strong>Savikaina:</strong> {part.cost.toFixed(2)} €</div>
                  )}
                </div>

                {part.description && (
                  <p className="description">{part.description}</p>
                )}

                {editingId === part.id && (
                  <div style={{ backgroundColor: '#f0f0f0', padding: '12px', borderRadius: '5px', margin: '10px 0' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '12px', fontWeight: '600' }}>Pavadinimas</label>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        style={{ width: '100%', padding: '6px', marginBottom: '8px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '12px', fontWeight: '600' }}>Markė</label>
                      <input
                        type="text"
                        value={editData.car_make || ''}
                        onChange={(e) => setEditData({ ...editData, car_make: e.target.value })}
                        placeholder="pvz. Toyota"
                        style={{ width: '100%', padding: '6px', marginBottom: '8px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '12px', fontWeight: '600' }}>Modelis</label>
                      <input
                        type="text"
                        value={editData.car_model || ''}
                        onChange={(e) => setEditData({ ...editData, car_model: e.target.value })}
                        placeholder="pvz. Camry"
                        style={{ width: '100%', padding: '6px', marginBottom: '8px' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div className="form-group">
                        <label style={{ fontSize: '12px', fontWeight: '600' }}>Nuo metų</label>
                        <input
                          type="number"
                          value={editData.car_year_from || ''}
                          onChange={(e) => setEditData({ ...editData, car_year_from: e.target.value })}
                          placeholder="2015"
                          style={{ width: '100%', padding: '6px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: '12px', fontWeight: '600' }}>Iki metų</label>
                        <input
                          type="number"
                          value={editData.car_year_to || ''}
                          onChange={(e) => setEditData({ ...editData, car_year_to: e.target.value })}
                          placeholder="2023"
                          style={{ width: '100%', padding: '6px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editingId === part.id && (
                  <div style={{ paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '12px', fontWeight: '600' }}>OE/Fabrikinis Numeris</label>
                      <input
                        type="text"
                        value={editData.oe_number || ''}
                        onChange={(e) => setEditData({ ...editData, oe_number: e.target.value })}
                        placeholder="pvz. 1234567-890"
                        style={{ width: '100%', padding: '6px' }}
                      />
                    </div>
                  </div>
                )}

                <div className="part-actions">
                  {editingId === part.id ? (
                    <>
                      <button className="btn-small btn-save" onClick={handleSave}>✓ Išsaugoti</button>
                      <button className="btn-small btn-cancel" onClick={handleCancel}>✕ Atšaukti</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-small btn-qty-minus" onClick={() => handleQuantityChange(part, -1)}>➖</button>
                      <button className="btn-small btn-qty-plus" onClick={() => handleQuantityChange(part, 1)}>➕</button>
                      <button className="btn-small btn-edit" onClick={() => handleEdit(part)}>✏️ Redaguoti</button>
                      <button className="btn-small btn-google" onClick={() => handleGoogleSearch(part)} style={{ backgroundColor: '#4285F4', color: 'white' }}>🔍 Google</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default PartsList
