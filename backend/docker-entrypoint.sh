#!/bin/sh
set -e

echo "Docentra backend: applying database migrations..."
npx prisma migrate deploy

echo "Docentra backend: starting..."
exec "$@"
