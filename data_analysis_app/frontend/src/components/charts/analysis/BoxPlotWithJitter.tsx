/**
 * Jitter plot with mean lines for showing distribution across categories
 * Now using Recharts for proper responsive scaling (matches other plots)
 */
import { useMemo } from 'react';
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  category: string;
  value: number;
  [key: string]: any;
}

interface BoxPlotWithJitterProps {
  data: DataPoint[];
  categoryKey: string;
  valueKey: string;
  xLabel: string;
  yLabel: string;
  valueFormatter?: (value: number) => string;
}

interface CategoryStats {
  category: string;
  mean: number;
  values: number[];
}

function calculateCategoryStats(values: number[]): Omit<CategoryStats, 'category'> {
  if (values.length === 0) {
    return { mean: 0, values: [] };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return { mean, values };
}

function BoxPlotWithJitter({
  data,
  categoryKey,
  valueKey,
  xLabel,
  yLabel,
  valueFormatter = (v) => v.toFixed(1),
}: BoxPlotWithJitterProps) {
  // Group data by category and calculate statistics
  const categoryStats = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const category = item[categoryKey];
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item[valueKey]);
      return acc;
    }, {} as Record<string, number[]>);

    // Maintain the order of first appearance in data (assumes data is pre-sorted)
    const categoryOrder = Array.from(new Set(data.map(item => item[categoryKey])));

    return categoryOrder.map((category) => ({
      category,
      ...calculateCategoryStats(grouped[category] || []),
    }));
  }, [data, categoryKey, valueKey]);

  // Prepare jitter data for Recharts scatter
  const jitterData = useMemo(() => {
    return categoryStats.flatMap((stats, categoryIndex) =>
      stats.values.map((value) => ({
        x: categoryIndex + (Math.random() - 0.5) * 0.6, // Add jitter to x
        y: value,
        category: stats.category,
      }))
    );
  }, [categoryStats]);

  // Prepare mean lines data - each line is two points
  const meanLinesData = useMemo(() => {
    return categoryStats.flatMap((stats, index) => [
      { x: index - 0.4, y: stats.mean, category: stats.category, lineId: index },
      { x: index + 0.4, y: stats.mean, category: stats.category, lineId: index },
    ]);
  }, [categoryStats]);

  if (categoryStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-gray-500">
        No data available for this plot
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart margin={{ top: 10, right: 20, bottom: 45, left: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

        <XAxis
          type="number"
          dataKey="x"
          domain={[-0.5, categoryStats.length - 0.5]}
          ticks={categoryStats.map((_, i) => i)}
          tickFormatter={(index) => categoryStats[Math.round(index)]?.category || ''}
          tick={(props: any) => {
            const { x, y, payload } = props;
            return (
              <g transform={`translate(${x},${y})`}>
                <text
                  x={0}
                  y={0}
                  dy={16}
                  textAnchor="end"
                  fill="#9ca3af"
                  fontSize={12}
                  transform="rotate(-45)"
                >
                  {categoryStats[Math.round(payload.value)]?.category || ''}
                </text>
              </g>
            );
          }}
          height={60}
          stroke="#9ca3af"
        />

        <YAxis
          dataKey="y"
          type="number"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          label={{
            value: yLabel,
            angle: -90,
            position: 'insideLeft',
            offset: -10,
            style: { fontSize: 12, textAnchor: 'middle' },
          }}
          tickFormatter={valueFormatter}
        />

        <Tooltip
          formatter={(value: any) => valueFormatter(value)}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              return payload[0].payload.category;
            }
            return '';
          }}
        />

        {/* Mean lines - render each as a separate Line */}
        {categoryStats.map((stats, index) => (
          <Line
            key={`mean-${stats.category}`}
            data={[
              { x: index - 0.4, y: stats.mean },
              { x: index + 0.4, y: stats.mean },
            ]}
            dataKey="y"
            stroke="#6b7280"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}

        {/* Jitter points */}
        <Scatter
          name="Climbs"
          data={jitterData}
          fill="#ea580c"
          fillOpacity={0.6}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default BoxPlotWithJitter;
