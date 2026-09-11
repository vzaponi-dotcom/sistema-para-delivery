ALTER TABLE print_stations ADD COLUMN recovery_job_id TEXT REFERENCES print_jobs(id) ON DELETE SET NULL;
