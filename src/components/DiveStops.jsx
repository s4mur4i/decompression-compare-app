import { useState } from 'react';

export default function DiveStops({ stops, onStopsChange }) {
  const addStop = () => {
    onStopsChange([...stops, { depth: 10, time: 5 }]);
  };

  const removeStop = (index) => {
    onStopsChange(stops.filter((_, i) => i !== index));
  };

  const updateStop = (index, field, value) => {
    const updated = stops.map((s, i) => {
      if (i !== index) return s;
      return { ...s, [field]: Math.max(0, Number(value) || 0) };
    });
    onStopsChange(updated);
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
                value={stop.depth}
                onChange={(e) => updateStop(i, 'depth', e.target.value)}
              />
            </div>
            <div className="stop-field">
              <label>Time (min)</label>
              <input
                type="number"
                min="1"
                max="999"
                value={stop.time}
                onChange={(e) => updateStop(i, 'time', e.target.value)}
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
