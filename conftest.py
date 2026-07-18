"""
Pytest configuration and fixtures.
Ensures Django is properly initialized before running tests.
"""

import os
import django
from django.conf import settings

def pytest_configure():
    """Initialize Django settings before tests run."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    if not settings.configured:
        django.setup()
