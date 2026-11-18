/**
 * General Pace Analysis Section - Shows pace and distance patterns for non-technical segments.
 * Follows plot_style_guide.md conventions.
 */
import { memo, useMemo } from 'react';
import { ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UserSegmentWithActivity } from '../../types';
import { fitLorentzCurve } from '../../utils/curveFitting';

interface GeneralPaceAnalysisSectionProps {
  segments: UserSegmentWithActivity[];
}

// Color scheme for segment types (matches app-wide segment colors)
const SEGMENT_TYPE_COLORS = {
  nontechnical_climb: '#ea580c', // Orange-600 (matches climb segments throughout app)
  flat: '#6b7280', // Gray-500 (matches flat segments throughout app)
  nontechnical_descent: '#2563eb', // Blue-600 (matches descent segments throughout app)
};

// Custom tooltip component following style guide
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
        <p style={{ fontSize: '10px', margin: '0 0 4px 0', color: '#9ca3af' }}>
          {data.date}
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

function GeneralPaceAnalysisSection({ segments }: GeneralPaceAnalysisSectionProps) {
  // Filter to non-technical segments only
  const nonTechnicalSegments = useMemo(() => {
    return segments.filter(s =>
      !s.is_technical &&
      s.segment_type !== 'rest' &&
      s.distance_mi &&
      s.distance_mi > 0 &&
      s.duration_sec &&
      s.duration_sec > 0
    );
  }, [segments]);

  // Prepare data for pace vs slope scatter plot
  const paceVsSlopeData = useMemo(() => {
    try {
      const data = nonTechnicalSegments.map(s => {
      // Calculate actual elevation change (positive for climbs, negative for descents)
      let elevationChange = 0;
      if (s.segment_type === 'climb') {
        elevationChange = s.elevation_gain_ft || 0;
      } else if (s.segment_type === 'descent') {
        // For descents, elevation change is negative (use elevation_loss_ft as a negative value)
        elevationChange = -(s.elevation_loss_ft || 0);
      } else {
        // Flat segments: use net elevation change (gain - loss)
        elevationChange = (s.elevation_gain_ft || 0) - (s.elevation_loss_ft || 0);
      }

      const grade = (elevationChange / (s.distance_mi || 1)) / 5280; // Grade (rise/run)
      const slopeDegrees = Math.atan(grade) * (180 / Math.PI); // Convert to degrees
      const paceMinPerMile = (s.duration_sec || 0) / 60 / (s.distance_mi || 1);
      const speedMetersPerSec = paceMinPerMile > 0 ? 26.8224 / paceMinPerMile : 0; // Convert pace to m/s

      // Determine segment type and color
      let segmentType: string;
      let color: string;
      if (s.segment_type === 'climb') {
        segmentType = 'climb';
        color = SEGMENT_TYPE_COLORS.nontechnical_climb;
      } else if (s.segment_type === 'descent') {
        segmentType = 'descent';
        color = SEGMENT_TYPE_COLORS.nontechnical_descent;
      } else {
        segmentType = 'flat';
        color = SEGMENT_TYPE_COLORS.flat;
      }

      return {
        x: slopeDegrees,
        y: speedMetersPerSec,
        name: s.activity_name || 'Unnamed',
        date: new Date(s.activity_date).toLocaleDateString(),
        segmentType,
        fill: color,
      };
    });
    return data;
  } catch (error) {
    console.error('Error preparing pace vs slope data:', error);
    return [];
  }
  }, [nonTechnicalSegments]);

  // Fit Lorentz curve to speed vs slope data
  const lorentzFit = useMemo(() => {
    if (paceVsSlopeData.length < 10) return null;
    return fitLorentzCurve(paceVsSlopeData, {
      x0Range: [-15, 10],
      gammaRange: [3, 40],
    });
  }, [paceVsSlopeData]);


  // Prepare data for distance vs time scatter plot
  const distanceVsTimeData = useMemo(() => {
    try {
      return nonTechnicalSegments.map(s => {
      const timeMinutes = (s.duration_sec || 0) / 60;
      const distanceMiles = s.distance_mi || 0;

      // Determine segment type and color
      let segmentType: string;
      let color: string;
      if (s.segment_type === 'climb') {
        segmentType = 'climb';
        color = SEGMENT_TYPE_COLORS.nontechnical_climb;
      } else if (s.segment_type === 'descent') {
        segmentType = 'descent';
        color = SEGMENT_TYPE_COLORS.nontechnical_descent;
      } else {
        segmentType = 'flat';
        color = SEGMENT_TYPE_COLORS.flat;
      }

      return {
        x: timeMinutes,
        y: distanceMiles,
        name: s.activity_name || 'Unnamed',
        date: new Date(s.activity_date).toLocaleDateString(),
        segmentType,
        fill: color,
      };
    });
  } catch (error) {
    console.error('Error preparing distance vs time data:', error);
    return [];
  }
  }, [nonTechnicalSegments]);


  // Formatters
  const formatSlope = (value: number) => `${value.toFixed(1)}°`;
  const formatSpeed = (value: number) => `${value.toFixed(2)} m/s`;
  const formatTime = (value: number) => `${value.toFixed(1)} min`;
  const formatDistance = (value: number) => `${value.toFixed(2)} mi`;

  if (nonTechnicalSegments.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
        <p className="text-sm text-gray-500">
          No non-technical segments found. Create segments on your activities to see pace analysis.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Speed vs Slope */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Speed vs Slope</h3>
          <p className="text-sm text-gray-600 mb-2">
            <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ backgroundColor: SEGMENT_TYPE_COLORS.nontechnical_climb }}></span>
            <span className="text-xs">Climbs</span>
            <span className="inline-block w-3 h-3 rounded-full ml-3 mr-1" style={{ backgroundColor: SEGMENT_TYPE_COLORS.flat }}></span>
            <span className="text-xs">Flat</span>
            <span className="inline-block w-3 h-3 rounded-full ml-3 mr-1" style={{ backgroundColor: SEGMENT_TYPE_COLORS.nontechnical_descent }}></span>
            <span className="text-xs">Descents</span>
          </p>

          <div className="relative">
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  label={{ value: 'Slope (degrees)', position: 'insideBottom', offset: -10, style: { fontSize: 12 } }}
                  tickFormatter={formatSlope}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  label={{ value: 'Speed (m/s)', angle: -90, position: 'insideLeft', offset: -15, style: { fontSize: 12, textAnchor: 'middle' } }}
                  tickFormatter={formatSpeed}
                />
                <Tooltip
                  content={<CustomTooltip xLabel="Slope" yLabel="Speed" formatX={formatSlope} formatY={formatSpeed} />}
                  cursor={{ strokeDasharray: '3 3' }}
                />
                {lorentzFit && (
                  <Line
                    data={lorentzFit.curvePoints}
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
                  data={paceVsSlopeData}
                  fillOpacity={0.6}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Display Lorentz fit parameters */}
          {lorentzFit && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">Lorentz Curve Fit:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                <div>
                  <span className="font-medium">Peak Speed (A):</span> {lorentzFit.parameters.A.toFixed(2)} m/s
                </div>
                <div>
                  <span className="font-medium">R²:</span> {lorentzFit.rSquared.toFixed(3)}
                </div>
                <div>
                  <span className="font-medium">Optimal Slope (x₀):</span> {lorentzFit.parameters.x0.toFixed(1)}°
                </div>
                <div>
                  <span className="font-medium">Width (γ):</span> {lorentzFit.parameters.gamma.toFixed(1)}°
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Distance vs Time */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Distance vs Time</h3>
          <p className="text-sm text-gray-600 mb-2">
            <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ backgroundColor: SEGMENT_TYPE_COLORS.nontechnical_climb }}></span>
            <span className="text-xs">Climbs</span>
            <span className="inline-block w-3 h-3 rounded-full ml-3 mr-1" style={{ backgroundColor: SEGMENT_TYPE_COLORS.flat }}></span>
            <span className="text-xs">Flat</span>
            <span className="inline-block w-3 h-3 rounded-full ml-3 mr-1" style={{ backgroundColor: SEGMENT_TYPE_COLORS.nontechnical_descent }}></span>
            <span className="text-xs">Descents</span>
          </p>

          <div className="relative">
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="x"
                  type="number"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  label={{ value: 'Time (minutes)', position: 'insideBottom', offset: -10, style: { fontSize: 12 } }}
                  tickFormatter={formatTime}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  label={{ value: 'Distance (miles)', angle: -90, position: 'insideLeft', offset: -15, style: { fontSize: 12, textAnchor: 'middle' } }}
                  tickFormatter={formatDistance}
                />
                <Tooltip
                  content={<CustomTooltip xLabel="Time" yLabel="Distance" formatX={formatTime} formatY={formatDistance} />}
                  cursor={{ strokeDasharray: '3 3' }}
                />
                <Scatter
                  data={distanceVsTimeData}
                  fillOpacity={0.6}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(GeneralPaceAnalysisSection);
