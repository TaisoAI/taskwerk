# Taskwerk Quickstarts Feature Design

## Overview

Quickstarts provide pre-defined task templates for common project types, allowing developers to quickly scaffold a complete project plan with all necessary tasks, dependencies, and best practices.

## Goals

1. **Reduce Setup Time**: Eliminate the need to manually create repetitive tasks for common project types
2. **Enforce Best Practices**: Include industry-standard tasks for security, testing, documentation
3. **Customizable**: Allow users to modify templates or create their own
4. **AI-Friendly**: Generate tasks that are clear and actionable for AI agents

## Command Interface

### Basic Usage
```bash
# List available quickstarts
twrk quickstart --list

# Create tasks from a quickstart
twrk quickstart python-fastapi

# With options
twrk quickstart python-fastapi --prefix API --assignee @ai-agent

# Interactive mode
twrk quickstart python-fastapi --interactive
```

### Command Options
- `--list`: Show all available quickstart templates
- `--prefix <prefix>`: Custom prefix for task IDs (default: template-specific)
- `--assignee <assignee>`: Assign all tasks to specific user/agent
- `--category <category>`: Override default category for all tasks
- `--priority <priority>`: Set priority for all tasks
- `--interactive`: Prompt for customization options
- `--dry-run`: Preview tasks without creating them
- `--template-dir <dir>`: Use custom template directory

## Built-in Templates

### 1. Python FastAPI (`python-fastapi`)
```yaml
name: python-fastapi
prefix: FAST
category: backend
tasks:
  - name: Set up Python virtual environment
    description: |
      Create and activate a Python virtual environment
      - Use Python 3.9+
      - Create requirements.txt
    tags: [setup, python]
    
  - name: Install FastAPI and dependencies
    description: |
      Install core dependencies:
      - fastapi
      - uvicorn[standard]
      - pydantic
      - python-dotenv
    tags: [dependencies]
    dependencies: [1]
    
  - name: Create project structure
    description: |
      Set up standard project layout:
      /app
        /api
          /endpoints
          /models
          /schemas
        /core
        /db
        /tests
      main.py
    tags: [structure]
    
  - name: Implement configuration management
    description: |
      Create configuration system:
      - Environment variables
      - Settings class with Pydantic
      - .env.example file
    tags: [config]
    dependencies: [3]
    
  - name: Set up database models
    description: |
      Create SQLAlchemy models:
      - Base model class
      - User model
      - Timestamps mixin
    tags: [database, models]
    
  - name: Create CRUD operations
    description: |
      Implement generic CRUD base class
      - Create, Read, Update, Delete operations
      - Type hints and async support
    tags: [database, crud]
    dependencies: [5]
    
  - name: Implement authentication
    description: |
      Add JWT authentication:
      - Login/logout endpoints
      - Password hashing
      - Protected route decorator
      - Token refresh mechanism
    tags: [auth, security]
    
  - name: Create API endpoints
    description: |
      Build RESTful endpoints:
      - User registration/login
      - CRUD endpoints for main entities
      - OpenAPI documentation
    tags: [api, endpoints]
    dependencies: [6, 7]
    
  - name: Add database migrations
    description: |
      Set up Alembic:
      - Initialize migrations
      - Create initial migration
      - Add migration commands
    tags: [database, migrations]
    dependencies: [5]
    
  - name: Implement error handling
    description: |
      Global error handling:
      - Custom exception classes
      - Exception handlers
      - Proper HTTP status codes
    tags: [errors, api]
    
  - name: Add request validation
    description: |
      Pydantic schemas for:
      - Request validation
      - Response serialization
      - Type safety
    tags: [validation, api]
    
  - name: Create unit tests
    description: |
      Test setup with pytest:
      - Test client configuration
      - Authentication tests
      - CRUD operation tests
      - 80% coverage minimum
    tags: [testing]
    
  - name: Add integration tests
    description: |
      End-to-end API tests:
      - Full workflow tests
      - Database transaction tests
      - External service mocking
    tags: [testing]
    dependencies: [12]
    
  - name: Configure logging
    description: |
      Structured logging:
      - JSON log format
      - Log levels per environment
      - Request ID tracking
    tags: [logging, monitoring]
    
  - name: Add API documentation
    description: |
      Enhanced OpenAPI docs:
      - Detailed descriptions
      - Request/response examples
      - Authentication documentation
    tags: [documentation]
    
  - name: Create Docker configuration
    description: |
      Containerization:
      - Multi-stage Dockerfile
      - docker-compose.yml
      - Environment-specific configs
    tags: [docker, deployment]
    
  - name: Add CI/CD pipeline
    description: |
      GitHub Actions workflow:
      - Run tests on PR
      - Build and push Docker image
      - Deploy to staging/production
    tags: [ci-cd, deployment]
    
  - name: Implement rate limiting
    description: |
      API rate limiting:
      - Redis-based limiter
      - Per-endpoint limits
      - Rate limit headers
    tags: [security, api]
    
  - name: Add monitoring
    description: |
      Application monitoring:
      - Health check endpoint
      - Prometheus metrics
      - Performance tracking
    tags: [monitoring, observability]
    
  - name: Security hardening
    description: |
      Security measures:
      - CORS configuration
      - Security headers
      - Input sanitization
      - SQL injection prevention
    tags: [security]
```

### 2. Node.js Express (`node-express`)
```yaml
name: node-express
prefix: NODE
category: backend
tasks:
  - name: Initialize Node.js project
    description: |
      Set up package.json:
      - npm init
      - Configure scripts
      - Set Node version
    tags: [setup, node]
    
  - name: Install Express and core dependencies
    description: |
      Install packages:
      - express
      - cors
      - helmet
      - dotenv
      - morgan
    tags: [dependencies]
    
  # ... similar structure
```

### 3. React Application (`react-app`)
```yaml
name: react-app
prefix: REACT
category: frontend
tasks:
  - name: Create React application
    description: |
      Initialize with Vite:
      - Modern build tooling
      - TypeScript configuration
      - ESLint + Prettier
    tags: [setup, react]
    
  # ... similar structure
```

### 4. Microservice (`microservice`)
```yaml
name: microservice
prefix: MICRO
category: backend
tasks:
  - name: Design service boundaries
    description: |
      Define microservice scope:
      - Service responsibilities
      - API contracts
      - Data ownership
    tags: [design, architecture]
    
  # ... similar structure
```

## Template Format

Templates are stored as YAML files in `.taskwerk/templates/` or system templates directory.

### Template Schema
```yaml
# quickstart-template.schema.yaml
name: string          # Template identifier
description: string   # Human-readable description
prefix: string       # Default task ID prefix
category: string     # Default category
author: string       # Template author
version: string      # Template version
tags: [string]       # Template tags for search

# Variables that can be customized
variables:
  - name: project_name
    description: "Name of the project"
    default: "my-project"
    required: true
    
  - name: database_type
    description: "Database to use"
    default: "postgresql"
    choices: ["postgresql", "mysql", "sqlite", "mongodb"]

# Task definitions
tasks:
  - name: string              # Task name (can use {{variables}})
    description: string       # Detailed description
    category: string          # Override default category
    priority: high|medium|low # Task priority
    assignee: string         # Default assignee
    tags: [string]           # Task tags
    dependencies: [number]   # References to other task indices
    estimated_hours: number  # Time estimate
    
    # Optional subtasks
    subtasks:
      - name: string
        description: string
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create template loader and parser
2. Implement variable substitution engine
3. Build template validation

### Phase 2: Built-in Templates
1. Create 4-5 essential templates
2. Test with real projects
3. Gather feedback

### Phase 3: Advanced Features
1. Interactive mode with prompts
2. Template composition (combine templates)
3. Community template repository
4. Template versioning

## User-Defined Templates

Users can create custom templates in `.taskwerk/templates/`:

```yaml
# .taskwerk/templates/my-api.yaml
name: my-api
description: "Company standard API template"
prefix: API
category: backend
inherits: python-fastapi  # Inherit from built-in template

# Override or add tasks
tasks:
  - name: Add company authentication
    description: |
      Integrate with company SSO:
      - SAML integration
      - AD group mapping
    tags: [auth, company]
    dependencies: [7]  # After standard auth
```

## CLI Integration Examples

```bash
# See what tasks would be created
$ twrk quickstart python-fastapi --dry-run

Would create 20 tasks:
  FAST-001: Set up Python virtual environment [setup, python]
  FAST-002: Install FastAPI and dependencies [dependencies]
  ...

# Create with custom options
$ twrk quickstart python-fastapi \
  --prefix API \
  --assignee @ai-agent \
  --var project_name=user-service \
  --var database_type=postgresql

Created 20 tasks for python-fastapi quickstart
Tasks assigned to: @ai-agent
First task: API-001 - Set up Python virtual environment

# Interactive mode
$ twrk quickstart python-fastapi -i

? Project name: user-service
? Database type: (Use arrow keys)
❯ postgresql
  mysql
  sqlite
  mongodb
? Include authentication? (Y/n)
? Include Docker configuration? (Y/n)

Creating tasks...
✓ Created 20 tasks
```

## Benefits

1. **Consistency**: All projects follow same patterns
2. **Completeness**: Don't forget important tasks
3. **AI-Ready**: Tasks written for AI comprehension
4. **Time-Saving**: Hours saved on project setup
5. **Best Practices**: Security, testing, docs included
6. **Customizable**: Adapt to team standards

## Future Enhancements

1. **Template Marketplace**: Share templates
2. **Auto-Updates**: Update tasks based on completion
3. **Learning**: Adapt templates based on usage
4. **Integrations**: Import from other tools
5. **Validation**: Check if tasks make sense together