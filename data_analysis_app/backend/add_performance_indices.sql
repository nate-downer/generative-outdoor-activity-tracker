-- Performance Indices Migration
-- Run this to add performance indices to existing database
-- Usage: sqlite3 garmin_data.db < add_performance_indices.sql

-- Activity indices for frequently filtered/sorted columns
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_is_public ON activities(is_public);
CREATE INDEX IF NOT EXISTS idx_activities_is_planned ON activities(is_planned);
CREATE INDEX IF NOT EXISTS idx_activities_owner_id ON activities(owner_id);

-- Point indices for frequently filtered columns
CREATE INDEX IF NOT EXISTS idx_points_is_removed ON points(is_removed);
CREATE INDEX IF NOT EXISTS idx_points_is_inactive ON points(is_inactive);

-- Verify indices were created
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name;
