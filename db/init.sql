-- Runs once when the local/CI database is created. In production, ops creates this role with a real password.
CREATE ROLE app_user LOGIN PASSWORD 'app_user' NOSUPERUSER NOBYPASSRLS;
