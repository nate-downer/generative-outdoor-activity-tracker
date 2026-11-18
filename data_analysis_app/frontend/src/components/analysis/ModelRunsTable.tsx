/**
 * Table of historical model fit runs. Clicking a row selects that run, loading
 * its diagnostics into the panels below.
 */
import { memo } from 'react';
import type { ModelRunSummary } from '../../types';
import { MODEL_GROUP_ORDER } from '../../types';

interface ModelRunsTableProps {
  runs: ModelRunSummary[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onArchive: (runId: string) => Promise<void>;
  onUnarchive: (runId: string) => Promise<void>;
}

const GROUP_LABELS: Record<string, string> = {
  technical_climb: 'Tech. Climb',
  nontechnical_climb: 'Climb',
  flat: 'Flat',
  nontechnical_descent: 'Descent',
  technical_descent: 'Tech. Descent',
  rest: 'Rest',
};

const formatRunLabel = (run: ModelRunSummary) => {
  if (run.model_nickname) {
    return run.model_nickname;
  }
  return new Date(run.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const formatRmse = (value: number | undefined) =>
  typeof value === 'number' ? `${value.toFixed(1)}%` : '—';

function ModelRunsTable({ runs, selectedRunId, onSelectRun, onArchive, onUnarchive }: ModelRunsTableProps) {
  if (runs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500 text-sm">
        No fit runs yet. Click "Fit Models" to create the first one.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-2 py-3 font-medium">Run</th>
            <th className="px-2 py-3 font-medium text-right">Activities</th>
            {MODEL_GROUP_ORDER.map((group) => (
              <th key={group} className="px-2 py-3 font-medium text-right whitespace-nowrap">
                {GROUP_LABELS[group]} RMSE%
              </th>
            ))}
            <th className="px-2 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const isSelected = run.run_id === selectedRunId;
            const isArchived = run.is_archived || false;
            return (
              <tr
                key={run.run_id}
                onClick={() => onSelectRun(run.run_id)}
                className={`cursor-pointer border-b border-gray-100 last:border-0 transition-colors ${
                  isSelected ? 'bg-orange-50' : isArchived ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'
                }`}
              >
                <td className={`px-2 py-3 whitespace-nowrap ${isArchived ? 'text-gray-500' : 'text-gray-800'}`}>
                  {formatRunLabel(run)}
                  {isArchived && <span className="ml-2 text-xs text-gray-500 font-medium">(archived)</span>}
                  {isSelected && <span className="ml-2 text-xs text-orange-600 font-medium">(viewing)</span>}
                </td>
                <td className={`px-2 py-3 text-right ${isArchived ? 'text-gray-500' : 'text-gray-700'}`}>
                  {run.n_activities_total}
                </td>
                {MODEL_GROUP_ORDER.map((group) => (
                  <td key={group} className={`px-2 py-3 text-right ${isArchived ? 'text-gray-500' : 'text-gray-700'}`}>
                    {formatRmse(run.rmse_pct[group])}
                  </td>
                ))}
                <td className="px-2 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isArchived) {
                        onUnarchive(run.run_id);
                      } else {
                        onArchive(run.run_id);
                      }
                    }}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                  >
                    {isArchived ? 'Unarchive' : 'Archive'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(ModelRunsTable);
