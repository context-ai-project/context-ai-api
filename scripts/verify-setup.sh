#!/bin/bash
# Script de verificación del setup de Context.ai API
# Verifica que Docker, PostgreSQL y (opcionalmente) el servidor estén funcionando correctamente.
# Vector store: Pinecone (externo)

set -e

echo "🔍 Verificando setup de Context.ai API..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Verificar Docker
echo "1️⃣  Verificando Docker..."
if command -v docker &> /dev/null; then
    docker --version
    print_result 0 "Docker instalado"
else
    print_result 1 "Docker no encontrado"
fi
echo ""

# 2. Verificar contenedor PostgreSQL (context-ai-postgres)
echo "2️⃣  Verificando contenedor PostgreSQL..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^context-ai-postgres$'; then
    print_result 0 "Contenedor context-ai-postgres está corriendo"
else
    print_warning "Contenedor context-ai-postgres no está corriendo. Ejecuta: docker compose up -d (o pnpm db:create)"
fi
echo ""

# 3. Verificar salud de PostgreSQL (context_ai_user / context_ai_db)
echo "3️⃣  Verificando PostgreSQL..."
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' context-ai-postgres 2>/dev/null || echo "not found")
if [ "$HEALTH" = "healthy" ]; then
    print_result 0 "PostgreSQL está healthy"
elif [ "$HEALTH" = "not found" ]; then
    print_warning "Contenedor no encontrado"
else
    # Intentar conexión directa por si healthcheck aún no ha pasado
    if docker exec context-ai-postgres pg_isready -U context_ai_user -d context_ai_db &>/dev/null; then
        print_result 0 "PostgreSQL acepta conexiones (context_ai_user / context_ai_db)"
    else
        print_warning "PostgreSQL health: $HEALTH"
    fi
fi
echo ""

# 4. Verificar que el servidor esté respondiendo (opcional)
echo "4️⃣  Verificando servidor NestJS..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1 2>/dev/null || echo "000")
if [ "$response" = "200" ] || [ "$response" = "401" ]; then
    print_result 0 "Servidor respondiendo en http://localhost:3001/api/v1"
else
    print_warning "Servidor no responde (HTTP $response). ¿Está corriendo? Ejecuta: pnpm start:dev"
fi
echo ""

# 5. Verificar Swagger (opcional)
echo "5️⃣  Verificando Swagger UI..."
swagger_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/docs 2>/dev/null || echo "000")
if [ "$swagger_response" = "200" ]; then
    print_result 0 "Swagger UI accesible en http://localhost:3001/api/docs"
else
    print_warning "Swagger UI no accesible (ejecuta pnpm start:dev si aún no está corriendo)"
fi
echo ""

# Resumen
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Verificación completada${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 URLs útiles:"
echo "   API: http://localhost:3001/api/v1"
echo "   Swagger: http://localhost:3001/api/docs"
echo "   DB: localhost:5433 (context_ai_user / context_ai_db)"
echo ""
echo "🔧 Comandos útiles:"
echo "   docker compose ps        - Ver estado de containers"
echo "   docker compose logs -f   - Ver logs de PostgreSQL"
echo "   pnpm start:dev          - Iniciar servidor en modo desarrollo"
echo ""
