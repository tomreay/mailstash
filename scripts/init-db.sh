#!/bin/bash
set -e

# This script runs as part of PostgreSQL initialization
# It sets up the Graphile Worker schema and extensions

echo "Setting up database extensions and Graphile Worker schema..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Update database collation version to suppress warnings
    ALTER DATABASE $POSTGRES_DB REFRESH COLLATION VERSION;
    
    -- Create necessary extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    -- Create schema for Graphile Worker
    CREATE SCHEMA IF NOT EXISTS graphile_worker;
    
    -- Grant permissions
    GRANT ALL ON SCHEMA graphile_worker TO $POSTGRES_USER;
    GRANT ALL ON SCHEMA public TO $POSTGRES_USER;
    
    -- Graphile Worker will create its own tables when it first runs
    -- We just need to ensure the schema exists and has proper permissions
    
    COMMENT ON SCHEMA graphile_worker IS 'Schema for Graphile Worker background job processing';
EOSQL

echo "Database initialization complete."