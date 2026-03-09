FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy uv lock files
COPY uv.lock pyproject.toml ./

# Install the project's dependencies
RUN uv sync --frozen --no-install-project

# Copy project source
COPY . .

# Install project
RUN uv sync --frozen

# Start the application
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
