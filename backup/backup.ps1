$date = Get-Date -Format "yyyy-MM-dd"
$dumpFile = Join-Path $PSScriptRoot "supabase_dump_$date.sql"
$password = "sumisumarinella"
$postgresUri = "postgresql://postgres.cgkgkfcsorvelzhspgbe:$password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
& "pg_dump.exe" `
    "$postgresUri" `
    -f "$dumpFile"
