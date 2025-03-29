#!/bin/bash

# Build React client
cd client
npm run build
cd ..

# Install Python dependencies
pip install -r requirements.txt

# Run Django migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput