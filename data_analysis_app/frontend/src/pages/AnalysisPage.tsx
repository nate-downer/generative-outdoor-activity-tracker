/**
 * Analysis Page - Shows aggregate visualizations across all activities and climb segments.
 * Sections are collapsible and load data lazily when expanded.
 */
import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import ActivityAnalysisSection from '../components/analysis/ActivityAnalysisSection';
import ClimbSegmentAnalysisSection from '../components/analysis/ClimbSegmentAnalysisSection';
import GeneralPaceAnalysisSection from '../components/analysis/GeneralPaceAnalysisSection';
import { activitiesAPI } from '../services/api';
import { userSegmentsAPI } from '../services/api';
import type { Activity, UserSegmentWithActivity } from '../types';

function AnalysisPage() {
  // State for which sections are expanded
  const [activitySectionOpen, setActivitySectionOpen] = useState(false);
  const [climbSectionOpen, setClimbSectionOpen] = useState(false);
  const [paceSectionOpen, setPaceSectionOpen] = useState(false);

  // State for activities data
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [activitiesFetched, setActivitiesFetched] = useState(false);

  // State for climb segments data
  const [climbSegments, setClimbSegments] = useState<UserSegmentWithActivity[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [segmentsFetched, setSegmentsFetched] = useState(false);

  // State for pace analysis segments data (all non-technical)
  const [paceSegments, setPaceSegments] = useState<UserSegmentWithActivity[]>([]);
  const [paceLoading, setPaceLoading] = useState(false);
  const [paceError, setPaceError] = useState<string | null>(null);
  const [paceFetched, setPaceFetched] = useState(false);

  // Fetch activities when section is first opened
  useEffect(() => {
    if (activitySectionOpen && !activitiesFetched) {
      const fetchActivities = async () => {
        try {
          setActivitiesLoading(true);
          setActivitiesError(null);
          const data = await activitiesAPI.list();
          // Filter to real recorded data only (exclude planned routes)
          const realActivities = data.filter((activity) => !activity.is_planned);
          setActivities(realActivities);
          setActivitiesFetched(true);
        } catch (err) {
          setActivitiesError(err instanceof Error ? err.message : 'Failed to load activities');
        } finally {
          setActivitiesLoading(false);
        }
      };
      fetchActivities();
    }
  }, [activitySectionOpen, activitiesFetched]);

  // Fetch climb segments when section is first opened
  useEffect(() => {
    if (climbSectionOpen && !segmentsFetched) {
      const fetchSegments = async () => {
        try {
          setSegmentsLoading(true);
          setSegmentsError(null);
          const data = await userSegmentsAPI.listAll('climb');
          setClimbSegments(data);
          setSegmentsFetched(true);
        } catch (err) {
          setSegmentsError(err instanceof Error ? err.message : 'Failed to load climb segments');
        } finally {
          setSegmentsLoading(false);
        }
      };
      fetchSegments();
    }
  }, [climbSectionOpen, segmentsFetched]);

  // Fetch all segments (for pace analysis) when section is first opened
  useEffect(() => {
    if (paceSectionOpen && !paceFetched) {
      const fetchPaceSegments = async () => {
        try {
          setPaceLoading(true);
          setPaceError(null);
          // Fetch all segments (not filtered by type) - filtering will happen in component
          const data = await userSegmentsAPI.listAll();
          setPaceSegments(data);
          setPaceFetched(true);
        } catch (err) {
          setPaceError(err instanceof Error ? err.message : 'Failed to load segment data');
        } finally {
          setPaceLoading(false);
        }
      };
      fetchPaceSegments();
    }
  }, [paceSectionOpen, paceFetched]);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Activity Analysis Section - 5 plots */}
        <div className="border border-gray-200 rounded-lg mb-6 bg-white shadow-sm">
          <button
            onClick={() => setActivitySectionOpen(!activitySectionOpen)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Activity Overview
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Distance, elevation, pace, and energy statistics across all activities
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${activitySectionOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {activitySectionOpen && (
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              {activitiesError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 font-medium">Error loading activities</p>
                  <p className="text-gray-600 text-sm mt-1">{activitiesError}</p>
                </div>
              ) : activitiesLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="text-gray-600">Loading activity data...</div>
                </div>
              ) : (
                <ActivityAnalysisSection activities={activities} />
              )}
            </div>
          )}
        </div>

        {/* General Pace Analysis Section - 2 scatter plots */}
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
          <button
            onClick={() => setPaceSectionOpen(!paceSectionOpen)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                General Pace Analysis
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Pace patterns across non-technical segments: how slope and distance affect speed
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${paceSectionOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {paceSectionOpen && (
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              {paceError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 font-medium">Error loading segment data</p>
                  <p className="text-gray-600 text-sm mt-1">{paceError}</p>
                </div>
              ) : paceLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="text-gray-600">Loading pace analysis data...</div>
                </div>
              ) : (
                <GeneralPaceAnalysisSection segments={paceSegments} />
              )}
            </div>
          )}
        </div>

        {/* Climb Segment Analysis Section - 10 plots */}
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm mt-6">
          <button
            onClick={() => setClimbSectionOpen(!climbSectionOpen)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Climb Segment Analysis
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Detailed metrics for climbing segments: difficulty, pace, energy expenditure
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${climbSectionOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {climbSectionOpen && (
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              {segmentsError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 font-medium">Error loading climb segments</p>
                  <p className="text-gray-600 text-sm mt-1">{segmentsError}</p>
                </div>
              ) : segmentsLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="text-gray-600">Loading climb segment data...</div>
                </div>
              ) : (
                <ClimbSegmentAnalysisSection segments={climbSegments} />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AnalysisPage;
