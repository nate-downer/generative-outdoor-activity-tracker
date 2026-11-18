# Plot Style Guide

## Overview
This guide defines the visual style and implementation patterns for all data visualizations in the Generative Outdoor Activity Tracker. Consistency in styling creates a cohesive user experience and makes patterns easier to recognize across different chart types.

---

## Core Principles

1. **Minimalism** - Remove unnecessary elements; let data speak
2. **Consistency** - Same styling across all charts
3. **Accessibility** - Clear labels, readable fonts, sufficient contrast
4. **Context** - R² values and trendlines help interpret relationships
5. **Performance** - Memoize expensive calculations, disable unnecessary animations

---

## Standard Colors

### Primary Data Colors
- **Orange/Red** (`#ea580c`): Primary data, technical segments, highlights
- **Gray** (`#6b7280`): Secondary data, non-technical segments
- **Light Gray** (`#9ca3af`): Trendlines, axes, secondary elements

### Category-Specific Colors (Segment Types)
For segment type plots (must match app-wide segment colors from ActivityEditor):
- **Climb** (technical or non-technical): `#ea580c` (Orange-600)
- **Descent**: `#2563eb` (Blue-600)
- **Flat**: `#6b7280` (Gray-500)
- **Rest**: `#16a34a` (Green-600)

### UI Colors
- **Grid**: `#e5e7eb` (Very light gray)
- **Axes/Text**: `#9ca3af` (Medium gray)
- **Tooltip Background**: `rgba(255, 255, 255, 0.95)` (White, 95% opacity)
- **Tooltip Border**: `#e5e7eb`
- **Tooltip Text**: `#374151` (Dark gray - headings), `#6b7280` (Medium gray - values)

---

## Chart Dimensions

### Scatter Plots
- **Height**: `250px`
- **Margins**: `{ top: 20, right: 20, bottom: 20, left: 30 }`

### Bar Charts
- **Height**: `300px` (for horizontal bars with many items)
- **Margins**: Adjust as needed for labels

### Line Charts
- **Height**: `300px` (for time series with many lines)
- **Margins**: `{ top: 20, right: 20, bottom: 20, left: 30 }`

---

## Scatter Plot Pattern

### Component Structure
```tsx
import { memo, useMemo } from 'react';
import { ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fitExponentialSaturation } from '../../../utils/curveFitting';
```

### Standard Implementation
1. **Use `ComposedChart`** to layer Scatter + Line (trendline)
2. **Memoize data transformations** with `useMemo`
3. **Fit trendlines** using curve fitting utilities:
   - `fitExponentialSaturation` for diminishing returns (most common)
   - `fitExponentialDecay` for decay patterns
4. **Show R² values** in top-right corner
5. **Use `memo()` wrapper** on export for performance

### Scatter Point Styling
```tsx
<Scatter
  data={chartData}
  fill="#ea580c"           // Orange for primary data
  fillOpacity={0.6}        // 60% opacity
/>
```

For multi-category:
```tsx
<Scatter
  data={chartData}
  fillOpacity={0.6}        // Set opacity globally
  // fill determined by data point's 'fill' property
/>
```

### Trendline Styling
```tsx
<Line
  data={trendline.curvePoints}
  type="monotone"
  dataKey="y"
  stroke="#9ca3af"         // Gray
  strokeWidth={2}
  dot={false}              // No dots on trendline
  strokeDasharray="5 5"    // Dashed line
  isAnimationActive={false} // Disable animation for performance
/>
```

---

## Axes Styling

### X-Axis
```tsx
<XAxis
  dataKey="x"
  type="number"
  name={xLabel}
  tick={{ fontSize: 12 }}
  stroke="#9ca3af"
  label={{ 
    value: xLabel, 
    position: 'insideBottom', 
    offset: -10, 
    style: { fontSize: 12 } 
  }}
  tickFormatter={formatX}  // Custom formatter function
/>
```

### Y-Axis
```tsx
<YAxis
  dataKey="y"
  type="number"
  name={yLabel}
  tick={{ fontSize: 12 }}
  stroke="#9ca3af"
  label={{ 
    value: yLabel, 
    angle: -90, 
    position: 'insideLeft', 
    offset: -15, 
    style: { fontSize: 12, textAnchor: 'middle' } 
  }}
  tickFormatter={formatY}  // Custom formatter function
/>
```

---

## Grid Styling

```tsx
<CartesianGrid 
  strokeDasharray="3 3"    // Small dashes
  stroke="#e5e7eb"         // Very light gray
/>
```

---

## Tooltip Styling

### Standard Tooltip Component
```tsx
const CustomTooltip = ({ active, payload, xLabel, yLabel, formatX, formatY }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
        padding: '8px 12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        fontSize: '11px',
      }}>
        <p style={{ fontWeight: 'bold', color: '#374151', margin: '0 0 4px 0' }}>
          {data.name}
        </p>
        {data.date && (
          <p style={{ fontSize: '10px', margin: '0 0 4px 0', color: '#9ca3af' }}>
            {data.date}
          </p>
        )}
        <p style={{ margin: '2px 0', color: '#6b7280' }}>
          {xLabel}: {formatX(data.x)}
        </p>
        <p style={{ margin: '2px 0', color: '#6b7280' }}>
          {yLabel}: {formatY(data.y)}
        </p>
      </div>
    );
  }
  return null;
};
```

### Tooltip Usage
```tsx
<Tooltip
  content={<CustomTooltip xLabel={xLabel} yLabel={yLabel} formatX={formatX} formatY={formatY} />}
  cursor={{ strokeDasharray: '3 3' }}  // Dashed cursor lines
/>
```

---

## R² Display

### Single Trendline
```tsx
<div className="absolute top-0 right-0 text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
  R² = {trendline.rSquared.toFixed(3)}
</div>
```

### Multiple Trendlines
```tsx
<div className="absolute top-0 right-0 text-xs bg-white px-2 py-1 rounded border border-gray-200 z-10 space-y-1">
  <div className="flex items-center gap-2">
    <span className="text-orange-600">Category A:</span>
    <span className="text-gray-500">R² = {trendlineA.rSquared.toFixed(3)}</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-gray-600">Category B:</span>
    <span className="text-gray-500">R² = {trendlineB.rSquared.toFixed(3)}</span>
  </div>
</div>
```

---

## Empty State

```tsx
if (chartData.length === 0) {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
      <p className="text-sm text-gray-500">No data available</p>
    </div>
  );
}
```

---

## Formatters

### Common Patterns
```tsx
const formatDistance = (mi: number) => `${mi.toFixed(1)} mi`;
const formatElevation = (ft: number) => `${ft.toFixed(0)} ft`;
const formatDuration = (sec: number) => {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};
const formatPace = (minPerMile: number) => `${minPerMile.toFixed(1)} min/mi`;
const formatGrade = (grade: number) => `${(grade * 100).toFixed(1)}%`;
```

Use existing formatters from `utils/formatters.ts` when available.

---

## Performance Best Practices

1. **Memoize data transformations**
   ```tsx
   const chartData = useMemo(() => {
     return data.map(/* ... */);
   }, [data, dependencies]);
   ```

2. **Memoize trendline calculations**
   ```tsx
   const trendline = useMemo(() => {
     return fitExponentialSaturation(chartData);
   }, [chartData]);
   ```

3. **Wrap component in `memo()`**
   ```tsx
   export default memo(ComponentName);
   ```

4. **Disable unnecessary animations**
   ```tsx
   isAnimationActive={false}
   ```

---

## Legend Handling

**General Rule: NO LEGEND COMPONENT**

Instead of Recharts' Legend component:
- Use **color-coded labels in titles/subtitles**
- Use **R² badges** that show category names
- Use **tooltips** to identify categories
- Use **visual context** (chart placement, descriptions)

Legends add clutter and are often redundant when categories are explained in the chart title or surrounding text.

---

## Anti-Patterns (Avoid)

❌ **Don't**: Use bright, saturated colors
✅ **Do**: Use muted, professional colors (#ea580c, #6b7280)

❌ **Don't**: Add legends when categories are obvious
✅ **Do**: Use color-coded text in descriptions

❌ **Don't**: Use large font sizes (>14px for labels)
✅ **Do**: Keep labels at 11-12px

❌ **Don't**: Show all ticks on crowded axes
✅ **Do**: Use `tickFormatter` to simplify labels

❌ **Don't**: Mix chart heights arbitrarily
✅ **Do**: Use standard heights (250px for scatter, 300px for bar/line)

❌ **Don't**: Use default Recharts colors
✅ **Do**: Explicitly set colors to match the guide

---

## Example: Complete Scatter Plot

```tsx
import { memo, useMemo } from 'react';
import { ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fitExponentialSaturation } from '../../../utils/curveFitting';

const CustomTooltip = ({ active, payload, xLabel, yLabel, formatX, formatY }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
        padding: '8px 12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        fontSize: '11px',
      }}>
        <p style={{ fontWeight: 'bold', color: '#374151', margin: '0 0 4px 0' }}>
          {data.name}
        </p>
        <p style={{ margin: '2px 0', color: '#6b7280' }}>
          {xLabel}: {formatX(data.x)}
        </p>
        <p style={{ margin: '2px 0', color: '#6b7280' }}>
          {yLabel}: {formatY(data.y)}
        </p>
      </div>
    );
  }
  return null;
};

function MyScatterPlot({ data, xKey, yKey, xLabel, yLabel }: Props) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      x: item[xKey],
      y: item[yKey],
      name: item.name,
    }));
  }, [data, xKey, yKey]);

  const trendline = useMemo(() => {
    return fitExponentialSaturation(chartData);
  }, [chartData]);

  const formatX = (value: number) => `${value.toFixed(1)}`;
  const formatY = (value: number) => `${value.toFixed(1)}`;

  return (
    <div className="relative">
      {trendline && (
        <div className="absolute top-0 right-0 text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
          R² = {trendline.rSquared.toFixed(3)}
        </div>
      )}
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="x"
            type="number"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            label={{ value: xLabel, position: 'insideBottom', offset: -10, style: { fontSize: 12 } }}
            tickFormatter={formatX}
          />
          <YAxis
            dataKey="y"
            type="number"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: -15, style: { fontSize: 12, textAnchor: 'middle' } }}
            tickFormatter={formatY}
          />
          <Tooltip
            content={<CustomTooltip xLabel={xLabel} yLabel={yLabel} formatX={formatX} formatY={formatY} />}
            cursor={{ strokeDasharray: '3 3' }}
          />
          {trendline && (
            <Line
              data={trendline.curvePoints}
              type="monotone"
              dataKey="y"
              stroke="#9ca3af"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
              isAnimationActive={false}
            />
          )}
          <Scatter
            data={chartData}
            fill="#ea580c"
            fillOpacity={0.6}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(MyScatterPlot);
```

---

## Checklist for New Charts

- [ ] Height matches standard (250px scatter, 300px bar/line)
- [ ] Colors from style guide (#ea580c, #6b7280, #9ca3af, #e5e7eb)
- [ ] Fill opacity 0.6 for scatter points
- [ ] Font size 12px for all axis labels and ticks
- [ ] Standard margins applied
- [ ] Trendline(s) fitted using curve fitting utilities
- [ ] R² value(s) displayed in top-right
- [ ] Custom tooltip with standard styling
- [ ] Data transformation memoized with useMemo
- [ ] Component wrapped in memo() export
- [ ] Animations disabled (isAnimationActive={false})
- [ ] Empty state handled gracefully
- [ ] Formatter functions for axis labels
- [ ] No Legend component (unless absolutely necessary)
- [ ] Grid uses light gray dashed lines
- [ ] Tooltip cursor uses dashed lines
