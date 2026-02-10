import { useState, useRef } from 'react';

export default function DiveStops({ stops, onStopsChange }) {
  const [editing, setEditing] = useState({});
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragCounter = useRef({});

  const addStop = () => {
    onStopsChange([...stops, { depth: 10, time: 5 }]);
  };

  const removeStop = (index) => {
    onStopsChange(stops.filter((_, i) => i !== index));
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
      const updated = stops.map((s, i) => i !== index ? s : { ...s, [field]: num });
      onStopsChange(updated);
    }
  };

  const handleBlur = (index, field) => {
    const key = `${field}-${index}`;
    setEditing(prev => { const next = { ...prev }; delete next[key]; return next; });
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

  // Drag and drop
  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && index !== dragIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    dragCounter.current[index] = (dragCounter.current[index] || 0) + 1;
    if (dragIndex !== null && index !== dragIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e, index) => {
    dragCounter.current[index] = (dragCounter.current[index] || 0) - 1;
    if (dragCounter.current[index] <= 0) {
      dragCounter.current[index] = 0;
      if (dragOverIndex === index) setDragOverIndex(null);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    dragCounter.current = {};
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newStops = [...stops];
    const [moved] = newStops.splice(dragIndex, 1);
    newStops.splice(targetIndex, 0, moved);
    onStopsChange(newStops);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = {};
  };

  return (
    <div className="dive-stops">
      <h3>Dive Stops</h3>
      <div className="stops-list">
        {stops.map((stop, i) => (
          <div
            key={i}
            className={`stop-row${dragIndex === i ? ' dragging' : ''}${dragOverIndex === i ? ' drag-over' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragEnter={(e) => handleDragEnter(e, i)}
            onDragLeave={(e) => handleDragLeave(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
          >
            <span className="drag-handle" title="Drag to reorder">⠿</span>
            <span className="stop-number">{i + 1}</span>
            <div className="stop-field">
              <label>Depth (m)</label>
              <input
                type="number" min="0" max="300"
                className={isInvalid(i, 'depth') ? 'invalid' : ''}
                value={getDisplayValue(i, 'depth', stop.depth)}
                onChange={(e) => handleChange(i, 'depth', e.target.value)}
                onBlur={() => handleBlur(i, 'depth')}
              />
            </div>
            <div className="stop-field">
              <label>Time (min)</label>
              <input
                type="number" min="1" max="999"
                className={isInvalid(i, 'time') ? 'invalid' : ''}
                value={getDisplayValue(i, 'time', stop.time)}
                onChange={(e) => handleChange(i, 'time', e.target.value)}
                onBlur={() => handleBlur(i, 'time')}
              />
            </div>
            <div className="stop-actions">
              <button onClick={() => moveStop(i, -1)} disabled={i === 0} title="Move up" aria-label="Move up">↑</button>
              <button onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} title="Move down" aria-label="Move down">↓</button>
              <button onClick={() => removeStop(i)} className="remove-btn" title="Remove">×</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addStop} className="add-btn">+ Add Stop</button>
    </div>
  );
}
