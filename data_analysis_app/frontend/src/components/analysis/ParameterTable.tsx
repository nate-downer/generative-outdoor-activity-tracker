/**
 * Displays parameter posterior summaries and convergence diagnostics from
 * Bayesian model fits (PyMC traces).
 */
import { memo } from 'react';
import type { ParameterDiagnostics } from '../../types';

interface ParameterTableProps {
  data: ParameterDiagnostics;
}

function ParameterTable({ data }: ParameterTableProps) {
  if (!data || !data.parameters || data.parameters.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No parameter diagnostics available
      </div>
    );
  }

  const { parameters, convergence } = data;

  // Filter scalar parameters for the main table
  const scalarParams = parameters.filter(p => !p.is_array);

  return (
    <div className="space-y-6">
      {/* Convergence Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h6 className="text-sm font-semibold text-gray-800 mb-3">Convergence Diagnostics</h6>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Divergences: </span>
            <span className={`font-medium ${convergence.n_divergences > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {convergence.n_divergences}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Max R-hat: </span>
            <span className={`font-medium ${convergence.max_r_hat > 1.01 ? 'text-orange-600' : 'text-green-600'}`}>
              {convergence.max_r_hat.toFixed(4)}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Min ESS (bulk): </span>
            <span className={`font-medium ${convergence.min_ess_bulk < 400 ? 'text-orange-600' : 'text-green-600'}`}>
              {Math.round(convergence.min_ess_bulk)}
            </span>
          </div>
        </div>
      </div>

      {/* Parameter Summary Table */}
      {scalarParams.length > 0 && (
        <div>
          <h6 className="text-sm font-semibold text-gray-800 mb-3">Parameter Summaries</h6>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left p-2 font-medium text-gray-700">Parameter</th>
                  <th className="text-right p-2 font-medium text-gray-700">Mean</th>
                  <th className="text-right p-2 font-medium text-gray-700">SD</th>
                  <th className="text-right p-2 font-medium text-gray-700">HDI 5%</th>
                  <th className="text-right p-2 font-medium text-gray-700">HDI 95%</th>
                  <th className="text-right p-2 font-medium text-gray-700">ESS</th>
                  <th className="text-right p-2 font-medium text-gray-700">R-hat</th>
                </tr>
              </thead>
              <tbody>
                {scalarParams.map((param) => (
                  <tr key={param.parameter} className="border-b border-gray-100">
                    <td className="p-2 text-gray-800" title={param.description}>
                      {param.description}
                    </td>
                    <td className="text-right p-2 text-gray-700 font-mono text-xs">
                      {param.mean?.toFixed(3)}
                    </td>
                    <td className="text-right p-2 text-gray-600 font-mono text-xs">
                      {param.sd?.toFixed(3)}
                    </td>
                    <td className="text-right p-2 text-gray-600 font-mono text-xs">
                      {param.hdi_5?.toFixed(3)}
                    </td>
                    <td className="text-right p-2 text-gray-600 font-mono text-xs">
                      {param.hdi_95?.toFixed(3)}
                    </td>
                    <td className="text-right p-2 text-gray-600 font-mono text-xs">
                      {param.ess_bulk ? Math.round(param.ess_bulk) : '—'}
                    </td>
                    <td className={`text-right p-2 font-mono text-xs ${
                      param.r_hat && param.r_hat > 1.01 ? 'text-orange-600 font-medium' : 'text-gray-600'
                    }`}>
                      {param.r_hat?.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note */}
      <div className="text-xs text-gray-500">
        <p><strong>R-hat:</strong> Convergence diagnostic (should be &lt; 1.01)</p>
        <p><strong>ESS:</strong> Effective sample size (should be &gt; 400 for reliable inference)</p>
        <p><strong>HDI:</strong> 90% highest-density interval (Bayesian credible interval)</p>
      </div>
    </div>
  );
}

export default memo(ParameterTable);
