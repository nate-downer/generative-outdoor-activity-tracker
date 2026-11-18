/**
 * Build Model page - fits the hierarchical Bayesian time-prediction models and
 * shows diagnostic plots (variance explained, predicted vs. actual) per model.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '../components/layout/Header';
import VarianceExplainedChart from '../components/charts/analysis/VarianceExplainedChart';
import PredictedVsActualChart from '../components/charts/analysis/PredictedVsActualChart';
import ModelRunsTable from '../components/analysis/ModelRunsTable';
import ParameterTable from '../components/analysis/ParameterTable';
import { useModelFitting } from '../hooks/useModelFitting';
import { useActivities } from '../hooks/useActivities';
import { MODEL_GROUP_ORDER } from '../types';
import { useAuth } from '../context/AuthContext';
import { showViewerModeToast } from '../utils/viewerMode';
import { formatDate, formatDistance, formatActivityType } from '../utils/formatters';

// Matches the segment-type color convention used elsewhere in the app (e.g.
// ActivityEditor.tsx's getSegmentColors(), PredictionCumulativeChart.tsx).
const colorForGroup = (key: string): string => {
  if (key.includes('climb')) return '#ea580c'; // orange
  if (key.includes('descent')) return '#2563eb'; // blue
  if (key === 'rest') return '#16a34a'; // green
  return '#6b7280'; // flat - grey
};

function ModelDiagnosticsPage() {
  const { isAdmin } = useAuth();
  const {
    fitStatus,
    runs,
    selectedRunId,
    selectRun,
    diagnostics,
    diagnosticsLoading,
    diagnosticsError,
    startFit,
    showArchived,
    setShowArchived,
    archiveRun,
    unarchiveRun,
  } = useModelFitting();
  const { activities } = useActivities();
  const [starting, setStarting] = useState(false);

  // Model configuration state
  const [modelNickname, setModelNickname] = useState('');
  const [priorRunId, setPriorRunId] = useState<string>('');
  const [priorStrength, setPriorStrength] = useState('1.0');

  // Activity selection state (using Sets for efficient operations)
  const [trainingActivityIds, setTrainingActivityIds] = useState<Set<string>>(new Set());
  const [validationActivityIds, setValidationActivityIds] = useState<Set<string>>(new Set());

  // Collapsible section state
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [openDiagnostics, setOpenDiagnostics] = useState<Set<string>>(new Set());

  // Track whether we've initialized the training set
  const hasInitializedTraining = useRef(false);

  // Filter and sort trainable activities (exclude planned routes - no real GPS data)
  const trainableActivities = useMemo(
    () => activities.filter(a => !a.is_planned).sort((a, b) => b.date.localeCompare(a.date)),
    [activities]
  );

  // Initialize training set when activities load (only once)
  useEffect(() => {
    if (trainableActivities.length > 0 && !hasInitializedTraining.current) {
      setTrainingActivityIds(new Set(trainableActivities.map(a => a.activity_id)));
      hasInitializedTraining.current = true;
    }
  }, [trainableActivities]);

  // Generate default model nickname on mount
  useEffect(() => {
    if (!modelNickname) {
      setModelNickname(new Date().toISOString().slice(0, 19).replace('T', ' '));
    }
  }, [modelNickname]);

  // Event handlers for activity selection
  const handleTrainingToggle = (activityId: string) => {
    setTrainingActivityIds(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });

    // Remove from validation if being added to training
    setValidationActivityIds(prev => {
      const next = new Set(prev);
      next.delete(activityId);
      return next;
    });
  };

  const handleValidationToggle = (activityId: string) => {
    setValidationActivityIds(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });

    // Remove from training if being added to validation
    setTrainingActivityIds(prev => {
      const next = new Set(prev);
      next.delete(activityId);
      return next;
    });
  };

  const toggleDiagnostics = (key: string) => {
    setOpenDiagnostics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isRunning = fitStatus?.state === 'running' || starting;
  const progressPct = fitStatus && fitStatus.total_steps > 0
    ? Math.min(100, Math.round(((fitStatus.step_index + 1) / fitStatus.total_steps) * 100))
    : 0;

  const handleFitClick = async () => {
    if (!isAdmin) {
      showViewerModeToast('fit models');
      return;
    }

    // Validation
    if (trainingActivityIds.size === 0) {
      alert('Must select at least one activity for training');
      return;
    }

    if (priorRunId && (!priorStrength || Number(priorStrength) < 0)) {
      alert('Prior strength must be a non-negative number');
      return;
    }

    setStarting(true);
    try {
      await startFit({
        model_nickname: modelNickname || undefined,
        prior_run_id: priorRunId || undefined,
        prior_strength: priorRunId ? Number(priorStrength) : undefined,
        training_activity_ids: Array.from(trainingActivityIds),
        validation_activity_ids: Array.from(validationActivityIds),
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-50 rounded-lg shadow-md p-6">
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Time Prediction Models</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Hierarchical Bayesian models predicting segment duration from distance, elevation, load, terrain, and fatigue.
                </p>
              </div>
              <button
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleFitClick}
                disabled={isRunning || !isAdmin}
                title={!isAdmin ? "Log in to fit models" : ""}
              >
                {isRunning ? 'Fitting…' : 'Fit Models'}
              </button>
            </div>

            {/* Advanced Model Settings - Collapsible Section */}
            <div className="mt-4 border border-gray-200 rounded-lg">
              {/* Header - clickable to toggle */}
              <button
                onClick={() => setAdvancedSettingsOpen(!advancedSettingsOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg transition-colors"
                disabled={isRunning}
              >
                <span className="text-sm font-medium text-gray-700">Advanced Model Settings</span>
                <svg
                  className={`w-5 h-5 transition-transform ${advancedSettingsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Collapsible content */}
              {advancedSettingsOpen && (
                <div className="border-t border-gray-200 p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Column 1: Model Configuration */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Model Configuration</h4>

                      {/* Model Nickname */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Model Nickname
                        </label>
                        <input
                          type="text"
                          value={modelNickname}
                          onChange={(e) => setModelNickname(e.target.value)}
                          disabled={isRunning}
                          placeholder="2024-11-10 14:30:00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50"
                        />
                      </div>

                      {/* Use Priors From */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Use Priors From
                        </label>
                        <select
                          value={priorRunId}
                          onChange={(e) => setPriorRunId(e.target.value)}
                          disabled={isRunning}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50"
                        >
                          <option value="">None (train from scratch)</option>
                          {runs.map((run) => (
                            <option key={run.run_id} value={run.run_id}>
                              {run.model_nickname || new Date(run.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              {' '}({run.n_activities_total} activities)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Strength of Priors */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Strength of Priors
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={priorStrength}
                          onChange={(e) => setPriorStrength(e.target.value)}
                          disabled={isRunning || !priorRunId}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50"
                        />
                        <div className="mt-1 text-xs text-gray-500 space-y-1">
                          <p>Controls how much influence the prior model has on the new model:</p>
                          <ul className="list-disc list-inside pl-2 space-y-0.5">
                            <li><strong>0.0</strong> = Ignore priors (train from scratch)</li>
                            <li><strong>0.5</strong> = Weak influence (prior suggests direction)</li>
                            <li><strong>1.0</strong> = Balanced (default, prior as strong as one activity)</li>
                            <li><strong>2.0+</strong> = Strong influence (prior dominates)</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Training Sample */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Training Sample</h4>
                        <span className="text-sm text-gray-500">
                          {trainingActivityIds.size} selected
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Activities used to train the model
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setTrainingActivityIds(new Set(trainableActivities.map(a => a.activity_id)));
                              setValidationActivityIds(new Set()); // Clear validation when selecting all for training
                            }}
                            disabled={isRunning}
                            className="text-xs text-accent-600 hover:text-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Select All
                          </button>
                          <span className="text-xs text-gray-300">|</span>
                          <button
                            onClick={() => setTrainingActivityIds(new Set())}
                            disabled={isRunning}
                            className="text-xs text-accent-600 hover:text-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-md max-h-80 overflow-y-auto">
                        {trainableActivities.length === 0 ? (
                          <div className="p-4 text-sm text-gray-500 text-center">
                            No trainable activities available
                          </div>
                        ) : (
                          trainableActivities.map((activity) => (
                            <label
                              key={activity.activity_id}
                              className="flex items-start gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={trainingActivityIds.has(activity.activity_id)}
                                onChange={() => handleTrainingToggle(activity.activity_id)}
                                disabled={isRunning}
                                className="mt-1 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {activity.activity_name || activity.activity_id}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(activity.date)} • {formatActivityType(activity.activity_type)}
                                  {activity.total_distance_mi && ` • ${formatDistance(activity.total_distance_mi)}`}
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Column 3: Validation Sample */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Validation Sample</h4>
                        <span className="text-sm text-gray-500">
                          {validationActivityIds.size} selected
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Activities held out for validation
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setValidationActivityIds(new Set(trainableActivities.map(a => a.activity_id)));
                              setTrainingActivityIds(new Set()); // Clear training when selecting all for validation
                            }}
                            disabled={isRunning}
                            className="text-xs text-accent-600 hover:text-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Select All
                          </button>
                          <span className="text-xs text-gray-300">|</span>
                          <button
                            onClick={() => setValidationActivityIds(new Set())}
                            disabled={isRunning}
                            className="text-xs text-accent-600 hover:text-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-md max-h-80 overflow-y-auto">
                        {trainableActivities.length === 0 ? (
                          <div className="p-4 text-sm text-gray-500 text-center">
                            No trainable activities available
                          </div>
                        ) : (
                          trainableActivities.map((activity) => (
                            <label
                              key={activity.activity_id}
                              className="flex items-start gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={validationActivityIds.has(activity.activity_id)}
                                onChange={() => handleValidationToggle(activity.activity_id)}
                                disabled={isRunning}
                                className="mt-1 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {activity.activity_name || activity.activity_id}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(activity.date)} • {formatActivityType(activity.activity_type)}
                                  {activity.total_distance_mi && ` • ${formatDistance(activity.total_distance_mi)}`}
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isRunning && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>{fitStatus?.step_label || 'Starting…'}</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-orange-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {fitStatus?.state === 'error' && (
              <div className="mt-4 text-sm text-red-600">
                Fit failed: {fitStatus.error}
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Model Runs</h3>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                {showArchived ? 'Hide Archived' : 'Show Archived'} ({runs.filter(r => r.is_archived).length})
              </button>
            </div>
            <ModelRunsTable
              runs={runs}
              selectedRunId={selectedRunId}
              onSelectRun={selectRun}
              onArchive={archiveRun}
              onUnarchive={unarchiveRun}
            />
          </div>

          {diagnosticsLoading && !diagnostics && (
            <div className="flex justify-center items-center h-32">
              <div className="text-gray-600">Loading diagnostics...</div>
            </div>
          )}

          {diagnosticsError && (
            <div className="bg-white rounded-lg shadow-sm p-4 text-red-600 text-sm">
              {diagnosticsError}
            </div>
          )}

          {!diagnosticsLoading && !diagnostics && !diagnosticsError && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-500">No fitted models yet. Click "Fit Models" to get started.</p>
            </div>
          )}

          {diagnostics && (
            <div className="space-y-6">
              {MODEL_GROUP_ORDER.map((key) => {
                const group = diagnostics[key];
                if (!group) return null;
                return (
                  <div key={key}>
                    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <h3 className="text-lg font-semibold text-gray-800">{group.label}</h3>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                          <div>
                            <span className="text-gray-400">Segments: </span>
                            <span className="font-medium text-gray-700">{group.n_segments}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">R²: </span>
                            <span className="font-medium text-gray-700">
                              {typeof group.r_squared === 'number' ? group.r_squared.toFixed(3) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">RMSE: </span>
                            <span className="font-medium text-gray-700">
                              {typeof group.rmse_min === 'number' ? `${group.rmse_min.toFixed(1)} min` : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">RMSE %: </span>
                            <span className="font-medium text-gray-700">
                              {typeof group.rmse_pct_of_mean === 'number' ? `${group.rmse_pct_of_mean.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                          {group.n_validation_points && group.n_validation_points > 0 && (
                            <>
                              <div className="w-full" />
                              <div>
                                <span className="text-gray-400">Validation Points: </span>
                                <span className="font-medium text-gray-700">{group.n_validation_points}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Val RMSE: </span>
                                <span className="font-medium text-gray-700">
                                  {typeof group.validation_rmse_min === 'number' ? `${group.validation_rmse_min.toFixed(1)} min` : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Val RMSE %: </span>
                                <span className="font-medium text-gray-700">
                                  {typeof group.validation_rmse_pct_of_mean === 'number' ? `${group.validation_rmse_pct_of_mean.toFixed(1)}%` : '—'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h4 className="text-sm font-semibold mb-4 text-gray-700">Variance Explained by Variable</h4>
                        <VarianceExplainedChart data={group.variance_explained} />
                      </div>
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h4 className="text-sm font-semibold mb-4 text-gray-700">Predicted vs. Actual</h4>
                        <PredictedVsActualChart data={group.predicted_vs_actual} color={colorForGroup(key)} />
                      </div>
                    </div>

                    {/* Additional Diagnostics - Collapsible Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                      <button
                        onClick={() => toggleDiagnostics(key)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-700">Additional Diagnostics</span>
                        <svg
                          className={`w-5 h-5 transition-transform ${openDiagnostics.has(key) ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {openDiagnostics.has(key) && (
                        <div className="border-t border-gray-200 p-6">
                          <div className="space-y-6">
                            {/* Parameter Summary Table */}
                            <div>
                              <h5 className="text-sm font-semibold text-gray-800 mb-3">Model Parameters</h5>
                              {key === 'rest' ? (
                                // Rest model has its own parameters
                                diagnostics._rest_parameters ? (
                                  <ParameterTable data={diagnostics._rest_parameters} />
                                ) : (
                                  <p className="text-sm text-gray-500">
                                    Parameter diagnostics not available for this model run.
                                  </p>
                                )
                              ) : (
                                // All locomotion models share the same parameters
                                diagnostics._locomotion_parameters ? (
                                  <ParameterTable data={diagnostics._locomotion_parameters} />
                                ) : (
                                  <p className="text-sm text-gray-500">
                                    Parameter diagnostics not available for this model run.
                                  </p>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ModelDiagnosticsPage;
