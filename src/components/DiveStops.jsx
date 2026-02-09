import { useState } from 'react';

export default function DiveStops({ stops, onStopsChange }) {
  // Track raw input values for free editing
  const [editing, setEditing] = useState({});

  const addStop = () => {
    onStopsChange([...stops, { depth: 10, time: 5 }]);
  };

  const removeStop = (index) => {
    onStopsChange(stops.filter((_, i) => i !== index));
    // Clean up editing state
    const newEditing = {};
    Object.entries(editing).forEach(([key]) => {
      const [, idx] = key.split('-');
      if (Number(idx) !== index) newEditing[key] = editing[key];
    });
    setEditing(newEditing);
  };

  const handleChange = (index, field, rawValue) => {
    const key = `${field}-${index}`;
    setEditing(prev => ({ ...prev, [key]: rawValue }));

    const num = Number(rawValue);
    if (rawValue !== '' && !isNaN(num) && num >= 0) {
      const updated = stops.map((s, i) => {
        if (i !== index) return s;
        return { ...s, [field]: num };
      });
      onStopsChange(updated);
    }
  };

  const handleBlur = (index, field) => {
    const key = `${field}-${index}`;
    setEditing(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getDisplayValue = (index, field, actualValue) => {
    const key = `${field}-${index}`;
    if (key in editing) return editing[key];
    return actualValue;
  };

  const isInvalid = (index, field) => {
    const key = `${field}-${index}`;
    if (!(key in editing)) return false;
    const raw = editing[key];
    if (raw === '') return true;
    const num = Number(raw);
    return isNaN(num) || num < 0 || (field === 'time' && num <= 0);
  };

  const moveStop = (index, direction) => {
    const newStops = [...stops];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newStops.length) return;
    [newStops[index], newStops[targetIndex]] = [newStops[targetIndex], newStops[index]];
    onStopsChange(newStops);
  };

  return (
    <div className="dive-stops">
      <h3>Dive Stops</h3>
      <div className="stops-list">
        {stops.map((stop, i) => (
          <div key={i} className="stop-row">
            <span className="stop-number">{i + 1}</span>
            <div className="stop-field">
              <label>Depth (m)</label>
              <input
                type="number"
                min="0"
                max="300"
                className={isInvalid(i, 'depth') ? 'invalid' : ''}
                value={getDisplayValue(i, 'depth', stop.depth)}
                onChange={(e) => handleChange(i, 'depth', e.target.value)}
                onBlur={() => handleBlur(i, 'depth')}
              />
            </div>
            <div className="stop-field">
              <label>Time (min)</label>
              <input
                type="number"
                min="1"
                max="999"
                className={isInvalid(i, 'time') ? 'invalid' : ''}
                value={getDisplayValue(i, 'time', stop.time)}
                onChange={(e) => handleChange(i, 'time', e.target.value)}
                onBlur={() => handleBlur(i, 'time')}
              />
            </div>
            <div className="stop-actions">
              <button onClick={() => moveStop(i, -1)} disabled={i === 0} title="Move up">↑</button>
              <button onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} title="Move down">↓</button>
              <button onClick={() => removeStop(i)} className="remove-btn" title="Remove">×</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addStop} className="add-btn">+ Add Stop</button>
    </div>
  );
}
